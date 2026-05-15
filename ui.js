// ═══════════════════════════════════════════════════════════
// UI RENDERING
// ═══════════════════════════════════════════════════════════

const EMOJIS = ['🏋️','🏃','🚴','🧘','🤸','🏊','💧','🥗','🍎','🥦','🥑',
                '😴','📚','🎯','✍️','🧠','💊','❤️','🌿','⚡','🎵','🧹',
                '🛁','☀️','🌙','🧊','🫁','🦷','💪','🌟'];
const COLORS = [
  '#FF5252','#FF7043','#FFA726','#FFCA28',
  '#66BB6A','#26C6DA','#42A5F5','#7E57C2',
  '#EC407A','#26A69A','#AB47BC','#8D6E63'
];
const CIRC = 2 * Math.PI * 32;

let currentWeek = weekDaysFromDate(new Date());
let selEmoji = EMOJIS[0], selColor = COLORS[0];

// Render everything
function render(dateStr = todayStr()) {
  renderHeader();
  renderGrid();
  renderWeekly();
  updateTrends();
}

// Render header with completion ring
function renderHeader() {
  const now = new Date();
  document.getElementById('todayDay').textContent = now.toLocaleDateString('en-US', { weekday: 'long' });
  document.getElementById('todayMonthDay').textContent = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  const pct = db.completionPct();
  document.getElementById('ringPct').textContent = pct + '%';
  const offset = CIRC - (pct / 100) * CIRC;
  document.getElementById('ringArc').style.strokeDashoffset = offset;

  document.getElementById('congratsWrap').classList.toggle('show', pct === 100);
}

// Render today's habits grid
function renderGrid() {
  const grid = document.getElementById('habitsGrid');
  grid.innerHTML = '';
  
  db.habits.forEach(h => {
    const el = h.type === 'water' ? makeWaterCard(h) : makeCheckCard(h);
    grid.appendChild(el);
  });
  
  // Add habit button
  const add = document.createElement('div');
  add.className = 'add-card';
  add.onclick = openModal;
  add.innerHTML = `<div class="add-icon">+</div><span class="add-text">Add Habit</span>`;
  grid.appendChild(add);
}

// Create check habit card
function makeCheckCard(h) {
  const done = db.isDone(h.id);
  const streak = db.getStreak(h.id);
  const el = document.createElement('div');
  el.className = 'habit-card' + (done ? ' done' : '');
  el.style.setProperty('--ac', h.color);
  el.onclick = () => {
    db.toggleHabit(h.id);
    render();
    if (db.completionPct() === 100) checkAllDone();
  };
  el.innerHTML = `
    <button class="del-btn" onclick="event.stopPropagation();db.deleteHabit('${h.id}');render();showToast('Habit removed')">×</button>
    <div>
      <span class="habit-emoji">${h.emoji}</span>
      <p class="habit-name">${esc(h.name)}</p>
      <div class="habit-streak">
        ${streak > 0 ? `🔥 <span class="streak-num">${streak}</span> day streak` : 'Start your streak today!'}
      </div>
    </div>
    <div class="habit-bottom">
      <div class="check-circle">
        <svg class="check-svg" viewBox="0 0 16 16" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="2,8 6,12 14,4"/>
        </svg>
      </div>
    </div>`;
  return el;
}

// Create water tracking card
function makeWaterCard(h) {
  const done = db.isDone(h.id);
  const streak = db.getStreak(h.id);
  const count = db.getWaterCount();
  const goal = h.goal || 8;
  const el = document.createElement('div');
  el.className = 'habit-card' + (done ? ' done' : '');
  el.style.setProperty('--ac', h.color);

  const drops = Array.from({ length: goal }, (_, i) =>
    `<div class="w-drop${i < count ? ' on' : ''}"></div>`
  ).join('');

  el.innerHTML = `
    <button class="del-btn" onclick="event.stopPropagation();db.deleteHabit('water');render();showToast('Habit removed')">×</button>
    <div>
      <span class="habit-emoji">${h.emoji}</span>
      <p class="habit-name">${esc(h.name)}</p>
      <div class="habit-streak">
        ${streak > 0 ? `🔥 <span class="streak-num">${streak}</span> day streak` : 'Start your streak!'}
      </div>
    </div>
    <div style="position:relative;z-index:1">
      <div class="water-progress">${drops}</div>
      <div class="water-row">
        <span class="water-count">${count}<sup> / ${goal}</sup></span>
        <div class="water-btns">
          <button class="water-btn" onclick="event.stopPropagation();db.changeWater(-1);render()">−</button>
          <button class="water-btn" onclick="event.stopPropagation();db.changeWater(1);render()">+</button>
        </div>
      </div>
    </div>`;
  return el;
}

