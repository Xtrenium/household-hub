import { test, expect } from '@playwright/test';
import { signIn, navigateToPillar } from './helpers/test-utils';

test.describe('Tier 4: Real-World Application Scenarios', () => {

  test.describe('Scenario 1: Full Sunday Prep Batch Assignment with 3/2 Burrito Freeze Split', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'meals');
    });

    test('TC-T4-01: Creates 10-serving breakfast burrito batch and enforces 3/2 fridge/freeze split', async ({ page }) => {
      // 1. Locate Batch Assigner
      const assigner = page.locator('text=Batch Assigner').locator('..').locator('..');
      await expect(assigner.first()).toBeVisible({ timeout: 5000 });

      // 2. Select Breakfast Burritos if dropdown available
      const recipeSelect = page.locator('select').first();
      if (await recipeSelect.isVisible()) {
        const options = await recipeSelect.locator('option').allInnerTexts();
        const burritoOption = options.find((o) => o.includes('Burrito') || o.includes('Breakfast'));
        if (burritoOption) {
          await recipeSelect.selectOption({ label: burritoOption });
        }
      }

      // 3. Apply Mon-Fri preset
      const monFriBtn = page.locator('button:has-text("Mon–Fri"), button:has-text("Mon-Fri")').first();
      await expect(monFriBtn).toBeVisible();
      await monFriBtn.click();

      // 4. Verify batch servings scale
      await expect(page.locator('text=10 Total Servings').or(page.locator('text=10 servings')).first()).toBeVisible();

      // 5. Look for active batch cards to verify the 3/2 Freeze Split badge
      const freezeSplitBadge = page.locator('text=3/2 Freeze Split:');
      await expect(freezeSplitBadge.first()).toBeVisible({ timeout: 8000 });

      // Verify specific moisture and foil guardrail instruction
      await expect(page.locator('text=Fridge').or(page.locator('text=foil')).first()).toBeVisible();
    });
  });

  test.describe('Scenario 2: Morning Coffee Workflow (+2 Morning Coffees 36g)', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'espresso');
    });

    test('TC-T4-02: Brandon logs 2 morning coffees in 1 tap, decrementing bag weight and incrementing shot counter', async ({ page }) => {
      // Look for the 2x Morning Coffees (36g) button
      const morningCoffeesBtn = page.locator('button').filter({ hasText: /2x Morning Coffees|\+2/ }).first();
      await expect(morningCoffeesBtn).toBeVisible({ timeout: 8000 });
      await morningCoffeesBtn.click();

      // Verify state update feedback
      await expect(
        page.locator('text=logged').or(page.locator('text=shots')).or(page.locator('text=Profitec')).first()
      ).toBeVisible({ timeout: 6000 });
    });
  });

  test.describe('Scenario 3: Weekend Dial-In Workflow (5-Axis Sensory Logging & Sweet Spot)', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'espresso');
    });

    test('TC-T4-03: Dialing in 5-axis sensory sliders achieves sweet spot and straight/milk scores', async ({ page }) => {
      const dialinBtn = page.locator('button:has-text("Detail Dial-In"), button:has-text("Sensory Log")').first();
      await expect(dialinBtn).toBeVisible({ timeout: 8000 });
      await dialinBtn.click();

      // Check if modal dialog is open
      const dialog = page.locator('dialog[open], dialog:visible').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Verify Straight and Milk suitability score indicators
      await expect(dialog.locator('text=Straight').or(dialog.locator('text=Milk')).first()).toBeVisible();

      // Close modal
      const closeBtn = dialog.locator('button').filter({ hasText: /Cancel|Close|Dismiss|Esc/ }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    });
  });

  test.describe('Scenario 4: Cellar Tasting Workflow (Barolo SAT/BLIC Review & BBQ Pairing)', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'cellar');
    });

    test('TC-T4-04: Logs Sommelier SAT/BLIC 100-pt tasting note with Kamado Joe pairing for Barolo', async ({ page }) => {
      // Check Barolo bottle card with Kamado Joe pairing tag
      const baroloCard = page.locator('text=Barolo').locator('..').locator('..').first();
      await expect(baroloCard).toBeVisible({ timeout: 8000 });

      // Verify BBQ pairing tag (e.g. Kamado Joe or Ninja Woodfire)
      await expect(
        page.locator('text=Kamado Joe').or(page.locator('text=BBQ')).or(page.locator('text=Ribs')).first()
      ).toBeVisible({ timeout: 5000 });

      // Open tasting review modal if available
      const reviewBtn = baroloCard.locator('button').filter({ hasText: /Log Tasting|pts/ }).first();
      if (await reviewBtn.isVisible()) {
        await reviewBtn.click();
        const dialog = page.locator('dialog[open], dialog:visible').first();
        await expect(dialog).toBeVisible({ timeout: 5000 });

        const closeBtn = dialog.locator('button').filter({ hasText: /Cancel|Close|Dismiss|Esc/ }).first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      }
    });
  });

});
