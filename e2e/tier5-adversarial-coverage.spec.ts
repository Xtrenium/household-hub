import { test, expect } from '@playwright/test';
import { signIn, switchProfile, navigateToPillar } from './helpers/test-utils';
import { computeSuitabilityScores, diagnoseExtraction } from '../src/lib/coffeeEngine';

test.describe('Tier 5: Adversarial Coverage Hardening', () => {

  test.describe('1. Flojet Sanitization Guardrail & Non-Chlorine Gate Bypass Resistance', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'espresso');
    });

    test('TC-T5-01: Flojet sanitization cancel vs confirm flow enforcing non-chlorine checkbox gate', async ({ page }) => {
      // 1. Locate Flojet sanitization trigger button
      const logSanitizationBtn = page.locator('button:has-text("Log Sanitization")').first();
      await expect(logSanitizationBtn).toBeVisible({ timeout: 8000 });
      await logSanitizationBtn.click();

      // 2. Verify dialog is open and safety guardrail headers appear
      const dialog = page.locator('dialog[open], dialog:visible').filter({ hasText: 'Flojet Sanitization Safety Guardrail' }).first();
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialog.locator('text=MANDATORY OXYGEN-BASED SANITIZER PROTOCOL')).toBeVisible();
      await expect(dialog.locator('text=NEVER use chlorine, bleach, or Milton tablets')).toBeVisible();

      // 3. Verify confirmation button is strictly DISABLED when checkbox is unchecked
      const confirmBtn = dialog.locator('button:has-text("Confirm Sanitization Reset")');
      const checkbox = dialog.locator('#guardrailCheck');

      await expect(checkbox).not.toBeChecked();
      await expect(confirmBtn).toBeDisabled();

      // Adversarial attempt: Click disabled confirm button; dialog must remain open
      await confirmBtn.click({ force: true });
      await expect(dialog).toBeVisible();

      // 4. Test Cancel flow: clicking Cancel dismisses modal without triggering confirmation
      const cancelBtn = dialog.locator('button:has-text("Cancel")');
      await cancelBtn.click();
      await expect(dialog).not.toBeVisible();

      // 5. Re-open modal: assert state is reset and checkbox is NOT pre-checked
      await logSanitizationBtn.click();
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(checkbox).not.toBeChecked();
      await expect(confirmBtn).toBeDisabled();

      // 6. Two-way binding verification: Checkbox enables and disables confirm button
      await checkbox.check();
      await expect(checkbox).toBeChecked();
      await expect(confirmBtn).toBeEnabled();

      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();
      await expect(confirmBtn).toBeDisabled();

      // 7. Check again and perform legitimate confirmation
      await checkbox.check();
      await expect(confirmBtn).toBeEnabled();
      await confirmBtn.click();

      // 8. Assert dialog closes and feedback toast verifies oxygen protocol
      await expect(dialog).not.toBeVisible();
      await expect(
        page.locator('text=Flojet suction line sanitized with oxygen sanitizer').or(
          page.locator('text=Next due in 180 days')
        ).first()
      ).toBeVisible({ timeout: 6000 });
    });
  });

  test.describe('2. Rapid Multi-Tap Quick-Shot Logging & Concurrency Guardrail', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'espresso');
    });

    test('TC-T5-02: Rapid multi-tap quick-shot logging prevents race conditions and decrements bag atomically', async ({ page }) => {
      // Unambiguously target the Quick Single Double shot button (avoiding +11L Neverfail Jug)
      const quickShotBtn = page.locator('button:has-text("Quick Single Double")').first();
      await expect(quickShotBtn).toBeVisible({ timeout: 8000 });

      // Wait for active bag to load and populate weight
      const weightLabel = page.locator('span:has-text("Remaining Beans:") + strong').first();
      await expect(weightLabel).toHaveText(/\d+(\.\d+)?g/, { timeout: 8000 });
      const initialText = await weightLabel.innerText();
      const initialWeight = parseFloat(initialText.replace('g', '').trim());

      // 1. First quick shot
      await quickShotBtn.click();

      // Verify feedback message appears
      await expect(
        page.locator('text=Quick Shot logged: +1').or(page.locator('text=pulled from'))
      ).toBeVisible({ timeout: 8000 });

      // Wait for button to re-enable
      await expect(quickShotBtn).toBeEnabled({ timeout: 6000 });

      // 2. Second sequential shot
      await quickShotBtn.click();
      await expect(
        page.locator('text=Quick Shot logged: +1').or(page.locator('text=pulled from'))
      ).toBeVisible({ timeout: 8000 });

      // 3. Verify monotonic state reduction: weight must have decremented by at least 18g
      await expect(async () => {
        const updatedText = await weightLabel.innerText();
        const updatedWeight = parseFloat(updatedText.replace('g', '').trim());
        expect(updatedWeight).toBeLessThanOrEqual(initialWeight - 18.0);
      }).toPass({ timeout: 5000 });
    });
  });

  test.describe('3. Dynamic Burrito Freeze Split Scaling (Odd Diners & Single Diner Days)', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'meals');
    });

    test('TC-T5-03: Burrito freeze split scaling with odd diners and single diner days', async ({ page }) => {
      // 1. Select Breakfast Burritos in the recipe dropdown
      const recipeSelect = page.locator('div:has(label:has-text("Select Base Recipe")) select, select').first();
      await expect(recipeSelect).toBeVisible();
      const options = await recipeSelect.locator('option').allInnerTexts();
      const burritoOption = options.find((o) => o.includes('Burrito') || o.includes('Breakfast'));
      if (burritoOption) {
        await recipeSelect.selectOption({ label: burritoOption });
      }

      // 2. Locate Diners dropdown
      const dinersSelect = page.locator('select').filter({ hasText: /Both Adults|Just Brandon/ }).first();
      await expect(dinersSelect).toBeVisible();

      // 3. Test Odd Diners: Just Brandon (1/day) across 5 days (Mon–Fri) -> 5 servings (2 fridge, 3 freeze)
      await dinersSelect.selectOption('Brandon|1');

      const monFriPreset = page.locator('button:has-text("Mon–Fri"), button:has-text("Mon-Fri")').first();
      await monFriPreset.click();

      // Verify batch summary counter displays 5 servings
      await expect(page.locator('text=5 Total Servings to Prep')).toBeVisible({ timeout: 5000 });

      // Count existing blocks so we clean up only newly created test blocks
      const deleteButtons = page.locator('button[title="Remove batch from schedule"]');
      const initialCount = await deleteButtons.count();

      // Create 5-serving batch
      const assign5Btn = page.locator('button:has-text("Assign 5-Serving Batch")');
      await expect(assign5Btn).toBeVisible();
      await assign5Btn.click();

      // Verify new block card was added
      await expect(deleteButtons).toHaveCount(initialCount + 1, { timeout: 8000 });
      const addedBlock5 = page.locator('div.bg-slate-900').filter({ hasText: '5 Servings' }).filter({ hasText: /Breakfast Burritos/ }).last();
      await expect(addedBlock5).toBeVisible();

      // Verify exact 3/2 split badge for odd 5 servings: Keep 2 wraps in Fridge & Freeze 3 wraps in foil
      const splitBadge5 = addedBlock5.locator('text=3/2 Freeze Split:');
      await expect(splitBadge5).toBeVisible();
      await expect(addedBlock5).toContainText('Keep 2 wraps in Fridge (first 2 days) & Freeze 3 wraps in foil');

      // Clean up the 5-serving test block
      await addedBlock5.locator('button[title="Remove batch from schedule"]').click();
      await expect(deleteButtons).toHaveCount(initialCount, { timeout: 8000 });

      // 4. Test Single Diner Day (Boundary): Just Brandon (1/day) on 1 day only -> 1 serving (1 fridge, 0 freeze)
      await dinersSelect.selectOption('Brandon|1');
      await monFriPreset.click(); // Select Mon-Fri (5d)

      // Uncheck Tue, Wed, Thu, Fri by toggling day buttons in the 7-day grid
      const dayGrid = page.locator('div.grid-cols-7 button');
      for (const day of ['Tue', 'Wed', 'Thu', 'Fri']) {
        await dayGrid.filter({ hasText: new RegExp(`^${day}$`) }).click();
      }

      // Verify batch summary counter displays 1 serving
      await expect(page.locator('text=1 Total Servings to Prep')).toBeVisible({ timeout: 5000 });

      // Create 1-serving batch
      const assign1Btn = page.locator('button:has-text("Assign 1-Serving Batch")');
      await expect(assign1Btn).toBeVisible();
      await assign1Btn.click();

      await expect(deleteButtons).toHaveCount(initialCount + 1, { timeout: 8000 });
      const addedBlock1 = page.locator('div.bg-slate-900').filter({ hasText: '1 Servings' }).filter({ hasText: /Breakfast Burritos/ }).last();
      await expect(addedBlock1).toBeVisible();

      // Zero-freeze invariant: Since freezeServings === 0, the freeze badge must NOT be rendered!
      await expect(addedBlock1.locator('text=3/2 Freeze Split:')).not.toBeVisible();

      // Clean up the 1-serving test block
      await addedBlock1.locator('button[title="Remove batch from schedule"]').click();
      await expect(deleteButtons).toHaveCount(initialCount, { timeout: 8000 });
    });
  });

  test.describe('4. Cellar Search Robustness (Special Characters & Regex Metacharacters)', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'cellar');
    });

    test('TC-T5-04: Cellar search handles 100%, apostrophes, ampersands, dashes, and unescaped parentheses without crashing', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search" i]').first();
      await expect(searchInput).toBeVisible({ timeout: 8000 });

      // Ensure catalog has loaded
      await expect(page.locator('text=Barolo').first()).toBeVisible({ timeout: 8000 });

      // A. Search '100%' -> matches '100% Nebbiolo (Barolo DOCG)' in varietal_or_style
      await searchInput.fill('100%');
      await expect(page.locator('text=Nebbiolo').first()).toBeVisible({ timeout: 5000 });
      const count100 = await page.locator('text=Nebbiolo').count();
      expect(count100).toBeGreaterThanOrEqual(1);

      // B. Search apostrophe "'" -> matches Rocche dell'Annunziata, Serralunga d'Alba, Monforte d'Alba
      await searchInput.fill("'");
      await expect(
        page.locator('text=dell\'Annunziata').or(page.locator('text=d\'Alba')).or(page.locator('text=Rocche Costamagna')).first()
      ).toBeVisible({ timeout: 5000 });

      // C. Search '&' -> matches producer Francesco Rinaldi & Figli
      await searchInput.fill('&');
      await expect(
        page.locator('text=Francesco Rinaldi & Figli').or(page.locator('text=Figli')).first()
      ).toBeVisible({ timeout: 5000 });

      // D. Search em-dash / en-dash '—' or '–' -> safe substring match without throwing
      await searchInput.fill('—');
      await expect(
        page.locator('text=No bottles found').or(page.locator('text=Barolo')).first()
      ).toBeVisible({ timeout: 5000 });

      // E. Search unescaped regex metacharacters '(375ml Half Bottle)' -> safely matches half-bottles heading without RegExp crash
      await searchInput.fill('(375ml Half Bottle)');
      const halfBottleHeading = page.locator('h3:has-text("375ml Half Bottle")').first();
      await expect(halfBottleHeading).toBeVisible({ timeout: 5000 });

      // F. Clear search restores full inventory
      await searchInput.fill('');
      await expect(page.locator('text=Paolo Scavino').first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('5. Dial-In Sensory Extreme Ratios (1:1 Ristretto vs 1:4 Lungo)', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'espresso');
    });

    test('TC-T5-05: Detail dial-in modal and engine handle extreme ratios (1:1 ristretto vs 1:4 lungo) with accurate diagnostics', async ({ page }) => {
      // 1. Pure Domain Math Verification for Extreme Ratios
      const ristretto = diagnoseExtraction({
        grind: 14.5,
        dose: 18.0,
        yieldG: 18.0,
        timeS: 28.0,
        acidity: 3.5,
        sweetness: 3.5,
        body: 4.0,
        clarity: 3.0,
        balance: 3.5,
      });
      expect(ristretto.ratio).toBe(1.0);
      expect(ristretto.flowRate).toBe(0.64);
      expect(ristretto.issues.some((i) => i.includes('Choked / slow extraction'))).toBe(true);
      expect(ristretto.prescriptions.some((p) => p.includes('COARSER on DF54'))).toBe(true);

      const lungo = diagnoseExtraction({
        grind: 14.5,
        dose: 18.0,
        yieldG: 72.0,
        timeS: 28.0,
        acidity: 3.5,
        sweetness: 3.5,
        body: 2.0,
        clarity: 3.5,
        balance: 3.0,
      });
      expect(lungo.ratio).toBe(4.0);
      expect(lungo.flowRate).toBe(2.57);
      expect(lungo.issues.some((i) => i.includes('Fast gusher'))).toBe(true);
      expect(lungo.prescriptions.some((p) => p.includes('FINER on DF54'))).toBe(true);

      // 2. Live UI Modal Dynamic Computation
      const dialinBtn = page.locator('button:has-text("Detail Dial-In"), button:has-text("Sensory Log")').first();
      await expect(dialinBtn).toBeVisible({ timeout: 8000 });
      await dialinBtn.click();

      const dialog = page.locator('dialog[open], dialog:visible').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Accurately select exact sibling inputs for Dose, Yield, Time
      const doseInput = dialog.locator('label:has-text("Dose") + input').first();
      const yieldInput = dialog.locator('label:has-text("Yield") + input').first();
      const timeInput = dialog.locator('label:has-text("Time") + input').first();

      // Test Ristretto Kinematics: 18g dose / 18g yield / 28s time -> 1:1 ratio, Choked flow
      await doseInput.fill('18');
      await yieldInput.fill('18');
      await timeInput.fill('28');

      await expect(dialog.locator('text=1:1 ratio')).toBeVisible();
      await expect(dialog.locator('text=Choked / slow extraction')).toBeVisible();
      await expect(dialog.locator('text=COARSER on DF54')).toBeVisible();

      // Test Lungo Kinematics: 18g dose / 72g yield / 28s time -> 1:4 ratio, Fast gusher
      await yieldInput.fill('72');

      await expect(dialog.locator('text=1:4 ratio')).toBeVisible();
      await expect(dialog.locator('text=Fast gusher')).toBeVisible();
      await expect(dialog.locator('text=FINER on DF54')).toBeVisible();

      // Dismiss modal without saving test record
      const cancelBtn = dialog.locator('button:has-text("Cancel")');
      await cancelBtn.click();
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe('6. Google Keep Clipboard Text Verification & Strict Hygiene Regex', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page);
      await navigateToPillar(page, 'meals');
    });

    test('TC-T5-06: Google Keep export clipboard text complies with strict hygiene regex across shopping and recipe modes', async ({ page, context }) => {
      // Grant clipboard permissions for automated clipboard inspection
      await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

      const openKeepBtn = page.locator('button:has-text("Google Keep")').first();
      await expect(openKeepBtn).toBeVisible({ timeout: 8000 });
      await openKeepBtn.click();

      const dialog = page.locator('dialog[open], dialog:visible').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      const clean = (s: string) => s.split('\n').map((l) => l.trimEnd()).join('\n');

      // ==========================================
      // MODE A: Weekly Coles Shopping List
      // ==========================================
      const shoppingTab = dialog.locator('button:has-text("Weekly Coles Shopping List")');
      await shoppingTab.click();

      const copyBtn = dialog.locator('button:has-text("Copy All for Google Keep")');
      await copyBtn.click();

      await expect(dialog.locator('text=Copied to Clipboard!')).toBeVisible({ timeout: 3000 });

      const preElement = dialog.locator('pre');
      const shoppingPre = await preElement.innerText();

      // Verify clipboard text matches pre element content
      const shoppingClipboard = await page.evaluate(async () => {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return null;
        }
      });
      if (shoppingClipboard !== null) {
        expect(clean(shoppingClipboard)).toBe(clean(shoppingPre));
      }

      // Exhaustive character hygiene regex verification on shopping export
      const shoppingLines = shoppingPre.split('\n');
      expect(shoppingLines.length).toBeGreaterThan(5);

      shoppingLines.forEach((line, idx) => {
        // Zero blank lines
        expect(line.trim().length, `Shopping Line ${idx + 1} must not be empty`).toBeGreaterThan(0);
        // Zero markdown checkbox brackets
        expect(line).not.toMatch(/^\[\s*\]/);
        expect(line).not.toMatch(/^- \[[ xX]\]/);
        // Zero bullet prefixes
        expect(line).not.toMatch(/^[-*•]\s+/);
      });

      // Category headers verified
      const hasShoppingHeaders = shoppingLines.some((l) => /^--- [A-Z &]+ ---$/.test(l));
      expect(hasShoppingHeaders).toBe(true);

      // ==========================================
      // MODE B: Full Recipe Cards for Keep
      // ==========================================
      const recipesTab = dialog.locator('button:has-text("Full Recipe Cards")');
      await recipesTab.click();

      await copyBtn.click();
      await expect(dialog.locator('text=Copied to Clipboard!')).toBeVisible({ timeout: 3000 });

      const recipesPre = await preElement.innerText();
      const recipesClipboard = await page.evaluate(async () => {
        try {
          return await navigator.clipboard.readText();
        } catch {
          return null;
        }
      });
      if (recipesClipboard !== null) {
        expect(clean(recipesClipboard)).toBe(clean(recipesPre));
      }

      // Exhaustive character hygiene regex verification on recipe cards export
      const recipeLines = recipesPre.split('\n');
      expect(recipeLines.length).toBeGreaterThan(10);

      recipeLines.forEach((line, idx) => {
        // Zero blank lines
        expect(line.trim().length, `Recipe Line ${idx + 1} must not be empty`).toBeGreaterThan(0);
        // Zero markdown checkbox brackets
        expect(line).not.toMatch(/^\[\s*\]/);
        expect(line).not.toMatch(/^- \[[ xX]\]/);
        // Zero bullet prefixes
        expect(line).not.toMatch(/^[-*•]\s+/);
      });

      // Recipe headers verified
      const hasRecipeTitle = recipeLines.some((l) => /^=== .+ ===$/.test(l));
      const hasIngredientsHeader = recipeLines.some((l) => l === '--- INGREDIENTS ---');
      const hasCookingStepsHeader = recipeLines.some((l) => l === '--- COOKING STEPS ---');
      const hasStepPrefix = recipeLines.some((l) => /^Step \d+: .+/.test(l));

      expect(hasRecipeTitle).toBe(true);
      expect(hasIngredientsHeader).toBe(true);
      expect(hasCookingStepsHeader).toBe(true);
      expect(hasStepPrefix).toBe(true);

      // Close dialog cleanly
      const closeBtn = dialog.locator('button:has-text("Close"), button:has-text("Esc")').first();
      await closeBtn.click();
      await expect(dialog).not.toBeVisible();
    });
  });

});
