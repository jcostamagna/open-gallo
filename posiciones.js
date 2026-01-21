let allMatches = [];

function updateLeaderboardFromFilters() {
  const year = document.getElementById('yearFilter')?.value || null;
  const minMatches = parseInt(document.getElementById('minMatches').value) || 0;
  renderLeaderboard(year, minMatches);
}

document.getElementById('minMatches').addEventListener('input', updateLeaderboardFromFilters);
document.getElementById('yearFilter')?.addEventListener('change', updateLeaderboardFromFilters);

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

    // Initial render
    const defaultYear = document.getElementById('yearFilter')?.value || null;
    const defaultMinMatches = parseInt(document.getElementById('minMatches')?.value) || 5;
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

  // Sort by % then wins
  result.sort((a, b) => b.percentage - a.percentage || b.wins - a.wins);

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
