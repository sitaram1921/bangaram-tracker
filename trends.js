// ═══════════════════════════════════════════════════════════
// TRENDS & STATISTICS
// ═══════════════════════════════════════════════════════════

let trendsChart = null;
let currentTrendRange = '4w';

// Setup trend filters
function setupTrendFilters() {
  document.querySelectorAll('.trend-filter-btn').forEach(btn => {
    btn.onclick = (e) => {
      document.querySelectorAll('.trend-filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentTrendRange = e.target.dataset.range;
      updateTrends();
    };
  });
}

// Update trends chart and stats
function updateTrends() {
  const { start, end } = getTrendDateRange(currentTrendRange);
  const dates = getDatesBetween(start, end);
  
  // Calculate trend data for each habit
  const trendData = {};
  db.habits.forEach(h => {
    trendData[h.id] = {
      name: h.name,
      color: h.color,
      completionDates: 0,
      completeCount: 0,
      data: []
    };
  });

  // Count completions for each date
  dates.forEach(dateStr => {
    db.habits.forEach(h => {
      const c = db.completions[dateStr] || {};
      let done;
      if (h.type === 'water') {
        done = (c[h.id] || 0) >= (h.goal || 8) ? 1 : 0;
      } else {
        done = !!c[h.id] ? 1 : 0;
      }
      trendData[h.id].data.push(done);
      if (done) trendData[h.id].completeCount++;
    });
  });

  // Calculate stats
  db.habits.forEach(h => {
    const total = trendData[h.id].completeCount;
    const percent = Math.round((total / dates.length) * 100);
    trendData[h.id].completionRate = percent;
  });

  // Render chart
  renderTrendsChart(trendData, dates);
  
  // Render stats
  renderStats(trendData);
}

// Render Chart.js chart
function renderTrendsChart(trendData, dates) {
  const ctx = document.getElementById('trendsChart').getContext('2d');
  
  const datasets = db.habits.map(h => {
    const data = trendData[h.id].data;
    const cumulativeData = [];
    let sum = 0;
    data.forEach(d => {
      sum += d;
      cumulativeData.push(Math.round((sum / cumulativeData.length) * 100) || 0);
    });
    
    return {
      label: h.name,
      data: cumulativeData,
      borderColor: h.color,
      backgroundColor: h.color + '20',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: h.color,
      pointBorderColor: '#fff',
      pointBorderWidth: 2
    };
  });

  // Destroy previous chart
  if (trendsChart) {
    trendsChart.destroy();
  }

  trendsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map((d, i) => i % 7 === 0 ? d.slice(5) : ''),
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: 'rgba(255,255,255,0.7)',
            font: { size: 11, weight: '700' },
            usePointStyle: true,
            padding: 12
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: 'rgba(255,255,255,0.4)',
            callback: (v) => v + '%'
          },
          grid: {
            color: 'rgba(255,255,255,0.05)',
            drawBorder: false
          }
        },
        x: {
          ticks: {
            color: 'rgba(255,255,255,0.4)',
            font: { size: 10 }
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// Render statistics
function renderStats(trendData) {
  const statsGrid = document.getElementById('statsGrid');
  statsGrid.innerHTML = '';

  db.habits.forEach(h => {
    const stat = trendData[h.id];
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-value" style="color: ${h.color}">${stat.completionRate}%</div>
      <div class="stat-label">${h.name}</div>
    `;
    statsGrid.appendChild(card);
  });

  // Overall completion stat
  const allDates = Object.keys(db.completions);
  const totalDays = allDates.length;
  const totalCompletes = allDates.reduce((sum, date) => {
    return sum + db.habits.filter(h => db.isDone(h.id, date)).length;
  }, 0);
  const overallPercent = totalDays > 0 ? Math.round((totalCompletes / (totalDays * db.habits.length)) * 100) : 0;

  const overallCard = document.createElement('div');
  overallCard.className = 'stat-card';
  overallCard.innerHTML = `
    <div class="stat-value" style="color: #42A5F5">${overallPercent}%</div>
    <div class="stat-label">Overall Rate</div>
  `;
  statsGrid.appendChild(overallCard);

  // Best streak stat
  const bestStreak = Math.max(...db.habits.map(h => db.getStreak(h.id)), 0);
  const bestStreakCard = document.createElement('div');
  bestStreakCard.className = 'stat-card';
  bestStreakCard.innerHTML = `
    <div class="stat-value" style="color: #FF7043">${bestStreak}</div>
    <div class="stat-label">Best Streak</div>
  `;
  statsGrid.appendChild(bestStreakCard);
}
