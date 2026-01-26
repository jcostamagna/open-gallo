// equipos.js

let allMatches = [];
let playersStats = {}; // name -> { wins, total, percentage, currentYearWins, currentYearTotal, currentYearPercentage, last5 }
let selectedPlayers = new Set(); // Set of selected player names
let guestPlayers = []; // { name, percentage, isGuest: true }
let goalkeepers = new Set(); // Set of goalkeeper names
let selectedYear = null; // The year selected for "Año Actual" calculations
let availableYears = []; // Years available for selection

// Scoring configuration
const SCORING_CONFIG = {
  baseWeights: { overall: 0.35, currentYear: 0.40, form: 0.25 },
  minMatchesForConfidence: 10,
  minCurrentYearMatches: 5,
  formWeights: [0.30, 0.25, 0.20, 0.15, 0.10], // Most recent first
  guestConfidence: 0.6,
  minMatchesForYearOption: 6 // Minimum matches needed to show a year as an option
};

// Get current scoring weights based on toggle state
function getCurrentWeights() {
  const useHistorical = document.getElementById('useHistorical')?.checked ?? true;
  const useCurrentYear = document.getElementById('useCurrentYear')?.checked ?? true;
  const useForm = document.getElementById('useForm')?.checked ?? true;

  const { baseWeights } = SCORING_CONFIG;

  // Calculate active weights
  let overall = useHistorical ? baseWeights.overall : 0;
  let currentYear = useCurrentYear ? baseWeights.currentYear : 0;
  let form = useForm ? baseWeights.form : 0;

  // Normalize to sum to 1
  const total = overall + currentYear + form;
  if (total > 0) {
    overall = overall / total;
    currentYear = currentYear / total;
    form = form / total;
  }

  return { overall, currentYear, form };
}

// Handle toggle change - ensure at least one is selected
function handleToggleChange(changed) {
  const historicalCheckbox = document.getElementById('useHistorical');
  const currentYearCheckbox = document.getElementById('useCurrentYear');
  const formCheckbox = document.getElementById('useForm');

  // Count how many are checked
  const checkedCount = [historicalCheckbox.checked, currentYearCheckbox.checked, formCheckbox.checked]
    .filter(Boolean).length;

  // If user tries to uncheck the last one, revert it
  if (checkedCount === 0) {
    if (changed === 'historical') {
      historicalCheckbox.checked = true;
    } else if (changed === 'currentYear') {
      currentYearCheckbox.checked = true;
    } else {
      formCheckbox.checked = true;
    }
  }
}

// Modal functions
function showScoreInfo() {
  document.getElementById('scoreInfoModal').style.display = 'flex';
}

function hideScoreInfo() {
  document.getElementById('scoreInfoModal').style.display = 'none';
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('scoreInfoModal');
  if (e.target === modal) {
    hideScoreInfo();
  }
});

// Get current year
function getCurrentYear() {
  return new Date().getFullYear();
}

// Extract year from date string (DD/MM/YYYY)
function getYearFromDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return Number(parts[2]);
  }
  return null;
}

// Count matches per year (each row counts as one match, so double matches count as 2)
function countMatchesPerYear(matches) {
  const counts = {};
  matches.forEach(match => {
    const year = getYearFromDate(match.date);
    if (year) {
      counts[year] = (counts[year] || 0) + 1;
    }
  });
  return counts;
}

// Determine which years should be available for selection
function getAvailableYears(matches) {
  const counts = countMatchesPerYear(matches);
  const currentYearValue = getCurrentYear();
  const minMatches = SCORING_CONFIG.minMatchesForYearOption;

  const years = [];

  // Always include current year if it has any matches
  if (counts[currentYearValue] > 0) {
    years.push(currentYearValue);
  }

  // Include previous year only if current year has fewer than minMatches
  // AND previous year has at least minMatches
  const currentYearMatches = counts[currentYearValue] || 0;
  if (currentYearMatches < minMatches) {
    const previousYear = currentYearValue - 1;
    if (counts[previousYear] >= minMatches) {
      years.push(previousYear);
    }
  }

  return years.sort((a, b) => b - a); // Most recent first
}

