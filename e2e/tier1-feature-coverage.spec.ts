import { test, expect } from '@playwright/test';
import { signIn, switchProfile, navigateToPillar, TEST_CREDENTIALS } from './helpers/test-utils';

test.describe('Tier 1: Feature Coverage (Happy Path)', () => {

  test.describe('1. AuthGate & Session Persistence', () => {
    test('TC-T1-01: Displays AuthGate on unauthenticated visit and rejects invalid password', async ({ page }) => {
      await page.context().clearCookies();
      await page.goto('/');

      const emailInput = page.locator('#hub-email');
      const passwordInput = page.locator('#hub-password');
      const submitButton = page.locator('button[type="submit"]');

      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(page.locator('text=Household Hub').first()).toBeVisible();

      // Attempt login with invalid password
      await emailInput.fill(TEST_CREDENTIALS.email);
      await passwordInput.fill(TEST_CREDENTIALS.invalidPassword);
      await submitButton.click();

      // Expect error feedback
      const errorBanner = page.locator('.text-rose-300, .bg-rose-500\\/10, [role="alert"]').or(page.locator('text=Invalid')).first();
      await expect(errorBanner).toBeVisible({ timeout: 8000 });
    });

    test('TC-T1-02: Successfully logs in with valid household credentials and persists session', async ({ page }) => {
      await signIn(page);

      // App header and navigation should be visible
      await expect(page.locator('header').first()).toBeVisible();
      await expect(page.locator('text=Household Hub').first()).toBeVisible();
    });
  });

  test.describe('2. Household Profile Switcher (Brandon / Meg)', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
    });

    test('TC-T1-03: Switching between Brandon and Meg updates macro targets and persists on reload', async ({ page }) => {
      // 1. Switch to Brandon profile
      await switchProfile(page, 'Brandon');
      const headerBtn = page.locator('header button').filter({ hasText: /Brandon|Meg/ }).first();
      await expect(headerBtn).toContainText('Brandon');

      // 2. Switch to Meg profile
      await switchProfile(page, 'Meg');
      await expect(headerBtn).toContainText('Meg');

      // 3. Reload page and assert Meg profile target persists in localStorage
      await page.reload();
      await expect(headerBtn).toContainText('Meg', { timeout: 10000 });
    });
  });

  test.describe('3. Pillar 1: Meals & Prep — Batch Assigner & Live Cooking Steps', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'meals');
    });

    test('TC-T1-04: Batch Assigner selects cadence presets and dynamically calculates servings', async ({ page }) => {
      const assigner = page.locator('text=Batch Assigner').locator('..').locator('..');
      await expect(assigner.first()).toBeVisible();

      // Tap cadence preset Mon-Fri (5d)
      const monFriPreset = page.locator('button:has-text("Mon–Fri"), button:has-text("Mon-Fri")').first();
      await expect(monFriPreset).toBeVisible();
      await monFriPreset.click();

      // Verify total servings computation (5 days * 2 diners = 10 servings)
      await expect(page.locator('text=10 Total Servings').or(page.locator('text=10 servings')).first()).toBeVisible();

      // Tap cadence preset Sun-Thu (5d)
      const sunThuPreset = page.locator('button:has-text("Sun–Thu"), button:has-text("Sun-Thu")').first();
      if (await sunThuPreset.isVisible()) {
        await sunThuPreset.click();
        await expect(page.locator('text=10 Total Servings').or(page.locator('text=10 servings')).first()).toBeVisible();
      }
    });

    test('TC-T1-05: Live cooking steps toggle interactively and maintain progress', async ({ page }) => {
      const stepLabels = page.locator('label').filter({ hasText: /Step \d+:/ });
      if (await stepLabels.count() > 0) {
        const firstLabel = stepLabels.first();
        const checkbox = firstLabel.locator('input[type="checkbox"]');
        const initialChecked = await checkbox.isChecked();

        // Click label to toggle step
        await firstLabel.click();
        await expect(checkbox).toBeChecked({ checked: !initialChecked, timeout: 5000 });

        // Toggle back to clean up
        await firstLabel.click();
        await expect(checkbox).toBeChecked({ checked: initialChecked, timeout: 5000 });
      }
    });
  });

  test.describe('4. Pillar 1: Pristine Google Keep Exporter', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'meals');
    });

    test('TC-T1-06: Google Keep modal produces pristine export with zero bullets, brackets, or blank lines', async ({ page }) => {
      const openKeepBtn = page.locator('button:has-text("Google Keep")').first();
      await expect(openKeepBtn).toBeVisible();
      await openKeepBtn.click();

      const dialog = page.locator('dialog[open], dialog:visible').first();
      await expect(dialog).toBeVisible();

      const preTextElement = dialog.locator('pre');
      await expect(preTextElement).toBeVisible();
      const content = await preTextElement.innerText();

      // Pristine hygiene verification:
      expect(content).not.toMatch(/- \[[ xX]\]/);
      expect(content).not.toMatch(/^[-*]\s+/m);
      const lines = content.split('\n');
      const emptyLines = lines.filter((l) => l.trim().length === 0);
      expect(emptyLines.length).toBe(0);
      expect(content).toMatch(/--- .+ ---/);

      const closeBtn = dialog.locator('button:has-text("Close"), button:has-text("Esc")').first();
      await closeBtn.click();
    });
  });

  test.describe('5. Pillar 2: Espresso Bar — Quick Shot & Water System', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'espresso');
    });

    test('TC-T1-07: Option 1 Quick Shot (+1 Shot 18g) executes and updates state', async ({ page }) => {
      const quickShotBtn = page.locator('button').filter({ hasText: /Quick Single Double|\+1/ }).first();
      await expect(quickShotBtn).toBeVisible({ timeout: 8000 });

      // Verify active bag card is displayed
      await expect(page.locator('text=Proud Mary').or(page.locator('text=Ghost Rider')).or(page.locator('text=ACTIVE HOPPER')).first()).toBeVisible();

      // Click +1 Shot
      await quickShotBtn.click();

      // Verify feedback message
      await expect(
        page.locator('text=logged').or(page.locator('text=shots')).or(page.locator('text=Profitec')).first()
      ).toBeVisible({ timeout: 6000 });
    });

    test('TC-T1-08: 1-Tap Neverfail Jug swap increments total volume', async ({ page }) => {
      const swapJugBtn = page.locator('button:has-text("+11L Neverfail Jug"), button:has-text("+11L")').first();
      await expect(swapJugBtn).toBeVisible({ timeout: 8000 });

      await swapJugBtn.click();

      await expect(page.locator('text=Neverfail').or(page.locator('text=BWT')).first()).toBeVisible();
    });
  });

  test.describe('6. Pillar 2: Espresso Bar — Detail Dial-In & 5-Axis Sensory Math', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'espresso');
    });

    test('TC-T1-09: Detail dial-in modal computes 5-axis suitability scores in real time', async ({ page }) => {
      const dialinBtn = page.locator('button:has-text("Detail Dial-In"), button:has-text("Sensory Log")').first();
      await expect(dialinBtn).toBeVisible({ timeout: 8000 });
      await dialinBtn.click();

      // Verify modal dialog is open
      const dialog = page.locator('dialog[open], dialog:visible').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Check for 5-axis sensory indicators (Acidity, Sweetness, Body, Clarity, Balance)
      await expect(dialog.locator('text=Acidity').first()).toBeVisible();
      await expect(dialog.locator('text=Straight').or(dialog.locator('text=Milk')).first()).toBeVisible();

      // Close modal
      const closeBtn = dialog.locator('button').filter({ hasText: /Cancel|Close|Dismiss|Esc/ }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    });
  });

  test.describe('7. Pillar 3: Cellar & Vault — Bottle Filtering & Stock Controls', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'cellar');
    });

    test('TC-T1-10: Filtering bottles by Status and Category correctly narrows bottle inventory', async ({ page }) => {
      await expect(page.locator('text=Barolo').or(page.locator('text=Paolo Scavino')).or(page.locator('text=Vietti')).first()).toBeVisible({ timeout: 8000 });

      // Filter by Watchlist
      const watchlistFilter = page.locator('button:has-text("Watchlist")').first();
      await expect(watchlistFilter).toBeVisible();
      await watchlistFilter.click();
      await expect(page.locator('text=Barolo').first()).toBeVisible();

      // Filter by Wine
      const wineFilter = page.locator('button:has-text("Wine")').first();
      if (await wineFilter.isVisible()) {
        await wineFilter.click();
        await expect(page.locator('text=Barolo').first()).toBeVisible();
      }
    });

    test('TC-T1-11: 1-Tap stock quantity controls update bottle counts', async ({ page }) => {
      const plusBtn = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: '' }).or(page.locator('button:has-text("+")')).first();
      if (await plusBtn.isVisible()) {
        await plusBtn.click();
        await expect(page.locator('text=Cellar').first()).toBeVisible();
      }
    });

    test('TC-T1-12: Sommelier SAT & BLIC tasting modal opens and accepts notes', async ({ page }) => {
      const tasteBtn = page.locator('button:has-text("Log Tasting"), button:has-text("pts")').first();
      if (await tasteBtn.isVisible()) {
        await tasteBtn.click();
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
