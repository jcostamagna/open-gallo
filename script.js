let allMatches = [];

// Extract unique years from matches data
function getAvailableYears(matches) {
  const years = new Set();
  matches.forEach(match => {
    const dateStr = match.date;
    if (dateStr) {
      const year = dateStr.split('/')[2];
      if (year && !isNaN(year)) {
        years.add(Number(year));
      }
    }
  });
  return Array.from(years).sort((a, b) => b - a); // Descending order (newest first)
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

// Render matches filtered by year
function renderMatches(filterYear = null) {
  const container = document.getElementById('matchesContainer');
  container.innerHTML = '';

  // Filter matches by year if specified
  const filteredMatches = filterYear
    ? allMatches.filter(match => {
        const year = match.date ? match.date.split('/')[2] : null;
        return Number(year) === Number(filterYear);
      })
    : allMatches;

  // Group by date
  const matchesByDate = {};
  filteredMatches.forEach(match => {
    const matchDate = match.date || 'Sin fecha';
    if (!matchesByDate[matchDate]) {
      matchesByDate[matchDate] = [];
    }
    matchesByDate[matchDate].push(match);
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
}

// Fetch and display matches grouped by date (filtered by valid players)
fetchMatchesWithPlayers()
  .then(matchesData => {
    // Process matches - carry forward dates for rows without dates
    let lastDate = null;
    allMatches = matchesData
      .map(match => {
        const date = match['Fecha']?.trim();
        const winner = match['Equipo Ganador']?.trim();
        const loser = match['Equipo Perdedor']?.trim();

        // Use last known date if this row doesn't have one
        if (date) lastDate = date;

        // Skip empty matches
        if (!winner && !loser) return null;

        return {
          date: lastDate || 'Sin fecha',
          winner,
          loser
        };
      })
      .filter(Boolean);

    // Get available years and set default to latest
    const availableYears = getAvailableYears(allMatches);
    const defaultYear = availableYears.length > 0 ? availableYears[0] : null;

    // Populate year filter
    populateYearFilter(availableYears, defaultYear);

    // Add event listener
    document.getElementById('yearFilter').addEventListener('change', () => {
      const selectedYear = document.getElementById('yearFilter').value || null;
      renderMatches(selectedYear);
    });

    // Initial render with default year
    renderMatches(defaultYear);
  })
  .catch(err => {
    console.error('Error fetching data:', err);
  });
