// ═══════════════════════════════════════════════════════════
// MAIN APPLICATION INITIALIZATION
// ═══════════════════════════════════════════════════════════

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(reg => {
        setInterval(() => reg.update(), 60000);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w.addEventListener('statechange', () => {
            if (w.state === 'activated') showToast('New version available — refresh to update');
          });
        });
      })
      .catch(err => console.warn('Service Worker registration failed:', err));
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'SYNC_HABITS' && db.isOnline) db.syncWithFirebase();
  });
}

// ── GREETING ─────────────────────────────────────────────────

const GREETINGS = [
  { from:  0, to:  5, text: 'Good Night',      emoji: '🌙', period: 'night' },
  { from:  5, to: 12, text: 'Good Morning',    emoji: '☀️', period: 'morning' },
  { from: 12, to: 17, text: 'Good Afternoon',  emoji: '🌤️', period: 'afternoon' },
  { from: 17, to: 21, text: 'Good Evening',    emoji: '🌆', period: 'evening' },
  { from: 21, to: 24, text: 'Good Night',      emoji: '🌙', period: 'night' },
];

function renderGreeting() {
  const h = new Date().getHours();
  const g = GREETINGS.find(x => h >= x.from && h < x.to);
  const el = document.getElementById('greetingText');
  el.textContent = `${g.emoji} ${g.text}, Bangaram!`;
  el.className = `greeting-${g.period}`;
}

function scheduleGreetingRefresh() {
  const h = new Date().getHours();
  const boundaries = [5, 12, 17, 21, 24];
  const next = boundaries.find(b => b > h) ?? 24;
  const t = new Date();
  t.setHours(next === 24 ? 0 : next, 0, 0, 0);
  if (next === 24) t.setDate(t.getDate() + 1);
  setTimeout(() => { renderGreeting(); scheduleGreetingRefresh(); }, t - new Date());
}

// ── MEAL IDEAS ────────────────────────────────────────────────

const STATIC_MEALS = [
  '• Chicken Biryani — fragrant basmati with whole spices\n• Boondi Raita — cool yogurt with crispy chickpea pearls\n• Mirchi Ka Salan — spicy green chilli gravy',
  '• Rajma Chawal — hearty kidney bean curry with steamed rice\n• Jeera Aloo — cumin-spiced pan potatoes\n• Pickle & Papad',
  '• Palak Paneer — creamy spinach with soft cottage cheese\n• Garlic Butter Naan — pillowy flatbread from the tawa\n• Dal Tadka — tempered yellow lentils',
  '• Butter Chicken — rich tomato-cream curry\n• Tawa Paratha — whole wheat layered flatbread\n• Mint & Coriander Chutney',
  '• Chole Masala — bold spiced chickpeas\n• Bhature — fluffy deep-fried bread\n• Mango Lassi — chilled yogurt mango drink',
  '• Fish Curry — coastal style with coconut milk\n• Steamed Rice — light and fluffy\n• Cucumber Salad with lemon and chilli',
  '• Mutton Rogan Josh — slow-cooked Kashmiri lamb\n• Saffron Pulao — fragrant long grain rice\n• Onion Raita — cooling yogurt dip',
];

async function renderMealSuggestion() {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local (IST) time
  let text, badge;
  try {
    const snap = await database.ref(DB_ROOT + '/todayMeal').once('value');
    const meal = snap.val();
    if (meal && meal.date === today && meal.suggestions) {
      text  = meal.suggestions;
      badge = '✨ Claude-picked';
    }
  } catch (_) {}

  if (!text) {
    text  = STATIC_MEALS[new Date().getDay()];
    badge = "Today's picks";
  }

  document.getElementById('mealContent').textContent = text;
  document.getElementById('mealBadge').textContent = badge;
}

// ── MIDNIGHT REFRESH ──────────────────────────────────────────

