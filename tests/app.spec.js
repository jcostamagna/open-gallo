// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Open Gallo Tests', () => {

  test('all unit and integration tests pass', async ({ page }) => {
    // Go to the tests page
    await page.goto('/tests.html');

    // Wait for live tests to complete (they're async)
    // The summary updates after all tests run
    await page.waitForFunction(() => {
      const summary = document.getElementById('summary');
      return summary && summary.textContent.includes('Total:');
    }, { timeout: 15000 });

    // Check the summary for failures
    const summary = await page.locator('#summary');
    const summaryText = await summary.textContent();

    // Extract pass/fail counts
    const passedMatch = summaryText.match(/Passed: (\d+)/);
    const failedMatch = summaryText.match(/Failed: (\d+)/);

    const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0;

    console.log(`Tests completed: ${passed} passed, ${failed} failed`);

    // If there are failures, get the details
    if (failed > 0) {
      const failedTests = await page.locator('.test.fail').all();
      console.log('\nFailed tests:');
      for (const testEl of failedTests) {
        const testName = await testEl.textContent();
        console.log(`  - ${testName.split('\n')[0]}`);
      }
    }

    // Assert no failures
    expect(failed, `${failed} tests failed`).toBe(0);
    expect(passed).toBeGreaterThan(0);
  });

  test('main page loads without errors', async ({ page }) => {
    // Listen for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/index.html');

    // Wait for data to load
    await page.waitForTimeout(3000);

    // Filter out expected errors (like CORS if running locally)
    const criticalErrors = errors.filter(e =>
      !e.includes('CORS') &&
      !e.includes('favicon') &&
      !e.includes('net::ERR')
    );

    expect(criticalErrors, `Console errors: ${criticalErrors.join(', ')}`).toHaveLength(0);
  });

  test('equipos page loads and shows player list', async ({ page }) => {
    // The real data comes from a Google Apps Script endpoint that is slow and
    // intermittently stalls on its redirect, which made this test flaky.
    // Serve fixture CSVs instead so the test only checks the page itself.
    // Live fetching is covered by the "LIVE API TESTS" in tests.html.
    const matchesCsv = [
      'Fecha,Equipo Ganador,Equipo Perdedor,',
      '31/07/2025,Mati,Alejo,',
      ',Chiqui,Trapa,',
      '07/08/2025,Trapa,Mati,',
      ',Alejo,Chiqui,',
    ].join('\n');
    const playersCsv = [
      'Jugador,Jugados,Ganados,% Ganados',
      'Alejo,2,1,0.5',
      'Mati,2,1,0.5',
      'Trapa,2,1,0.5',
      'Chiqui,2,1,0.5',
    ].join('\n');

    await page.route('**/script.google.com/**', route => {
      const gid = new URL(route.request().url()).searchParams.get('gid');
      // gid 0 is the matches tab, anything else is the players tab
      const body = gid === '0' ? matchesCsv : playersCsv;
      route.fulfill({ status: 200, contentType: 'text/csv', body });
    });

    await page.goto('/equipos.html');

    await page.waitForSelector('#availablePlayersList .player-card', { timeout: 10000 });

    const playerCards = await page.locator('#availablePlayersList .player-card').count();
    expect(playerCards).toBe(4);
  });

  test.describe('filters survive a background data refresh', () => {
    // Two years of fixture data so every page shows a year selector.
    // The teams page only offers the previous year when the current year has
    // fewer than 6 match dates and the previous one has at least 6.
    const year = new Date().getFullYear();
    const matchDay = (date, pairs) => [`${date},${pairs[0]},`, ...pairs.slice(1).map(p => `,${p},`)];
    const previousYearDates = ['05/03', '12/03', '19/03', '26/03', '02/04', '09/04'];
    const matchesCsv = [
      'Fecha,Equipo Ganador,Equipo Perdedor,',
      ...previousYearDates.flatMap(d => matchDay(`${d}/${year - 1}`, ['Mati,Alejo', 'Chiqui,Trapa', 'Enzo,Juan'])),
      ...matchDay(`05/02/${year}`, ['Alejo,Mati', 'Trapa,Chiqui', 'Juan,Enzo']),
    ].join('\n');
    const playersCsv = [
      'Jugador,Jugados,Ganados,% Ganados',
      'Alejo,3,1,0.33', 'Mati,3,2,0.66', 'Trapa,3,1,0.33',
      'Chiqui,3,2,0.66', 'Enzo,3,2,0.66', 'Juan,3,1,0.33',
    ].join('\n');

    async function mockSheets(page) {
      await page.route('**/script.google.com/**', route => {
        const gid = new URL(route.request().url()).searchParams.get('gid');
        route.fulfill({ status: 200, contentType: 'text/csv', body: gid === '0' ? matchesCsv : playersCsv });
      });
    }

    // Simulates the stale-while-revalidate cache delivering fresh data
    async function triggerRefresh(page) {
      await page.evaluate(() => onDataRefreshed());
      await page.waitForTimeout(300);
    }

    test('posiciones keeps year and min matches', async ({ page }) => {
      await mockSheets(page);
      await page.goto('/index.html');
      await page.waitForSelector('#leaderboardTableBody tr');

      // Defaults: latest year, smart min matches
      await expect(page.locator('#yearFilter')).toHaveValue(String(year));

      await page.selectOption('#yearFilter', String(year - 1));
      await page.selectOption('#minMatches', '1');
      await triggerRefresh(page);

      await expect(page.locator('#yearFilter')).toHaveValue(String(year - 1));
      await expect(page.locator('#minMatches')).toHaveValue('1');
    });

    test('partidos keeps "Todos"', async ({ page }) => {
      await mockSheets(page);
      await page.goto('/partidos.html');
      await page.waitForSelector('#matchesContainer .match-row');

      await expect(page.locator('#yearFilter')).toHaveValue(String(year));

      await page.selectOption('#yearFilter', '');
      await triggerRefresh(page);

      await expect(page.locator('#yearFilter')).toHaveValue('');
    });

    test('equipos keeps the selected year', async ({ page }) => {
      await mockSheets(page);
      await page.goto('/equipos.html');
      await page.waitForSelector('#availablePlayersList .player-card');

      await expect(page.locator('#yearSelector')).toHaveValue(String(year));

      await page.selectOption('#yearSelector', String(year - 1));
      await triggerRefresh(page);

      await expect(page.locator('#yearSelector')).toHaveValue(String(year - 1));
    });
  });

  test.describe('red positions are per group', () => {
    // Eight players so the red tail can never reach the green podium
    const names = ['Alejo', 'Mati', 'Trapa', 'Chiqui', 'Enzo', 'Juan', 'Nico', 'Seba'];
    const year = new Date().getFullYear();

    // One match per date, so every player ends on a different win count and
    // the leaderboard ordering is deterministic
    const winnerOrder = ['Alejo', 'Mati', 'Trapa', 'Chiqui', 'Enzo', 'Juan', 'Nico'];
    const matchesCsv = [
      'Fecha,Equipo Ganador,Equipo Perdedor,',
      ...winnerOrder.map((winner, i) => {
        const day = String(i + 1).padStart(2, '0');
        const loser = names[(names.indexOf(winner) + 1) % names.length];
        return `${day}/02/${year},${winner},${loser},`;
      }),
    ].join('\n');
    const playersCsv = ['Jugador,Jugados,Ganados,% Ganados', ...names.map(n => `${n},2,1,0.5`)].join('\n');

    async function mockSheets(page) {
      await page.route('**/script.google.com/**', route => {
        const gid = new URL(route.request().url()).searchParams.get('gid');
        route.fulfill({ status: 200, contentType: 'text/csv', body: gid === '0' ? matchesCsv : playersCsv });
      });
    }

    // Row indexes that received the red bottom highlight
    function redIndexes(page) {
      return page.$$eval('#leaderboardTableBody tr', rows =>
        rows.map((row, i) => (row.classList.contains('bottom-position') ? i : null)).filter(i => i !== null)
      );
    }

    test('gallo paints four red rows, maxpato keeps three', async ({ page }) => {
      await mockSheets(page);

      await page.goto('http://gallo.localhost:8080/index.html');
      await page.waitForSelector('#leaderboardTableBody tr');
      // Show every player so all eight rows are ranked
      await page.selectOption('#minMatches', '1');
      await expect(page.locator('#leaderboardTableBody tr')).toHaveCount(8);

      await expect(page.locator('#leaderboardTableBody tr.bottom-position')).toHaveCount(4);
      expect(await redIndexes(page)).toEqual([4, 5, 6, 7]);

      // Red rows must never overlap the green podium
      const topIndexes = await page.$$eval('#leaderboardTableBody tr', rows =>
        rows.map((row, i) => (row.classList.contains('top-position') || row.classList.contains('champion') ? i : null)).filter(i => i !== null)
      );
      expect(topIndexes).toEqual([0, 1, 2]);

      // Max Pato keeps the three red rows it had before this change
      await page.goto('http://maxpato.localhost:8080/index.html');
      await page.waitForSelector('#leaderboardTableBody tr');
      await page.selectOption('#minMatches', '1');
      await expect(page.locator('#leaderboardTableBody tr')).toHaveCount(8);

      await expect(page.locator('#leaderboardTableBody tr.bottom-position')).toHaveCount(3);
      expect(await redIndexes(page)).toEqual([5, 6, 7]);
    });
  });

});
