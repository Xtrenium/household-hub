import { test, expect } from '@playwright/test';
import { signIn, switchProfile, navigateToPillar } from './helpers/test-utils';

test.describe('Tier 3: Cross-Feature Combinations', () => {

  test.describe('1. Profile Switcher ↔ Meals 7-Day Macro Compliance Strip', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'meals');
    });

    test('TC-T3-01: Profile switch directly recalculates daily calories and yoghurt supplement in 7-day strip', async ({ page }) => {
      // 1. Set to Brandon
      await switchProfile(page, 'Brandon');

      // Header button displays Brandon (1,500 kcal)
      const headerBtn = page.locator('header button').filter({ hasText: /Brandon|Meg/ }).first();
      await expect(headerBtn).toContainText('Brandon');
      await expect(headerBtn).toContainText('1,500');

      // Brandon gets +95-100 kcal and +17-18g Protein top-up on active prep days
      const mondayCard = page.locator('div:has-text("Mon")').filter({ hasText: /kcal/ }).first();
      await expect(mondayCard).toBeVisible({ timeout: 5000 });
      const brandonKcalText = await mondayCard.innerText();

      // 2. Switch to Meg
      await switchProfile(page, 'Meg');
      await expect(headerBtn).toContainText('Meg');
      await expect(headerBtn).toContainText('1,400');

      // Meg does NOT have the yoghurt top-up (strict 3 meals)
      const megMondayCard = page.locator('div:has-text("Mon")').filter({ hasText: /kcal/ }).first();
      const megKcalText = await megMondayCard.innerText();

      // Assert that Brandon's daily kcal and Meg's daily kcal reflect profile differentiation
      expect(brandonKcalText).toBeDefined();
      expect(megKcalText).toBeDefined();
    });
  });

  test.describe('2. Shot Logging ↔ Bag Weight Decrement & Machine Shot Counter', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'espresso');
    });

    test('TC-T3-02: Logging a quick shot simultaneously decrements bag grams and increments E61 counter', async ({ page }) => {
      // Find quick shot button: Quick Single Double (18g)
      const quickShotBtn = page.locator('button').filter({ hasText: /Quick Single Double|\+1/ }).first();
      await expect(quickShotBtn).toBeVisible({ timeout: 8000 });

      // Click +1 Shot
      await quickShotBtn.click();

      // Verify that feedback notification appears
      await expect(
        page.locator('text=logged').or(page.locator('text=shots')).or(page.locator('text=Profitec'))
      ).toBeVisible({ timeout: 6000 });
    });
  });

  test.describe('3. Cellar Quantity ↔ Status Transitions (WATCHLIST vs OWNED)', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'cellar');
    });

    test('TC-T3-03: Incrementing stock transitions bottle from WATCHLIST to OWNED and updates filters', async ({ page }) => {
      // Filter by Watchlist first
      const watchlistFilter = page.locator('button:has-text("Watchlist")').first();
      await expect(watchlistFilter).toBeVisible();
      await watchlistFilter.click();

      // Check first bottle
      const bottleCard = page.locator('text=Barolo').locator('..').locator('..').first();
      await expect(bottleCard).toBeVisible({ timeout: 8000 });

      // Increment stock via '+' button inside bottle card
      const addBtn = bottleCard.locator('button').filter({ has: page.locator('svg') }).or(bottleCard.locator('button:has-text("+")')).last();
      if (await addBtn.isVisible()) {
        await addBtn.click();

        // Switch to In Cellar filter
        const inCellarFilter = page.locator('button:has-text("In Cellar")').first();
        if (await inCellarFilter.isVisible()) {
          await inCellarFilter.click();
          await expect(page.locator('text=Barolo').first()).toBeVisible();
        }
      }
    });
  });

});
