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
    await page.goto('/equipos.html');

    // Wait for players to load
    await page.waitForSelector('#availablePlayersList', { timeout: 10000 });

    // Check that some players loaded
    const playerCards = await page.locator('#availablePlayersList .player-card').count();

    expect(playerCards).toBeGreaterThan(0);
  });

});