// Render weekly history
function renderWeekly() {
  const days = currentWeek;

  // Day headers
  const hdr = document.getElementById('weekDayHeaders');
  hdr.innerHTML = days.map(d => `<span class="wdh${d.isToday ? ' today' : ''}">${d.label}</span>`).join('');

  // Week rows
  const grid = document.getElementById('weeklyGrid');
  grid.innerHTML = '';
  db.habits.forEach(h => {
    const row = document.createElement('div');
    row.className = 'week-row';

    const name = document.createElement('span');
    name.className = 'week-row-name';
    name.textContent = h.name;
    row.appendChild(name);

    const cells = document.createElement('div');
    cells.className = 'week-cells';
    days.forEach(day => {
      const c = db.completions[day.str] || {};
      let done;
      if (h.type === 'water') {
        done = (c[h.id] || 0) >= (h.goal || 8);
      } else {
        done = !!c[h.id];
      }
      const cell = document.createElement('div');
      cell.className = 'week-cell' + (done ? ' done' : '') + (day.isToday ? ' today' : '');
      cell.style.setProperty('--ac', h.color);
      cells.appendChild(cell);
    });
    row.appendChild(cells);
    grid.appendChild(row);
  });
}

// Week navigation
function setupWeekNavigation() {
  document.getElementById('prevWeekBtn').onclick = () => goToPreviousWeek();
  document.getElementById('nextWeekBtn').onclick = () => goToNextWeek();
}

function goToPreviousWeek() {
  const firstDay = strToDate(currentWeek[0].str);
  firstDay.setDate(firstDay.getDate() - 7);
  currentWeek = weekDaysFromDate(firstDay);
  updateWeekDisplay();
  renderWeekly();
}

function goToNextWeek() {
  const firstDay = strToDate(currentWeek[0].str);
  firstDay.setDate(firstDay.getDate() + 7);
  currentWeek = weekDaysFromDate(firstDay);
  updateWeekDisplay();
  renderWeekly();
}

function updateWeekDisplay() {
  document.getElementById('weekRangeText').textContent = getWeekRangeText(currentWeek);
  
  // Check if current week is in future
  const today = new Date();
  const lastWeekDay = strToDate(currentWeek[6].str);
  document.getElementById('nextWeekBtn').disabled = lastWeekDay > today;
}

// Check if all habits done
function checkAllDone() {
  if (db.completionPct() === 100) {
    showToast('All done! Amazing work 🎉');
  }
}

// Edit mode
function toggleEditMode() {
  document.body.classList.toggle('edit-mode');
  const btn = document.getElementById('editToggle');
  btn.title = document.body.classList.contains('edit-mode') ? 'Done editing' : 'Edit habits';
}

// Modal functions
function openModal() {
  document.getElementById('emojiRow').innerHTML = EMOJIS.map((e, i) =>
    `<div class="e-opt${i === 0 ? ' sel' : ''}" onclick="pickEmoji('${e}',this)">${e}</div>`
  ).join('');
  document.getElementById('colorRow').innerHTML = COLORS.map((c, i) =>
    `<div class="c-opt${i === 0 ? ' sel' : ''}" style="background:${c}" onclick="pickColor('${c}',this)"></div>`
  ).join('');
  selEmoji = EMOJIS[0];
  selColor = COLORS[0];
  document.getElementById('habitNameInput').value = '';
  document.getElementById('modalOverlay').classList.add('open');
  setTimeout(() => document.getElementById('habitNameInput').focus(), 350);
}

function onOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay'))
    document.getElementById('modalOverlay').classList.remove('open');
}

function pickEmoji(e, el) {
  selEmoji = e;
  document.querySelectorAll('.e-opt').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
}

function pickColor(c, el) {
  selColor = c;
  document.querySelectorAll('.c-opt').forEach(x => x.classList.remove('sel'));
  el.classList.add('sel');
}

function saveHabit() {
  const name = document.getElementById('habitNameInput').value.trim();
  if (!name) {
    showToast('Please enter a name');
    return;
  }
  db.addHabit(name, selEmoji, selColor);
  document.getElementById('modalOverlay').classList.remove('open');
  render();
  showToast('Habit added! ✨');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('habitNameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveHabit();
  });
});