function scheduleMidnightRefresh() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0); // next local midnight (uses device timezone — IST on her phone)
  setTimeout(() => {
    updateWeekDisplay();
    render();
    renderGreeting();
    renderMealSuggestion();
    if (db.profile) renderBMI();
    scheduleMidnightRefresh();
  }, midnight - now);
}

// ── INIT ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  await db.init();
  updateWeekDisplay();
  render();
  setupWeekNavigation();
  setupTrendFilters();
  scheduleMidnightRefresh();
  renderGreeting();
  scheduleGreetingRefresh();
  renderMealSuggestion();

  if (db.profile) {
    renderBMI();
  } else {
    document.getElementById('onboardingScreen').classList.add('visible');
  }

  checkNotificationSetup();
  loadHealthData();
});

// ── AGE (calculated from DOB, updates automatically on birthday) ──

const DOB = new Date('2001-11-03');

function calculateAge() {
  const today = new Date();
  let age = today.getFullYear() - DOB.getFullYear();
  const m = today.getMonth() - DOB.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < DOB.getDate())) age--;
  return age;
}

// ── ONBOARDING ────────────────────────────────────────────────

let _heightUnit = 'cm';
let _obWeightUnit = 'kg';

function setHeightUnit(unit) {
  _heightUnit = unit;
  document.getElementById('obHeightCmWrap').style.display = unit === 'cm' ? 'block' : 'none';
  document.getElementById('obHeightFtWrap').style.display = unit === 'ft' ? 'flex' : 'none';
  document.getElementById('hUnitCm').classList.toggle('active', unit === 'cm');
  document.getElementById('hUnitFt').classList.toggle('active', unit === 'ft');
}

function setObWeightUnit(unit) {
  _obWeightUnit = unit;
  document.getElementById('wObUnitKg').classList.toggle('active', unit === 'kg');
  document.getElementById('wObUnitLbs').classList.toggle('active', unit === 'lbs');
  document.getElementById('obWeight').placeholder = unit === 'kg' ? '60' : '132';
}

async function submitOnboarding() {
  let heightCm;
  if (_heightUnit === 'cm') {
    heightCm = parseFloat(document.getElementById('obHeightCm').value);
  } else {
    const ft = parseFloat(document.getElementById('obHeightFt').value) || 0;
    const inn = parseFloat(document.getElementById('obHeightIn').value) || 0;
    heightCm = Math.round(ft * 30.48 + inn * 2.54);
  }
  const wRaw = parseFloat(document.getElementById('obWeight').value);
  const weightKg = _obWeightUnit === 'kg' ? wRaw : Math.round(wRaw / 2.20462 * 10) / 10;

  if (!heightCm || !weightKg)          { showToast('Please fill in all fields'); return; }
  if (heightCm < 50 || heightCm > 300) { showToast('Please enter a valid height'); return; }
  if (weightKg < 10 || weightKg > 500) { showToast('Please enter a valid weight'); return; }

  const profile = { heightCm, weightKg, heightUnit: _heightUnit, weightUnit: _obWeightUnit };
  await db.saveProfileData(profile);
  document.getElementById('onboardingScreen').classList.remove('visible');
  renderBMI();
  showToast('Profile saved!');
}

// ── BMI ───────────────────────────────────────────────────────

function renderBMI() {
  const p = db.profile;
  if (!p) return;

  const bmi = p.weightKg / Math.pow(p.heightCm / 100, 2);
  const bmiVal = Math.round(bmi * 10) / 10;

  let category, color;
  if      (bmi < 18.5) { category = 'Underweight'; color = '#42A5F5'; }
  else if (bmi < 25)   { category = 'Normal';       color = '#66BB6A'; }
  else if (bmi < 30)   { category = 'Overweight';   color = '#FFA726'; }
  else                  { category = 'Obese';         color = '#EF5350'; }

  animateBMICounter(bmiVal);

  const badge = document.getElementById('bmiBadge');
  badge.textContent = category;
  badge.style.background = color + '22';
  badge.style.color = color;
  badge.style.borderColor = color + '55';

  document.getElementById('statAge').textContent = calculateAge();
  document.getElementById('statHeight').textContent =
    p.heightUnit === 'ft'
      ? (() => { const t = Math.round(p.heightCm / 2.54); return `${Math.floor(t/12)}'${t%12}"`; })()
      : `${p.heightCm} cm`;
  document.getElementById('statWeight').textContent =
    p.weightUnit === 'lbs'
      ? `${Math.round(p.weightKg * 2.20462 * 10) / 10} lbs`
      : `${p.weightKg} kg`;

  // Needle position on scale 14–40
  const pct = Math.min(Math.max((bmi - 14) / 26 * 100, 2), 98);
  setTimeout(() => { document.getElementById('bmiNeedle').style.left = pct + '%'; }, 400);

  updateBMIFigure(bmi, color);
  document.getElementById('bmiSection').classList.add('show');
}

