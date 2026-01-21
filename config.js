// Sheet configurations - easy to add more groups later
const SHEETS = {
  maxpato: {
    id: '1xeyqso6EJRlziP1fpVkJnXjxuzT0BU_zy9wPTzKSXYg',
    name: 'Max Pato',
    matchesGid: 0,        // First tab (matches)
    playersGid: 515470337, // Jugadores tab
    // Column mappings - set to null to auto-detect from first row
    columns: null
  },
  gallo: {
    id: '1Gpbz7MRRn_T8TVITS9NKRSQEBmsiLd21hjqhHR2Xqfg',
    name: 'Gallo',
    matchesGid: 0,
    playersGid: null,
    columns: null
  }
};

// Default group - change this to switch between groups
const CURRENT_GROUP = 'maxpato';

// Get the current sheet config
function getCurrentSheet() {
  return SHEETS[CURRENT_GROUP];
}

// CORS proxy to bypass browser restrictions
const CORS_PROXY = 'https://corsproxy.io/?';

// Build Google Sheets CSV export URL (with CORS proxy)
function buildSheetUrl(sheetId, gid = 0) {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  return CORS_PROXY + encodeURIComponent(sheetUrl);
}

// Parse CSV text to array of objects
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }

  return data;
}

// Parse a single CSV line (handles quoted values with commas)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

// Fetch data from a Google Sheet
async function fetchSheetData(sheetId, gid = 0) {
  const url = buildSheetUrl(sheetId, gid);
  const response = await fetch(url);
  const csvText = await response.text();
  return parseCSV(csvText);
}

// Auto-detect column names from headers
function detectColumns(headers) {
  const lower = headers.map(h => h.toLowerCase());

  // Common patterns for each field
  const datePatterns = ['fecha', 'date', 'dia', 'día'];
  const winnerPatterns = ['equipo ganador', 'ganador', 'winner', 'winning team', 'equipo 1', 'team 1'];
  const loserPatterns = ['equipo perdedor', 'perdedor', 'loser', 'losing team', 'equipo 2', 'team 2'];

  const findColumn = (patterns) => {
    for (const pattern of patterns) {
      const index = lower.findIndex(h => h.includes(pattern));
      if (index !== -1) return headers[index];
    }
    return null;
  };

  return {
    date: findColumn(datePatterns),
    winner: findColumn(winnerPatterns),
    loser: findColumn(loserPatterns)
  };
}

// Normalize data to use consistent field names
function normalizeMatches(data, columns) {
  return data.map(row => ({
    'Fecha': columns.date ? row[columns.date] : '',
    'Equipo Ganador': columns.winner ? row[columns.winner] : '',
    'Equipo Perdedor': columns.loser ? row[columns.loser] : ''
  }));
}

// Fetch matches for the current group
async function fetchMatches() {
  const sheet = getCurrentSheet();
  const rawData = await fetchSheetData(sheet.id, sheet.matchesGid);

  if (rawData.length === 0) return [];

  // Get columns from config or auto-detect from headers
  const headers = Object.keys(rawData[0]);
  const columns = sheet.columns || detectColumns(headers);

  console.log('Detected columns:', columns);

  return normalizeMatches(rawData, columns);
}

// Fetch players for the current group (if separate tab exists)
async function fetchPlayers() {
  const sheet = getCurrentSheet();
  if (sheet.playersGid !== null) {
    return fetchSheetData(sheet.id, sheet.playersGid);
  }
  return null;
}

// Get set of valid player names from the Jugadores tab
async function getValidPlayers() {
  const playersData = await fetchPlayers();
  if (!playersData || playersData.length === 0) return null;

  // Auto-detect player column (look for "Jugador", "Nombre", "Player", etc.)
  const headers = Object.keys(playersData[0]);
  const playerPatterns = ['jugador', 'nombre', 'player', 'name'];

  let playerColumn = headers[0]; // Default to first column
  for (const pattern of playerPatterns) {
    const found = headers.find(h => h.toLowerCase().includes(pattern));
    if (found) {
      playerColumn = found;
      break;
    }
  }

  console.log('Player column detected:', playerColumn);

  // Extract unique player names
  const validPlayers = new Set();
  playersData.forEach(row => {
    const name = row[playerColumn]?.trim();
    if (name) validPlayers.add(name);
  });

  console.log('Valid players:', validPlayers);
  return validPlayers;
}

// Fetch matches filtered by valid players
async function fetchMatchesWithPlayers() {
  const [matches, validPlayers] = await Promise.all([
    fetchMatches(),
    getValidPlayers()
  ]);

  if (!validPlayers) return matches; // No player filter

  // Filter matches to only include valid players
  return matches.filter(match => {
    const winner = match['Equipo Ganador']?.trim();
    const loser = match['Equipo Perdedor']?.trim();
    return validPlayers.has(winner) || validPlayers.has(loser);
  });
}