// Render year selector
function renderYearSelector() {
  const container = document.getElementById('yearSelectorContainer');
  if (!container) return;

  if (availableYears.length <= 1) {
    // Only one year available, hide selector
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  const select = document.getElementById('yearSelector');
  select.innerHTML = availableYears.map(year =>
    `<option value="${year}" ${year === selectedYear ? 'selected' : ''}>${year}</option>`
  ).join('');
}

// Handle year change
function handleYearChange(newYear) {
  selectedYear = parseInt(newYear);
  calculateStats();
  renderAllLists();
}

// Use current year for display
const currentYear = getCurrentYear();

fetchMatchesWithPlayers()
  .then(data => {
    // Process matches - carry forward dates
    let lastDate = null;
    allMatches = data.map(row => {
      if (row['Fecha']) {
        lastDate = row['Fecha'];
      }
      const winner = row['Equipo Ganador']?.trim();
      const loser = row['Equipo Perdedor']?.trim();

      if (!winner && !loser) return null;

      return {
        date: lastDate,
        winner,
        loser
      };
    }).filter(Boolean);

    // Determine available years and set initial selection
    availableYears = getAvailableYears(allMatches);
    selectedYear = availableYears.length > 0 ? availableYears[0] : currentYear;

    calculateStats();
    renderAllLists();
    renderYearSelector();
    setupEventListeners();
  })
  .catch(err => {
    console.error('Error fetching data:', err);
  });

function calculateStats() {
  playersStats = {};
  const recentGames = {}; // Track recent games for last5
  const targetYear = selectedYear || currentYear;

  allMatches.forEach(match => {
    const winner = match.winner;
    const loser = match.loser;
    const year = getYearFromDate(match.date);

    if (!winner && !loser) return;

    // Process winner
    if (winner) {
      if (!playersStats[winner]) {
        playersStats[winner] = {
          wins: 0, total: 0,
          currentYearWins: 0, currentYearTotal: 0
        };
      }
      if (!recentGames[winner]) recentGames[winner] = [];

      playersStats[winner].wins++;
      playersStats[winner].total++;
      recentGames[winner].push('W');

      if (year === targetYear) {
        playersStats[winner].currentYearWins++;
        playersStats[winner].currentYearTotal++;
      }
    }

    // Process loser
    if (loser) {
      if (!playersStats[loser]) {
        playersStats[loser] = {
          wins: 0, total: 0,
          currentYearWins: 0, currentYearTotal: 0
        };
      }
      if (!recentGames[loser]) recentGames[loser] = [];

      playersStats[loser].total++;
      recentGames[loser].push('L');

      if (year === targetYear) {
        playersStats[loser].currentYearTotal++;
      }
    }
  });

  // Calculate percentages and last5
  Object.entries(playersStats).forEach(([name, stats]) => {
    stats.percentage = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : '0.0';
    stats.currentYearPercentage = stats.currentYearTotal > 0
      ? ((stats.currentYearWins / stats.currentYearTotal) * 100).toFixed(1)
      : null;
    stats.last5 = (recentGames[name] || []).slice(-5).reverse();
  });
}

function setupEventListeners() {
  // Team size change
  const teamSizeSelect = document.getElementById('teamSize');
  let previousValue = teamSizeSelect.value;

  teamSizeSelect.addEventListener('change', (e) => {
    const newSize = parseInt(e.target.value);

    if (selectedPlayers.size > newSize) {
      const excess = selectedPlayers.size - newSize;
      alert(`Tienes ${selectedPlayers.size} jugadores seleccionados. Elimina ${excess} jugador${excess > 1 ? 'es' : ''} antes de reducir el total.`);
      // Revert to previous value
      e.target.value = previousValue;
      return;
    }

    previousValue = e.target.value;
    document.getElementById('targetCount').textContent = e.target.value;
  });

  // Search filter
  const searchInput = document.getElementById('searchPlayer');
  const clearBtn = document.getElementById('clearSearch');

  searchInput.addEventListener('input', (e) => {
    filterAvailablePlayers(e.target.value);
    clearBtn.style.display = e.target.value ? 'block' : 'none';
  });

  // Enter key on search - add first visible player and clear search
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const visibleCards = document.querySelectorAll('#availablePlayersList .player-card[style*="flex"], #availablePlayersList .player-card:not([style*="display"])');
      const firstVisible = Array.from(visibleCards).find(card => {
        const style = window.getComputedStyle(card);
        return style.display !== 'none';
      });

      if (firstVisible) {
        const playerName = firstVisible.querySelector('.player-name').textContent;
        selectPlayer(playerName);
        // Clear search
        searchInput.value = '';
        filterAvailablePlayers('');
        clearBtn.style.display = 'none';
      }
    }
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterAvailablePlayers('');
    clearBtn.style.display = 'none';
    searchInput.focus();
  });

  // Guest player - Enter key to add
  const guestNameInput = document.getElementById('guestName');
  const guestPercentageInput = document.getElementById('guestPercentage');

  guestNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addGuestPlayer();
    }
  });

  guestPercentageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addGuestPlayer();
    }
  });
}