function animateBMICounter(target) {
  const el = document.getElementById('bmiNumber');
  const duration = 1000;
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = (target * eased).toFixed(1);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function updateBMIFigure(bmi, color) {
  const figure = document.getElementById('bmiFigure');
  const torsoG = document.getElementById('bmiTorsoG');
  if (!figure || !torsoG) return;

  let scale;
  if      (bmi <= 16)   scale = 0.55;
  else if (bmi <= 18.5) scale = 0.55 + (bmi - 16) / 2.5 * 0.3;
  else if (bmi <= 25)   scale = 0.85 + (bmi - 18.5) / 6.5 * 0.3;
  else if (bmi <= 30)   scale = 1.15 + (bmi - 25) / 5 * 0.45;
  else                  scale = Math.min(1.6 + (bmi - 30) / 10 * 0.5, 2.2);

  figure.style.color = color;
  // Scale torso from its center (50, 95)
  torsoG.setAttribute('transform', `translate(50,95) scale(${scale},1) translate(-50,-95)`);
}

// ── WEIGHT MODAL ──────────────────────────────────────────────

let _weightEditUnit = 'kg';

function openWeightModal() {
  if (!db.profile) return;
  _weightEditUnit = db.profile.weightUnit || 'kg';
  const val = _weightEditUnit === 'kg'
    ? db.profile.weightKg
    : Math.round(db.profile.weightKg * 2.20462 * 10) / 10;
  document.getElementById('weightEditInput').value = val;
  document.getElementById('wUnitKg').classList.toggle('active', _weightEditUnit === 'kg');
  document.getElementById('wUnitLbs').classList.toggle('active', _weightEditUnit === 'lbs');
  document.getElementById('weightOverlay').classList.add('open');
  setTimeout(() => document.getElementById('weightEditInput').focus(), 350);
}

function closeWeightModal() {
  document.getElementById('weightOverlay').classList.remove('open');
}

function setWeightUnit(unit) {
  const input = document.getElementById('weightEditInput');
  const v = parseFloat(input.value);
  if (!isNaN(v)) {
    if (unit === 'lbs' && _weightEditUnit === 'kg')  input.value = Math.round(v * 2.20462 * 10) / 10;
    if (unit === 'kg'  && _weightEditUnit === 'lbs') input.value = Math.round(v / 2.20462 * 10) / 10;
  }
  _weightEditUnit = unit;
  document.getElementById('wUnitKg').classList.toggle('active', unit === 'kg');
  document.getElementById('wUnitLbs').classList.toggle('active', unit === 'lbs');
}

async function saveWeight() {
  const raw = parseFloat(document.getElementById('weightEditInput').value);
  if (!raw || raw < 20 || raw > 500) { showToast('Enter a valid weight'); return; }
  const weightKg = _weightEditUnit === 'kg' ? raw : Math.round(raw / 2.20462 * 10) / 10;
  db.profile.weightKg = weightKg;
  db.profile.weightUnit = _weightEditUnit;
  await db.saveProfileData(db.profile);
  closeWeightModal();
  renderBMI();
  showToast('Weight updated!');
}

// ── PUSH NOTIFICATIONS ────────────────────────────────────────

const VAPID_PUBLIC_KEY = 'BAoyL8TqiSipk9Gk3wptgzMYI6uU7TgeaD56VP8zdblkAN2NilSdi1wIahMRvKyCjBi8OzAAlaCr_vwzFVcbtQA';

function urlB64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function checkNotificationSetup() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission === 'granted') { renewSubscription(); return; }
  if (Notification.permission === 'denied') return;

  if (isIOS() && !window.navigator.standalone) {
    document.getElementById('iosPrompt').style.display = 'block';
  } else {
    document.getElementById('notifBanner').style.display = 'flex';
  }
}

