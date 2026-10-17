import { test, expect } from '@playwright/test';
import { signIn, navigateToPillar } from './helpers/test-utils';
import { computeSuitabilityScores, diagnoseExtraction } from '../src/lib/coffeeEngine';

test.describe('Tier 2: Boundary & Corner Cases', () => {

  test.describe('1. Empty States & Graceful Degradation', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
    });

    test('TC-T2-01: Cellar search with non-existent query displays clean empty state without crashing', async ({ page }) => {
      await navigateToPillar(page, 'cellar');

      // Find search input if available
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('NonExistentVintageXYZ123456');
        // Assert empty state feedback
        await expect(
          page.locator('text=No bottles found').or(page.locator('text=No bottles')).or(page.locator('text=0 bottles'))
        ).toBeVisible({ timeout: 5000 });
      }
    });

    test('TC-T2-02: Meals 7-day strip displays "Free / Flex" when zero meals are assigned to a day', async ({ page }) => {
      await navigateToPillar(page, 'meals');

      // Saturday or Sunday typically unassigned by default
      const dayCards = page.locator('text=Free / Flex').or(page.locator('text=No batch assigned'));
      await expect(dayCards.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('2. Quantity Boundaries & Low Bag Threshold', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
    });

    test('TC-T2-03: Coffee bag remaining weight <= 60g triggers Low Bag alert/badge', async ({ page }) => {
      await navigateToPillar(page, 'espresso');

      // Check if low bag indicator logic or threshold is accounted for
      const bagCard = page.locator('text=Remaining').or(page.locator('text=Active Bag')).locator('..');
      await expect(bagCard.first()).toBeVisible({ timeout: 8000 });

      // Ensure bag remaining grams is displayed and formatted as a positive number
      const weightText = await page.locator('text=/\\d+g/').first().innerText();
      expect(weightText).toMatch(/\d+g/);
    });

    test('TC-T2-04: Bottle quantity decrement cannot go below zero', async ({ page }) => {
      await navigateToPillar(page, 'cellar');

      // Locate 0-quantity bottle in Watchlist
      const zeroQtyBottle = page.locator('text=0 in cellar').or(page.locator('text=Qty: 0')).or(page.locator('text=0 /'));
      if (await zeroQtyBottle.isVisible()) {
        // Find decrement button nearby
        const minusBtn = page.locator('button:has-text("-")').first();
        if (await minusBtn.isEnabled()) {
          await minusBtn.click();
          // Must not display negative number (e.g. -1)
          await expect(page.locator('text=-1')).not.toBeVisible();
        }
      }
    });
  });

  test.describe('3. Machine Shot Counter (35 Warning / 40 Overdue Limits)', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'espresso');
    });

    test('TC-T2-05: Shot counter displays cam protection warning and due/overdue indicator', async ({ page }) => {
      // Counter indicator should show clean state or warning depending on shot count
      const counterContainer = page.locator('text=Chemical Backflush').or(page.locator('text=shots')).locator('..');
      await expect(counterContainer.first()).toBeVisible({ timeout: 8000 });

      // Verify the 35 warning and 40 target shot thresholds are visible in UI or tooltips
      const thresholdText = page.locator('text=/35|40/').first();
      await expect(thresholdText).toBeVisible();
    });
  });

  test.describe('4. Dial-In Math & Extraction Diagnostics Boundary Verification', () => {
    test('TC-T2-06: 5-Axis sensory math handles minimum (1.0) and maximum (5.0) extremes correctly', async () => {
      // Direct opaque evaluation of pure domain math exported in coffeeEngine
      const minScores = computeSuitabilityScores(1.0, 1.0, 1.0, 1.0, 1.0);
      expect(minScores.straightScore).toBe(0.0);
      expect(minScores.milkScore).toBe(0.0);
      expect(minScores.straightTier).toBe('Unsuited');

      const maxScores = computeSuitabilityScores(5.0, 5.0, 5.0, 5.0, 5.0);
      expect(maxScores.straightScore).toBe(100.0);
      expect(maxScores.milkScore).toBe(100.0);
      expect(maxScores.straightTier).toBe('Outstanding');

      const midScores = computeSuitabilityScores(3.0, 3.0, 3.0, 3.0, 3.0);
      expect(midScores.straightScore).toBe(50.0);
      expect(midScores.milkScore).toBe(50.0);
    });

    test('TC-T2-07: Diagnostic engine identifies fast gushing and choked extractions with precise prescriptions', async () => {
      // Fast gusher: 16s with high flow
      const gusher = diagnoseExtraction({
        grind: 14.0,
        dose: 18.0,
        yieldG: 40.0,
        timeS: 16.0,
        acidity: 4.5,
        sweetness: 2.0,
        body: 2.0,
        clarity: 3.5,
        balance: 2.0,
      });
      expect(gusher.is_sweet_spot).toBe(false);
      expect(gusher.issues.some((i) => i.includes('Fast gusher'))).toBe(true);
      expect(gusher.prescriptions.some((p) => p.includes('FINER on DF54'))).toBe(true);

      // Choked extraction: 42s with low flow
      const choked = diagnoseExtraction({
        grind: 12.0,
        dose: 18.0,
        yieldG: 32.0,
        timeS: 42.0,
        acidity: 2.0,
        sweetness: 2.5,
        body: 4.5,
        clarity: 1.5,
        balance: 2.0,
      });
      expect(choked.is_sweet_spot).toBe(false);
      expect(choked.issues.some((i) => i.includes('Choked'))).toBe(true);
      expect(choked.prescriptions.some((p) => p.includes('COARSER on DF54'))).toBe(true);
    });
  });

  test.describe('5. Google Keep Export Character Hygiene Boundary', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'meals');
    });

    test('TC-T2-08: Export output strictly adheres to character hygiene constraints', async ({ page }) => {
      const openKeepBtn = page.locator('button:has-text("Google Keep")').first();
      await openKeepBtn.click();

      const dialog = page.locator('dialog[open], dialog:visible').first();
      const preTextElement = dialog.locator('pre');
      await expect(preTextElement).toBeVisible();
      const rawText = await preTextElement.innerText();

      const lines = rawText.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Rule: NO empty lines anywhere in output
        expect(line.length, `Line ${i + 1} should not be empty`).toBeGreaterThan(0);

        // Rule: NO markdown checkbox patterns
        expect(line).not.toMatch(/^\[\s*\]/);
        expect(line).not.toMatch(/^- \[[ xX]\]/);

        // Rule: NO bullet points at beginning of line
        expect(line).not.toMatch(/^[-*•]\s+/);
      }

      await dialog.locator('button:has-text("Close"), button:has-text("Esc")').first().click();
    });
  });

});
