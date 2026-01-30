// Sheet configurations - easy to add more groups later
const SHEETS = {
  maxpato: {
    id: '1xeyqso6EJRlziP1fpVkJnXjxuzT0BU_zy9wPTzKSXYg',
    name: 'Max Pato',
    matchesGid: 0,        // First tab (matches)
    playersGid: 515470337, // Jugadores tab
    // Column mappings - set to null to auto-detect from first row
    columns: null,
    // Domain patterns that should show this group
    domains: ['realmaxpato', 'maxpato']
  },
  gallo: {
    id: '1Gpbz7MRRn_T8TVITS9NKRSQEBmsiLd21hjqhHR2Xqfg',
    name: 'Gallo',
    matchesGid: 0,
    playersGid: 234960034,  // Jugadores 2026 tab
    columns: null,
    domains: ['opengallo', 'gallo']
  }
};

// Auto-detect group based on domain
function detectGroup() {
  const host = window.location.hostname.toLowerCase();

  // Check each group's domain patterns
  for (const [groupId, config] of Object.entries(SHEETS)) {
    if (config.domains && config.domains.some(d => host.includes(d))) {
      return groupId;
    }
  }

  // Default fallback (localhost, etc.)
  return 'maxpato';
}

const CURRENT_GROUP = detectGroup();

// Get the current sheet config
function getCurrentSheet() {
  return SHEETS[CURRENT_GROUP];
}

// Google Apps Script URL (primary - most reliable)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyxEOLozRNaA8D57bfSeKLVnQNF8xcdEnuwuGFeOtLLuLAyWLmtoenWKHeNZuQUjGLN/exec';

// CORS proxies as fallback (in case Apps Script has issues)
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?'
];

// Build Google Apps Script URL
function buildAppsScriptUrl(sheetId, gid = 0) {
  return `${APPS_SCRIPT_URL}?sheetId=${sheetId}&gid=${gid}`;
}

// Build Google Sheets CSV export URL (for fallback)
function buildSheetUrl(sheetId, gid = 0) {
  const cacheBust = Math.floor(Date.now() / 60000);
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}&_=${cacheBust}`;
}

// Build proxied URL
function buildProxiedUrl(url, proxyIndex = 0) {
  const proxy = CORS_PROXIES[proxyIndex];
  return proxy + encodeURIComponent(url);
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

// Parse a single CSV line (handles quoted values with commas and escaped quotes)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Check for escaped quote ("" inside quoted string)
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
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

// Log fetch errors
function logFetchError(error, source, url) {
  console.error(`[Data Fetch Error] Source: ${source}, URL: ${url}, Error:`, error);
}

// Show user-visible error alert
function showDataError(message) {
  // Remove existing error banner if any
  const existing = document.getElementById('data-error-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'data-error-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #dc3545;
    color: white;
    padding: 12px 20px;
    text-align: center;
    z-index: 10000;
    font-weight: 500;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;
  banner.innerHTML = `
    ⚠️ ${message}
    <button onclick="this.parentElement.remove()" style="
      margin-left: 20px;
      background: transparent;
      border: 1px solid white;
      color: white;
      padding: 4px 12px;
      cursor: pointer;
      border-radius: 4px;
    ">Cerrar</button>
  `;
  document.body.prepend(banner);
}

// Validate CSV response
function isValidCSV(text) {
  return text && !text.includes('<!DOCTYPE') && !text.includes('<html') && !text.includes('Invalid sheet');
}

// Fetch data from a Google Sheet (Apps Script primary, CORS proxies fallback)
async function fetchSheetData(sheetId, gid = 0) {
  let lastError = null;

  // Try Google Apps Script first (most reliable)
  try {
    const appsScriptUrl = buildAppsScriptUrl(sheetId, gid);
    console.log('[Data Fetch] Trying Google Apps Script...');

    const response = await fetch(appsScriptUrl);

    if (response.ok) {
      const csvText = await response.text();

      if (isValidCSV(csvText)) {
        console.log('[Data Fetch] Success with Google Apps Script');
        return parseCSV(csvText);
      }
      logFetchError('Invalid response format', 'Apps Script', appsScriptUrl);
    } else {
      logFetchError(`HTTP ${response.status}`, 'Apps Script', appsScriptUrl);
    }
  } catch (error) {
    logFetchError(error, 'Apps Script', APPS_SCRIPT_URL);
    lastError = error;
  }

  // Fallback to CORS proxies
  const baseUrl = buildSheetUrl(sheetId, gid);

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxiedUrl = buildProxiedUrl(baseUrl, i);

    try {
      console.log(`[Data Fetch] Trying fallback proxy ${i + 1}/${CORS_PROXIES.length}: ${CORS_PROXIES[i]}`);

      const response = await fetch(proxiedUrl);

      if (!response.ok) {
        const errorMsg = `HTTP ${response.status} ${response.statusText}`;
        logFetchError(errorMsg, CORS_PROXIES[i], baseUrl);
        lastError = new Error(errorMsg);
        continue;
      }

      const csvText = await response.text();

      if (!isValidCSV(csvText)) {
        logFetchError('Received HTML instead of CSV', CORS_PROXIES[i], baseUrl);
        lastError = new Error('Invalid response format');
        continue;
      }

      console.log(`[Data Fetch] Success with fallback proxy ${i + 1}`);
      return parseCSV(csvText);

    } catch (error) {
      logFetchError(error, CORS_PROXIES[i], baseUrl);
      lastError = error;
    }
  }

  // All methods failed
  console.error('[Data Fetch] All methods failed. Last error:', lastError);
  showDataError('No se pudieron cargar los datos. Por favor, recarga la página o intenta más tarde.');
  throw lastError || new Error('All data fetch methods failed');
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