async function requestNotifications() {
  const perm = await Notification.requestPermission();
  document.getElementById('notifBanner').style.display = 'none';
  if (perm !== 'granted') { showToast('Notifications blocked in browser settings'); return; }
  await subscribeToPush();
  showToast('Reminders enabled! 🔔');
}

async function subscribeToPush() {
  try {
    const reg = await navigator.serviceWorker.ready;

    // Always unsubscribe first so a stale subscription from a previous
    // VAPID key is never reused (FCM would reject it with 401/410).
    const existing = await reg.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await database.ref(DB_ROOT + '/pushSubscription').set(sub.toJSON());
  } catch (e) {
    console.error('Push subscribe error:', e);
    showToast('Could not enable notifications');
  }
}

async function renewSubscription() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // If the VAPID key changed, the old subscription won't work — force a fresh one.
      const existingKey = existing.options?.applicationServerKey
        ? new Uint8Array(existing.options.applicationServerKey) : null;
      const currentKey  = urlB64ToUint8Array(VAPID_PUBLIC_KEY);
      const keyChanged  = !existingKey ||
        existingKey.length !== currentKey.length ||
        existingKey.some((b, i) => b !== currentKey[i]);

      if (keyChanged) {
        await existing.unsubscribe();
        await subscribeToPush();
        return;
      }

      // Same key — just re-sync endpoint to Firebase (cheap, idempotent).
      await database.ref(DB_ROOT + '/pushSubscription').set(existing.toJSON());
      return;
    }
    await subscribeToPush();
  } catch (e) {
    console.error('Push subscription renewal error:', e);
  }
}

// ── APPLE HEALTH ─────────────────────────────────────────────

const HEALTH_FIREBASE_URL = 'https://tracker-bea1e-default-rtdb.firebaseio.com/tracker/healthData.json';
const STEPS_GOAL = 10000;

async function loadHealthData() {
  try {
    const snap = await database.ref(DB_ROOT + '/healthData').once('value');
    const data = snap.val();

    if (!data) {
      // No data yet — show connect card
      document.getElementById('healthConnectCard').style.display = 'flex';
      document.getElementById('healthDataCard').style.display  = 'none';
      return;
    }

    document.getElementById('healthConnectCard').style.display = 'none';
    document.getElementById('healthDataCard').style.display  = 'block';
    renderHealthCard(data);

    const today = new Date().toLocaleDateString('en-CA');
    if (data.date === today) applyHealthToHabits(data);

  } catch (e) {
    console.error('Health data load error:', e);
  }
}

