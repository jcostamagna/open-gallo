# Open Gallo

A lightweight web app to track and display match results and player standings from Google Sheets data. Perfect for sports leagues, gaming groups, or any competitive activity where you want to track wins/losses.

## Features

- **Match History**: View all matches grouped by date, with winners and losers clearly displayed
- **Leaderboard**: Dynamic standings table with win percentages, filtered by year
- **Team Stats**: View player participation across teams
- **Multi-group Support**: Easily configure multiple groups/leagues with different data sources
- **Smart Defaults**: Automatically detects available years and sets sensible filter defaults

## How It Works

The app reads data directly from public Google Sheets (no backend required). Just configure your sheet IDs and the app fetches match data in real-time.

### Data Format

Your Google Sheet should have columns for:
- **Fecha** (Date) - format: DD/MM/YYYY
- **Equipo Ganador** (Winner)
- **Equipo Perdedor** (Loser)

The app auto-detects column names, so variations like "Ganador", "Winner", "Winning Team" will also work.

## Setup

1. **Create a Google Sheet** with your match data
2. **Make it public**: File → Share → "Anyone with the link can view"
3. **Get the Sheet ID** from the URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`
4. **Configure** `config.js` with your sheet details:

```javascript
const SHEETS = {
  mygroup: {
    id: 'YOUR_SHEET_ID_HERE',
    name: 'My Group Name',
    matchesGid: 0,        // Tab index for matches (0 = first tab)
    playersGid: 12345,    // Tab GID for players list (optional)
    columns: null         // Auto-detect columns
  }
};

const CURRENT_GROUP = 'mygroup';
```

## Project Structure

```
open-gallo/
├── index.html      # Match history page
├── posiciones.html # Leaderboard/standings page
├── equipos.html    # Team statistics page
├── config.js       # Sheet configuration and data fetching
├── script.js       # Match history logic
├── posiciones.js   # Leaderboard logic with dynamic filters
├── equipos.js      # Team statistics logic
└── styles.css      # Styling
```

## Deployment

This is a static site - deploy it anywhere:

- **GitHub Pages**: Push to a repo and enable Pages in settings
- **Netlify/Vercel**: Connect your repo for automatic deploys
- **Any web server**: Just upload the files

## Configuration Options

### Multiple Groups

Add multiple groups in `config.js` and switch between them:

```javascript
const SHEETS = {
  group1: { id: '...', name: 'Group 1', ... },
  group2: { id: '...', name: 'Group 2', ... }
};

const CURRENT_GROUP = 'group1'; // Change this to switch
```

### Player Filtering

If you have a separate "Players" tab in your sheet, configure `playersGid` to filter matches to only include registered players.

## License

MIT
