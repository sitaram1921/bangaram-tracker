// ═══════════════════════════════════════════════════════════
// DATABASE MANAGEMENT (Firebase + LocalStorage Sync)
// ═══════════════════════════════════════════════════════════

class HabitDB {
  constructor() {
    this.habits = [];
    this.completions = {};
    this.streaks = {};
    this.profile = null;
    this.syncing = false;
    this.isOnline = navigator.onLine;
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  // Initialize database - load from localStorage and sync with Firebase
  async init() {
    this.loadLocal();
    
    if (this.isOnline && firebase.database) {
      await this.syncWithFirebase();
    }
  }

  // Load from localStorage
  loadLocal() {
    try {
      const raw = localStorage.getItem('ht-data');
      if (raw) {
        const data = JSON.parse(raw);
        this.habits = data.habits || [];
        this.completions = data.completions || {};
        this.streaks = data.streaks || {};
      } else {
        this.loadDefaults();
      }
    } catch (e) {
      console.error('Error loading local data:', e);
      this.loadDefaults();
    }
  }

  // Save to localStorage
  saveLocal() {
    try {
      localStorage.setItem('ht-data', JSON.stringify({
        habits: this.habits,
        completions: this.completions,
        streaks: this.streaks
      }));
    } catch (e) {
      console.error('Error saving to local storage:', e);
    }
  }

  // Load default habits
  loadDefaults() {
    this.habits = [
      { id: 'exercise', name: 'Exercise', emoji: '🏋️', color: '#FF5252', type: 'check' },
      { id: 'water', name: 'Water (8×)', emoji: '💧', color: '#26C6DA', type: 'water', goal: 8 },
      { id: 'food', name: 'Healthy Meals', emoji: '🥗', color: '#FFA726', type: 'check' },
      { id: 'sleep', name: 'Sleep 8h', emoji: '😴', color: '#7E57C2', type: 'check' }
    ];
    this.completions = {};
    this.streaks = {};
    this.saveLocal();
  }

  // Sync with Firebase
  async syncWithFirebase() {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const dbRef = database.ref(DB_ROOT);

      // One-time read first so profile is reliably loaded before returning
      const snapshot = await dbRef.once('value');
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.habits) this.habits = data.habits;
        if (data.completions) this.completions = data.completions;
        if (data.streaks) this.streaks = data.streaks;
        if (data.profile) this.profile = data.profile;
      }

      // Real-time listener for ongoing changes from other devices
      dbRef.on('value', snap => {
        if (snap.exists()) {
          const data = snap.val();
          if (data.habits) this.habits = data.habits;
          if (data.completions) this.completions = data.completions;
          if (data.streaks) this.streaks = data.streaks;
          if (data.profile) this.profile = data.profile;
        }
      });

      // Push habits/completions/streaks — profile has its own save path
      await dbRef.update({
        habits: this.habits,
        completions: this.completions,
        streaks: this.streaks,
        lastSync: new Date().toISOString()
      });

    } catch (e) {
      console.error('Firebase sync error:', e);
    } finally {
      this.syncing = false;
    }
  }

  async saveProfileData(profile) {
    this.profile = profile;
    try {
      await database.ref(DB_ROOT + '/profile').set(profile);
    } catch (e) {
      console.error('Profile save error:', e);
    }
  }

  // Auto-sync to Firebase whenever data changes
  async autoSync() {
    if (!this.isOnline) return;
    try {
      await database.ref(DB_ROOT).update({
        habits: this.habits,
        completions: this.completions,
        streaks: this.streaks,
        lastSync: new Date().toISOString()
      });
    } catch (e) {
      console.error('Auto-sync error:', e);
    }
  }

  // Online/Offline handlers
  handleOnline() {
    this.isOnline = true;
    showToast('📡 Connected - syncing data');
    this.syncWithFirebase();
  }

  handleOffline() {
    this.isOnline = false;
    showToast('📴 Offline mode - changes will sync when online');
  }

  // Habit operations
  isDone(id, dateStr = todayStr()) {
    const c = this.completions[dateStr] || {};
    const h = this.habits.find(x => x.id === id);
    if (!h) return false;
    return h.type === 'water' ? (c[id] || 0) >= (h.goal || 8) : !!c[id];
  }

  getWaterCount(dateStr = todayStr()) {
    return (this.completions[dateStr] || {})['water'] || 0;
  }

  getStreak(id) {
    return this.streaks[id] || 0;
  }

  toggleHabit(id, dateStr = todayStr()) {
    if (!this.completions[dateStr]) this.completions[dateStr] = {};
    const c = this.completions[dateStr];
    const wasD = this.isDone(id, dateStr);
    c[id] = !wasD;
    this.recalcStreak(id);
    this.saveLocal();
    this.autoSync();
  }

  changeWater(delta, dateStr = todayStr()) {
    if (!this.completions[dateStr]) this.completions[dateStr] = {};
    const c = this.completions[dateStr];
    const h = this.habits.find(x => x.id === 'water');
    const goal = h ? h.goal : 8;
    const prev = c['water'] || 0;
    c['water'] = Math.max(0, Math.min(goal, prev + delta));
    this.recalcStreak('water');
    this.saveLocal();
    this.autoSync();
  }

  addHabit(name, emoji, color) {
    const id = 'h_' + Date.now();
    this.habits.push({ id, name, emoji, color, type: 'check' });
    this.saveLocal();
    this.autoSync();
    return id;
  }

  deleteHabit(id) {
    this.habits = this.habits.filter(h => h.id !== id);
    this.saveLocal();
    this.autoSync();
  }

  recalcStreak(id) {
    let s = 0;
    const today = new Date();
    
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const str = dateToStr(d);
      const c = this.completions[str] || {};
      const h = this.habits.find(x => x.id === id);
      
      let done;
      if (h && h.type === 'water') {
        done = (c[id] || 0) >= (h.goal || 8);
      } else {
        done = !!c[id];
      }
      
      if (done) s++;
      else break;
    }
    
    this.streaks[id] = s;
  }

  completionPct(dateStr = todayStr()) {
    if (!this.habits.length) return 0;
    return Math.round(
      this.habits.filter(h => this.isDone(h.id, dateStr)).length / 
      this.habits.length * 100
    );
  }
}

// Initialize global DB instance
const db = new HabitDB();