function renderHealthCard(data) {
  const today = new Date().toLocaleDateString('en-CA');

  // Sync badge
  const badge = document.getElementById('healthSyncBadge');
  badge.style.display = 'inline-block';
  if (data.date === today) {
    badge.textContent = '✓ synced today';
    badge.className = 'health-sync-badge fresh';
  } else if (data.date) {
    const d = new Date(data.date + 'T00:00:00');
    badge.textContent = 'synced ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    badge.className = 'health-sync-badge stale';
  }

  // Steps
  const steps = data.steps || 0;
  document.getElementById('healthStepsNum').textContent = steps.toLocaleString();
  const pct = Math.min(steps / STEPS_GOAL * 100, 100);
  document.getElementById('healthBarFill').style.width = pct + '%';
  document.getElementById('healthStepsSub').textContent =
    steps >= STEPS_GOAL ? '🎉 Goal reached!' : `${(STEPS_GOAL - steps).toLocaleString()} steps to goal`;

  // Sleep
  const sleep = data.sleepHours || 0;
  document.getElementById('healthSleepVal').textContent =
    sleep ? `${Math.floor(sleep)}h ${Math.round((sleep % 1) * 60)}m` : '—';

  // Workout
  const wType = data.workoutType || '';
  const wMins = data.workoutMinutes || 0;
  const wCount = data.workouts || 0;
  document.getElementById('healthWorkoutVal').textContent =
    wType ? (wMins ? `${wType} · ${wMins}m` : wType) :
    wCount > 0 ? `${wCount} session${wCount > 1 ? 's' : ''}` : 'None';

  // Weight
  document.getElementById('healthWeightVal').textContent =
    data.weightKg ? `${data.weightKg} kg` : '—';
}

function applyHealthToHabits(data) {
  const today = todayStr();
  let changed = false;

  db.habits.forEach(h => {
    const nameLower = h.name.toLowerCase();
    const isExerciseHabit =
      h.id === 'exercise' ||
      nameLower.includes('exercise') || nameLower.includes('workout') ||
      nameLower.includes('gym')      || nameLower.includes('run') ||
      ['🏋️','🏃','🚴','🤸','🏊','⚽'].includes(h.emoji);

    const isSleepHabit =
      h.id === 'sleep' ||
      nameLower.includes('sleep') || nameLower.includes('bed');

    if (isExerciseHabit && !db.isDone(h.id)) {
      const hasWorkout = (data.workouts || 0) > 0 || data.workoutType;
      const hasSteps   = (data.steps || 0) >= 8000;
      if (hasWorkout || hasSteps) {
        db.completions[today] = db.completions[today] || {};
        db.completions[today][h.id] = true;
        db.recalcStreak(h.id);
        changed = true;
      }
    }

    if (isSleepHabit && !db.isDone(h.id)) {
      if ((data.sleepHours || 0) >= 7) {
        db.completions[today] = db.completions[today] || {};
        db.completions[today][h.id] = true;
        db.recalcStreak(h.id);
        changed = true;
      }
    }
  });

  if (changed) {
    db.saveLocal();
    db.autoSync();
    render();
    showToast('Habits auto-checked from Apple Health 🍎');
  }

  // Weight sync — update BMI if newer
  if (data.weightKg && db.profile && data.weightKg !== db.profile.weightKg) {
    db.profile.weightKg = data.weightKg;
    db.saveProfileData(db.profile);
    renderBMI();
  }
}

function showHealthSetup() {
  const url = HEALTH_FIREBASE_URL;
  document.getElementById('healthFirebaseUrl').textContent = url;
  document.getElementById('healthJsonTemplate').textContent =
`{
  "date": "YYYY-MM-DD",
  "steps": 0,
  "sleepHours": 0,
  "workouts": 0,
  "workoutType": "Running",
  "workoutMinutes": 30,
  "weightKg": 0,
  "lastSync": "ISO_DATE"
}`;
  document.getElementById('healthSetupOverlay').classList.add('open');
}

function closeHealthSetup() {
  document.getElementById('healthSetupOverlay').classList.remove('open');
}

async function copyFirebaseUrl() {
  try {
    await navigator.clipboard.writeText(HEALTH_FIREBASE_URL);
    showToast('Firebase URL copied!');
  } catch {
    showToast(HEALTH_FIREBASE_URL);
  }
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key === 'e' || e.key === 'E') toggleEditMode();
  if (e.key === 'Escape') {
    document.getElementById('modalOverlay').classList.remove('open');
    closeWeightModal();
  }
});

// ── VISIBILITY CHANGE ─────────────────────────────────────────

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && db.isOnline) {
    db.syncWithFirebase();
    render();
    renderGreeting();
    renderMealSuggestion();
    loadHealthData();
  }
});
