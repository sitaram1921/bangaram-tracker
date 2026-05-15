// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

// Date formatting helpers
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function dateToStr(date) {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function strToDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return new Date(year, month - 1, day);
}

// Get current week (last 7 days)
function weekDays() {
  const days = [], t = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    const str = dateToStr(d);
    days.push({
      str,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2).toUpperCase(),
      isToday: i === 0
    });
  }
  return days;
}

// Get specific week starting from a given date
function weekDaysFromDate(date) {
  const days = [], t = new Date(date);
  // Start from Sunday
  const day = t.getDay();
  const diff = t.getDate() - day;
  const startOfWeek = new Date(t.setDate(diff));

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const str = dateToStr(d);
    days.push({
      str,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2).toUpperCase(),
      date: d
    });
  }
  return days;
}

// Get week range text (e.g., "May 12 - 18")
function getWeekRangeText(days) {
  const first = strToDate(days[0].str);
  const last = strToDate(days[6].str);
  
  const isCurrentWeek = new Date().toDateString() === new Date().toDateString() && 
                        days[6].str === todayStr();
  
  if (isCurrentWeek) {
    return 'This week';
  }
  
  const format = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return format(first) + ' - ' + format(last);
}

// Escape HTML
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Show toast notification
let toastT;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

// Get date range for trends
function getTrendDateRange(range) {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);

  if (range === '4w') {
    start.setDate(today.getDate() - 28);
  } else if (range === '12w') {
    start.setDate(today.getDate() - 84);
  } else if (range === 'all') {
    start.setFullYear(today.getFullYear() - 10); // Go back 10 years max
  }

  return { start, end };
}

// Get all dates between start and end
function getDatesBetween(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    dates.push(dateToStr(new Date(current)));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}
