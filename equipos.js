// equipos.js

let allMatches = [];
let playersStats = {}; // name -> { wins, total, percentage }

fetchMatchesWithPlayers()
  .then(data => {
    allMatches = data.filter(match => match['Equipo Ganador'] || match['Equipo Perdedor']);
    calculateStats();
    renderPlayers();
  })
  .catch(err => {
    console.error('Error fetching data:', err);
  });

function calculateStats() {
  playersStats = {};

  allMatches.forEach(match => {
    const winner = match['Equipo Ganador']?.trim();
    const loser = match['Equipo Perdedor']?.trim();
    if (!winner && !loser) return;

    if (winner) {
      if (!playersStats[winner]) playersStats[winner] = { wins: 0, total: 0 };
      playersStats[winner].wins++;
      playersStats[winner].total++;
    }
    if (loser) {
      if (!playersStats[loser]) playersStats[loser] = { wins: 0, total: 0 };
      playersStats[loser].total++;
    }
  });

  Object.entries(playersStats).forEach(([name, stats]) => {
    stats.percentage = ((stats.wins / stats.total) * 100).toFixed(1);
  });
}

function renderPlayers() {
  const container = document.getElementById("playersList");
  container.innerHTML = "";

  // Sort by percentage descending
  const sortedPlayers = Object.entries(playersStats)
    .sort((a, b) => b[1].percentage - a[1].percentage);

  sortedPlayers.forEach(([name, { percentage, total }]) => {
    const div = document.createElement("div");
    div.className = "player-card";

    // Create safe ID from name (remove special chars)
    const safeId = name.replace(/[^a-zA-Z0-9]/g, '_');

    div.innerHTML = `
      <input type="checkbox" id="check-${safeId}" data-player="${name}" onchange="toggleGK('${safeId}')" />
      <label for="check-${safeId}">${name}</label>
      <span class="stats">${percentage}% · ${total} partidos</span>
      <div class="gk-label">
        <input type="checkbox" id="gk-${safeId}" data-gk="${name}" disabled />
        <span title="Arquero">GK</span>
      </div>
    `;
    container.appendChild(div);
  });
}

function toggleGK(safeId) {
  const mainCheckbox = document.getElementById(`check-${safeId}`);
  const gkCheckbox = document.getElementById(`gk-${safeId}`);

  gkCheckbox.disabled = !mainCheckbox.checked;
  if (!mainCheckbox.checked) gkCheckbox.checked = false;
}

function generateTeams() {
  const selectedPlayers = [];
  const goalkeepers = [];

  Object.keys(playersStats).forEach(name => {
    const safeId = name.replace(/[^a-zA-Z0-9]/g, '_');
    const playerCheckbox = document.getElementById(`check-${safeId}`);
    const gkCheckbox = document.getElementById(`gk-${safeId}`);

    if (playerCheckbox && playerCheckbox.checked) {
      selectedPlayers.push(name);
      if (gkCheckbox && gkCheckbox.checked) goalkeepers.push(name);
    }
  });

  alert(`Jugadores seleccionados: ${selectedPlayers.join(', ')}\nArqueros: ${goalkeepers.join(', ')}`);
}
