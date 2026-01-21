// Fetch and display matches grouped by date (filtered by valid players)
fetchMatchesWithPlayers()
  .then(matchesData => {
    const container = document.getElementById('matchesContainer');

    // Filter out empty rows and group by date
    const matchesByDate = {};
    let lastDate = null;

    matchesData.forEach(match => {
      const date = match['Fecha']?.trim();
      const winner = match['Equipo Ganador']?.trim();
      const loser = match['Equipo Perdedor']?.trim();

      // Use last known date if this row doesn't have one
      if (date) lastDate = date;
      const matchDate = lastDate || 'Sin fecha';

      // Skip empty matches
      if (!winner && !loser) return;

      if (!matchesByDate[matchDate]) {
        matchesByDate[matchDate] = [];
      }
      matchesByDate[matchDate].push({ winner, loser });
    });

    // Sort dates (most recent first)
    const sortedDates = Object.keys(matchesByDate).sort((a, b) => {
      const parseDate = (d) => {
        if (d === 'Sin fecha') return new Date(0);
        const parts = d.split('/');
        if (parts.length === 3) {
          return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return new Date(d);
      };
      return parseDate(b) - parseDate(a);
    });

    // Render grouped matches
    sortedDates.forEach(date => {
      const group = document.createElement('div');
      group.className = 'date-group';

      const header = document.createElement('div');
      header.className = 'date-header';
      header.textContent = date;
      group.appendChild(header);

      matchesByDate[date].forEach(match => {
        const row = document.createElement('div');
        row.className = 'match-row';
        row.innerHTML = `
          <span class="winner">${match.winner || '-'}</span>
          <span class="vs">vs</span>
          <span class="loser">${match.loser || '-'}</span>
        `;
        group.appendChild(row);
      });

      container.appendChild(group);
    });
  })
  .catch(err => {
    console.error('Error fetching data:', err);
  });