function filterAvailablePlayers(searchTerm) {
  const cards = document.querySelectorAll('#availablePlayersList .player-card');
  const term = searchTerm.toLowerCase().trim();

  cards.forEach(card => {
    const playerName = card.querySelector('.player-name').textContent.toLowerCase();
    if (term === '' || playerName.includes(term)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

function renderAllLists() {
  renderSelectedPlayers();
  renderAvailablePlayers();
  updateSelectedCount();
}

function renderSelectedPlayers() {
  const container = document.getElementById('selectedPlayersList');
  container.innerHTML = '';

  // Get all selected players (regular + guests)
  const selected = [];

  // Add selected regular players
  Object.entries(playersStats).forEach(([name, stats]) => {
    if (selectedPlayers.has(name)) {
      selected.push({ name, ...stats, isGuest: false });
    }
  });

  // Add selected guests
  guestPlayers.forEach(guest => {
    if (selectedPlayers.has(guest.name)) {
      selected.push(guest);
    }
  });

  if (selected.length === 0) {
    container.innerHTML = '<div class="empty-message">No hay jugadores seleccionados</div>';
    return;
  }

  // Sort by name alphabetically
  selected.sort((a, b) => a.name.localeCompare(b.name));

  selected.forEach(player => {
    container.appendChild(createPlayerCard(player, true));
  });
}

function renderAvailablePlayers() {
  const container = document.getElementById('availablePlayersList');
  container.innerHTML = '';

  // Get all available players (not selected) - only regular players, guests go directly to selected
  const available = [];

  // Add unselected regular players
  Object.entries(playersStats).forEach(([name, stats]) => {
    if (!selectedPlayers.has(name)) {
      available.push({ name, ...stats, isGuest: false });
    }
  });

  // Sort by name alphabetically
  available.sort((a, b) => a.name.localeCompare(b.name));

  available.forEach(player => {
    container.appendChild(createPlayerCard(player, false));
  });

  // Re-apply search filter if there's a search term
  const searchTerm = document.getElementById('searchPlayer')?.value || '';
  if (searchTerm) {
    filterAvailablePlayers(searchTerm);
  }
}

function createPlayerCard(player, isSelected) {
  const div = document.createElement('div');
  div.className = 'player-card' + (player.isGuest ? ' guest' : '');

  const safeId = player.name.replace(/[^a-zA-Z0-9]/g, '_');

  // Build last 5 form HTML
  let last5Html = '';
  if (player.last5 && player.last5.length > 0) {
    last5Html = player.last5.map(result => {
      const isWin = result === 'W';
      const cssClass = isWin ? 'win' : 'loss';
      const letter = isWin ? 'G' : 'P';
      return `<span class="match-dot ${cssClass}">${letter}</span>`;
    }).join('');
  } else {
    last5Html = '<span class="no-data">-</span>';
  }

  // Build stats display
  let statsHtml = '';
  const displayYear = selectedYear || currentYear;
  if (player.isGuest) {
    statsHtml = `<span class="stats">${player.percentage}% (estimado)</span>`;
  } else {
    const currentYearText = player.currentYearPercentage !== null
      ? `${player.currentYearPercentage}% (${player.currentYearWins}G)`
      : '-';
    statsHtml = `
      <span class="stats">
        ${player.percentage}% (${player.wins}G/${player.total}P)
        <span class="stats-separator">|</span>
        <span class="current-year" title="Año seleccionado">${displayYear}: ${currentYearText}</span>
      </span>
    `;
  }

  // GK checkbox (only for selected players)
  const isGK = goalkeepers.has(player.name);
  const gkHtml = isSelected ? `
    <div class="gk-label" onclick="event.stopPropagation()">
      <input type="checkbox" id="gk-${safeId}" ${isGK ? 'checked' : ''} onchange="toggleGoalkeeper('${player.name}')" />
      <span title="Arquero">GK</span>
    </div>
  ` : '';

  // Action button: X for selected, "Seleccionar" for available
  let actionHtml = '';
  if (isSelected) {
    // For guests, removing also deletes them entirely
    const removeAction = player.isGuest ? 'removeGuest' : 'unselectPlayer';
    actionHtml = `<button class="btn-remove" onclick="event.stopPropagation(); ${removeAction}('${player.name}')" title="Quitar">&times;</button>`;
  } else {
    actionHtml = `<span class="btn-select">Seleccionar</span>`;
  }

  div.innerHTML = `
    <span class="player-name">${player.name}</span>
    ${statsHtml}
    <div class="form-indicator-small">${last5Html}</div>
    ${gkHtml}
    ${actionHtml}
  `;

  // Make the whole card clickable for available players
  if (!isSelected) {
    div.style.cursor = 'pointer';
    div.addEventListener('click', () => selectPlayer(player.name));
  }

  return div;
}

function getTargetSize() {
  return parseInt(document.getElementById('teamSize').value);
}

function selectPlayer(name) {
  const targetSize = getTargetSize();

  if (selectedPlayers.size >= targetSize) {
    alert(`Ya tienes ${targetSize} jugadores seleccionados. No puedes agregar más.`);
    return;
  }

  selectedPlayers.add(name);
  renderAllLists();
}

function unselectPlayer(name) {
  selectedPlayers.delete(name);
  goalkeepers.delete(name); // Also remove from goalkeepers if was GK
  renderAllLists();
}

function toggleGoalkeeper(name) {
  if (goalkeepers.has(name)) {
    goalkeepers.delete(name);
  } else {
    // Max 2 goalkeepers allowed
    if (goalkeepers.size >= 2) {
      alert('Solo puedes seleccionar máximo 2 arqueros.');
      // Uncheck the checkbox
      const safeId = name.replace(/[^a-zA-Z0-9]/g, '_');
      const checkbox = document.getElementById(`gk-${safeId}`);
      if (checkbox) checkbox.checked = false;
      return;
    }
    goalkeepers.add(name);
  }
}

function updateSelectedCount() {
  document.getElementById('selectedCount').textContent = selectedPlayers.size;
}

function addGuestPlayer() {
  const nameInput = document.getElementById('guestName');
  const percentageInput = document.getElementById('guestPercentage');

  const name = nameInput.value.trim();
  const percentage = parseFloat(percentageInput.value);

  if (!name) {
    alert('Ingresa el nombre del jugador');
    return;
  }

  if (isNaN(percentage) || percentage < 0 || percentage > 100) {
    alert('Ingresa un porcentaje válido (0-100)');
    return;
  }

  // Check if name already exists
  if (playersStats[name] || guestPlayers.find(g => g.name === name)) {
    alert('Ya existe un jugador con ese nombre');
    return;
  }

  // Check if we can add more players
  const targetSize = getTargetSize();
  if (selectedPlayers.size >= targetSize) {
    alert(`Ya tienes ${targetSize} jugadores seleccionados. No puedes agregar más.`);
    return;
  }

  const guest = {
    name,
    percentage: percentage.toFixed(1),
    wins: 0,
    total: 0,
    currentYearWins: 0,
    currentYearTotal: 0,
    currentYearPercentage: null,
    last5: [],
    isGuest: true
  };

  guestPlayers.push(guest);

  // Add guest directly to selected players
  selectedPlayers.add(name);

  // Clear inputs
  nameInput.value = '';
  percentageInput.value = '';

  // Re-render all lists
  renderAllLists();
}

function removeGuest(name) {
  guestPlayers = guestPlayers.filter(g => g.name !== name);
  selectedPlayers.delete(name);
  goalkeepers.delete(name);
  renderAllLists();
}

// Calculate group statistics (min, max, avg) from regular players
function calculateGroupStats(players) {
  const regularPlayers = players.filter(p => !p.isGuest);
  if (regularPlayers.length === 0) {
    return { min: 50, max: 50, avg: 50 };
  }

  const scores = regularPlayers.map(p => p.rawScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  return { min, max, avg };
}

// Calculate weighted form score from last 5 matches
function calculateFormScore(last5) {
  if (!last5 || last5.length === 0) {
    return 50; // Neutral if no data
  }

  const weights = SCORING_CONFIG.formWeights;
  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < last5.length && i < weights.length; i++) {
    const value = last5[i] === 'W' ? 100 : 0;
    weightedSum += value * weights[i];
    totalWeight += weights[i];
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 50;
}

// Calculate confidence factor based on number of matches
function calculateConfidence(player) {
  if (player.isGuest) {
    return SCORING_CONFIG.guestConfidence;
  }

  const total = player.total || 0;
  const minMatches = SCORING_CONFIG.minMatchesForConfidence;

  if (total >= minMatches) {
    return 1.0;
  }

  // Linear scale from 50% to 100% based on matches played
  return 0.5 + (0.5 * total / minMatches);
}

// Calculate combined player score
function calculatePlayerScore(player, groupStats) {
  if (player.isGuest) {
    return scaleGuestScore(parseFloat(player.percentage), groupStats);
  }

  const overall = parseFloat(player.percentage) || 0;
  const currentYear = player.currentYearPercentage !== null
    ? parseFloat(player.currentYearPercentage)
    : overall; // Fallback to overall if no current year data
  const formScore = calculateFormScore(player.last5);

  // Get dynamic weights based on toggle state
  const weights = getCurrentWeights();
  const rawScore = (overall * weights.overall) +
                   (currentYear * weights.currentYear) +
                   (formScore * weights.form);

  // Apply confidence factor (regress toward group mean)
  const confidence = calculateConfidence(player);
  const groupMean = groupStats.avg;

  return (rawScore * confidence) + (groupMean * (1 - confidence));
}

// Scale guest percentage to group's range
function scaleGuestScore(guestPct, groupStats) {
  const { min, max, avg } = groupStats;

  // 0% -> min, 50% -> avg, 100% -> max
  if (guestPct <= 50) {
    // Interpolate between min and avg
    return min + (avg - min) * (guestPct / 50);
  } else {
    // Interpolate between avg and max
    return avg + (max - avg) * ((guestPct - 50) / 50);
  }
}

// Local optimization: try swapping players to reduce difference
function localOptimization(team1, team2, maxIterations = 100) {
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    const sum1 = team1.reduce((s, p) => s + p.score, 0);
    const sum2 = team2.reduce((s, p) => s + p.score, 0);
    const currentDiff = Math.abs(sum1 - sum2);

    // Try swapping each non-GK pair
    for (let i = 0; i < team1.length && !improved; i++) {
      if (team1[i].isGK) continue;

      for (let j = 0; j < team2.length && !improved; j++) {
        if (team2[j].isGK) continue;

        // Calculate new difference if we swap
        const newSum1 = sum1 - team1[i].score + team2[j].score;
        const newSum2 = sum2 - team2[j].score + team1[i].score;
        const newDiff = Math.abs(newSum1 - newSum2);

        if (newDiff < currentDiff - 0.01) { // Small threshold to avoid floating point issues
          // Perform the swap
          const temp = team1[i];
          team1[i] = team2[j];
          team2[j] = temp;
          improved = true;
        }
      }
    }
  }

  return { team1, team2 };
}

// Main team balancing algorithm
function balanceTeams(scoredPlayers) {
  const gks = scoredPlayers.filter(p => p.isGK);
  const nonGks = scoredPlayers.filter(p => !p.isGK);

  // Sort non-GKs by score (descending), with name as tiebreaker for determinism
  nonGks.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  let team1 = [];
  let team2 = [];

  // Step 1: Handle goalkeepers
  if (gks.length === 2) {
    // Assign better GK to team that will need balance, with name as tiebreaker
    gks.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    team1.push(gks[0]);
    team2.push(gks[1]);
  } else if (gks.length === 1) {
    team1.push(gks[0]);
  }

  // Step 2 & 3: Differential pairing with greedy assignment
  const pairs = [];
  let left = 0;
  let right = nonGks.length - 1;

  while (left < right) {
    pairs.push([nonGks[left], nonGks[right]]);
    left++;
    right--;
  }

  // Middle player (if odd count)
  const middlePlayer = left === right ? nonGks[left] : null;

  // Assign pairs greedily
  for (const [high, low] of pairs) {
    const sum1 = team1.reduce((s, p) => s + p.score, 0);
    const sum2 = team2.reduce((s, p) => s + p.score, 0);

    if (sum1 <= sum2) {
      team1.push(high);
      team2.push(low);
    } else {
      team2.push(high);
      team1.push(low);
    }
  }

  // Step 4: Assign middle player to team with lower total
  if (middlePlayer) {
    const sum1 = team1.reduce((s, p) => s + p.score, 0);
    const sum2 = team2.reduce((s, p) => s + p.score, 0);

    if (sum1 <= sum2) {
      team1.push(middlePlayer);
    } else {
      team2.push(middlePlayer);
    }
  }

  // Step 5: Local optimization
  const optimized = localOptimization(team1, team2);

  return optimized;
}

// Display the generated teams
function displayTeams(team1, team2) {
  const container = document.getElementById('teamsResult');
  container.style.display = 'block';

  // Sort each team by score (descending) for display, with name as tiebreaker
  team1.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  team2.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const sum1 = team1.reduce((s, p) => s + p.score, 0);
  const sum2 = team2.reduce((s, p) => s + p.score, 0);
  const diff = Math.abs(sum1 - sum2);

  // Determine balance quality
  let balanceClass = 'balance-good';
  let balanceText = 'Excelente';
  if (diff > 10) {
    balanceClass = 'balance-poor';
    balanceText = 'Desbalanceado';
  } else if (diff > 5) {
    balanceClass = 'balance-ok';
    balanceText = 'Aceptable';
  }

  // Build HTML
  const createTeamHtml = (team, teamNum, total) => {
    const playersHtml = team.map(p => `
      <div class="team-player-card ${p.isGuest ? 'guest' : ''} ${p.isGK ? 'goalkeeper' : ''}">
        <span class="team-player-name">${p.name}</span>
        ${p.isGK ? '<span class="gk-badge">GK</span>' : ''}
        <span class="team-player-score">${p.score.toFixed(1)}</span>
      </div>
    `).join('');

    return `
      <div class="team-column">
        <h3>Equipo ${teamNum} <span class="team-score">(${total.toFixed(1)} pts)</span></h3>
        <div class="team-players">${playersHtml}</div>
      </div>
    `;
  };

  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">Equipos Generados</span>
      <div class="header-actions">
        <span class="balance-indicator ${balanceClass}">Diferencia: ${diff.toFixed(1)} pts - ${balanceText}</span>
        <button onclick="shareTeams()" class="btn-share" title="Compartir equipos">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
        </button>
      </div>
    </div>
    <div id="teamsCapture" class="teams-capture">
      <div class="teams-container">
        ${createTeamHtml(team1, 1, sum1)}
        ${createTeamHtml(team2, 2, sum2)}
      </div>
    </div>
  `;

  // Scroll to results
  container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Share teams as image
async function shareTeams() {
  const captureElement = document.getElementById('teamsCapture');
  const shareBtn = document.querySelector('.btn-share');

  if (!captureElement) return;

  // Show loading state
  shareBtn.disabled = true;
  shareBtn.innerHTML = '<span class="share-loading"></span>';

  try {
    // Capture the teams as an image
    const canvas = await html2canvas(captureElement, {
      backgroundColor: '#062117',
      scale: 2, // Higher quality
      logging: false,
      useCORS: true
    });

    // Convert to blob
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'equipos.png', { type: 'image/png' });

    // Check if Web Share API is available and supports files
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Equipos Generados',
        text: 'Equipos para el partido'
      });
    } else {
      // Fallback: download the image
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'equipos.png';
      link.href = url;
      link.click();
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Error sharing:', err);
      // Fallback to download on error
      try {
        const canvas = await html2canvas(captureElement, {
          backgroundColor: '#062117',
          scale: 2,
          logging: false
        });
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'equipos.png';
        link.href = url;
        link.click();
      } catch (downloadErr) {
        alert('No se pudo compartir. Intenta de nuevo.');
      }
    }
  } finally {
    // Restore button
    shareBtn.disabled = false;
    shareBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
      </svg>
    `;
  }

function generateTeams() {
  const targetSize = parseInt(document.getElementById('teamSize').value);

  if (selectedPlayers.size !== targetSize) {
    alert(`Selecciona exactamente ${targetSize} jugadores. Actualmente tienes ${selectedPlayers.size} seleccionados.`);
    return;
  }

  // Collect selected players with their data
  const players = [];

  selectedPlayers.forEach(name => {
    const isGK = goalkeepers.has(name);

    if (playersStats[name]) {
      const stats = playersStats[name];
      players.push({
        name,
        isGK,
        isGuest: false,
        percentage: stats.percentage,
        currentYearPercentage: stats.currentYearPercentage,
        currentYearTotal: stats.currentYearTotal,
        last5: stats.last5,
        total: stats.total,
        rawScore: parseFloat(stats.percentage) || 0
      });
    } else {
      const guest = guestPlayers.find(g => g.name === name);
      if (guest) {
        players.push({
          name,
          isGK,
          isGuest: true,
          percentage: guest.percentage,
          currentYearPercentage: null,
          last5: [],
          total: 0,
          rawScore: parseFloat(guest.percentage) || 50
        });
      }
    }
  });

  // First pass: calculate raw scores for regular players to get group stats
  const groupStats = calculateGroupStats(players);

  // Second pass: calculate final scores for all players
  const scoredPlayers = players.map(player => ({
    ...player,
    score: calculatePlayerScore(player, groupStats)
  }));

  // Balance teams
  const { team1, team2 } = balanceTeams(scoredPlayers);

  // Display results
  displayTeams(team1, team2);
}
