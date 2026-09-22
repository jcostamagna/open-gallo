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

});
