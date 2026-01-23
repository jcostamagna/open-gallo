let allMatches = [];

// Extract unique years from matches data
function getAvailableYears(matches) {
  const years = new Set();
  matches.forEach(match => {
    const dateStr = match['Fecha'];
    if (dateStr) {
      const year = dateStr.split('/')[2];
      if (year && !isNaN(year)) {
        years.add(Number(year));
      }
    }
  });
  return Array.from(years).sort((a, b) => b - a); // Descending order (newest first)
}

// Calculate max matches played by any player (for a given year filter)
function getMaxMatchesPlayed(matches, filterYear = null) {
  const stats = {};
  matches.forEach(match => {
    const dateStr = match['Fecha'];
    const year = dateStr ? dateStr.split('/')[2] : null;

    if (filterYear && Number(year) !== Number(filterYear)) return;

    const winner = match['Equipo Ganador']?.trim();
    const loser = match['Equipo Perdedor']?.trim();

    if (winner) {
      stats[winner] = (stats[winner] || 0) + 1;
    }
    if (loser) {
      stats[loser] = (stats[loser] || 0) + 1;
    }
  });

  const counts = Object.values(stats);
  return counts.length > 0 ? Math.max(...counts) : 0;
}

// Calculate smart default for min matches: multiple of 5, less than half of top player's matches
function getSmartMinMatchesDefault(maxMatches) {
  const halfMax = maxMatches / 2;
  // Find largest multiple of 5 that is less than halfMax
  const smartDefault = Math.floor(halfMax / 5) * 5;
  return Math.max(0, smartDefault); // At least 0
}

// Populate year filter dropdown
function populateYearFilter(years, defaultYear) {
  const select = document.getElementById('yearFilter');
  select.innerHTML = '';

  // Add "Todos" option
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'Todos';
  select.appendChild(allOption);

  // Add year options
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    if (year === defaultYear) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

// Populate min matches dropdown
function populateMinMatchesFilter(maxMatches, defaultValue) {
  const select = document.getElementById('minMatches');
  select.innerHTML = '';

  // Generate options: 0, 5, 10, 15, ... up to a reasonable max
  const maxOption = Math.min(maxMatches, 50); // Cap at 50 for UI sanity
  for (let i = 0; i <= maxOption; i += 5) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    if (i === defaultValue) {
      option.selected = true;
    }
    select.appendChild(option);
  }
}

function updateLeaderboardFromFilters() {
  const year = document.getElementById('yearFilter')?.value || null;
  const minMatches = parseInt(document.getElementById('minMatches').value) || 0;
  renderLeaderboard(year, minMatches);
}

// Fetch matches and render leaderboard (filtered by valid players)
fetchMatchesWithPlayers()
  .then(matchesData => {
    // Process matches - carry forward dates for rows without dates
    let lastDate = null;
    allMatches = matchesData.map(row => {
      if (row['Fecha']) {
        lastDate = row['Fecha'];
      }
      const winner = row['Equipo Ganador']?.trim();
      const loser = row['Equipo Perdedor']?.trim();

      if (!winner && !loser) return null;

      return {
        'Fecha': lastDate,
        'Equipo Ganador': winner,
        'Equipo Perdedor': loser
      };
    }).filter(Boolean);

    // Get available years and set default to latest
    const availableYears = getAvailableYears(allMatches);
    const defaultYear = availableYears.length > 0 ? availableYears[0] : null;

    // Calculate smart default for min matches based on the default year
    const maxMatches = getMaxMatchesPlayed(allMatches, defaultYear);
    const defaultMinMatches = getSmartMinMatchesDefault(maxMatches);

    // Populate filters
    populateYearFilter(availableYears, defaultYear);
    populateMinMatchesFilter(maxMatches, defaultMinMatches);

    // Add event listeners after populating
    document.getElementById('minMatches').addEventListener('change', updateLeaderboardFromFilters);
    document.getElementById('yearFilter').addEventListener('change', () => {
      // When year changes, recalculate min matches options
      const selectedYear = document.getElementById('yearFilter').value || null;
      const newMaxMatches = getMaxMatchesPlayed(allMatches, selectedYear);
      const newDefault = getSmartMinMatchesDefault(newMaxMatches);
      populateMinMatchesFilter(newMaxMatches, newDefault);
      updateLeaderboardFromFilters();
    });

    // Initial render
    renderLeaderboard(defaultYear, defaultMinMatches);
  })
  .catch(err => {
    console.error('Error fetching data:', err);
  });

function renderLeaderboard(filterYear = null, minMatches = 10) {
  const stats = {};
  const recentGames = {};

  allMatches.forEach(match => {
    const dateStr = match['Fecha'];
    const year = dateStr ? dateStr.split('/')[2] : null;

    if (filterYear && Number(year) !== Number(filterYear)) return;

    const winner = match['Equipo Ganador']?.trim();
    const loser = match['Equipo Perdedor']?.trim();
    if (!winner && !loser) return;

    if (winner) {
      if (!stats[winner]) stats[winner] = { wins: 0, total: 0 };
      stats[winner].wins += 1;
      stats[winner].total += 1;
      if (!recentGames[winner]) recentGames[winner] = [];
      recentGames[winner].push('🟢');
    }

    if (loser) {
      if (!stats[loser]) stats[loser] = { wins: 0, total: 0 };
      stats[loser].total += 1;
      if (!recentGames[loser]) recentGames[loser] = [];
      recentGames[loser].push('🔴');
    }
  });

  const result = Object.entries(stats)
    .filter(([_, { total }]) => total >= minMatches)
    .map(([name, { wins, total }]) => {
      const last5 = (recentGames[name] || []).slice(-5).reverse();
      return {
        name,
        wins,
        total,
        percentage: ((wins / total) * 100).toFixed(2),
        last5
      };
    });

  // Sort by % then wins then total matches played
  result.sort((a, b) => b.percentage - a.percentage || b.wins - a.wins || b.total - a.total);

  const tbody = document.getElementById('leaderboardTableBody');
  tbody.innerHTML = '';

  const totalPlayers = result.length;

  result.forEach((player, index) => {
    const row = document.createElement('tr');

    // Add position-based classes
    if (index === 0) {
      row.classList.add('champion');
    } else if (index < 3) {
      row.classList.add('top-position');
    } else if (index >= totalPlayers - 3 && totalPlayers > 6) {
      row.classList.add('bottom-position');
    }

    // Convert last5 emojis to styled boxes
    const last5Html = player.last5.map(result => {
      const isWin = result === '🟢';
      const cssClass = isWin ? 'win' : 'loss';
      const letter = isWin ? 'G' : 'P';
      return `<span class="match-dot ${cssClass}">${letter}</span>`;
    }).join('');

    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${player.name}</td>
      <td>${player.total}</td>
      <td>${player.wins}</td>
      <td>${player.percentage}%</td>
      <td><div class="form-indicator">${last5Html}</div></td>
    `;
    tbody.appendChild(row);
  });
}
