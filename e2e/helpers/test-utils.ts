import { Page, expect } from '@playwright/test';

/**
 * Standard test credentials for Household Hub Supabase Auth.
 */
export const TEST_CREDENTIALS = {
  email: 'bkmlscott@gmail.com',
  password: 'HouseholdHub2026!',
  invalidPassword: 'WrongPassword999!',
};

let cachedAuthSession: string | null = null;

/**
 * Signs in to Household Hub via AuthGate if not already signed in.
 * Caches session in memory across test specs to prevent Supabase Auth rate limiting.
 */
export async function signIn(page: Page, email = TEST_CREDENTIALS.email, password = TEST_CREDENTIALS.password) {
  // If we have a cached valid session, inject it into localStorage prior to page load
  if (cachedAuthSession && email === TEST_CREDENTIALS.email) {
    await page.addInitScript((session) => {
      try {
        window.localStorage.setItem('household_hub_auth_v1', session);
      } catch {
        // ignore
      }
    }, cachedAuthSession);
  }

  await page.goto('/');

  // If AuthGate is visible, perform sign-in
  const emailInput = page.locator('#hub-email');
  if (await emailInput.isVisible({ timeout: 2500 }).catch(() => false)) {
    await emailInput.fill(email);
    const passwordInput = page.locator('#hub-password');
    await passwordInput.fill(password);
    await page.locator('button[type="submit"]').click();

    // Wait for AuthGate to be dismissed
    await expect(emailInput).not.toBeVisible({ timeout: 15000 });

    // Cache the authenticated session for subsequent tests
    if (email === TEST_CREDENTIALS.email) {
      const stored = await page.evaluate(() => window.localStorage.getItem('household_hub_auth_v1')).catch(() => null);
      if (stored) {
        cachedAuthSession = stored;
      }
    }
  }

  // Ensure app shell or header is loaded
  await expect(page.locator('header').first()).toBeVisible({ timeout: 10000 });
}

/**
 * Switches household profile between 'Brandon' and 'Meg'.
 */
export async function switchProfile(page: Page, targetProfile: 'Brandon' | 'Meg') {
  // Find the header profile switcher toggle button
  const toggleBtn = page.locator('header button').filter({ hasText: /Brandon|Meg/ }).first();
  await expect(toggleBtn).toBeVisible({ timeout: 6000 });

  const currentText = await toggleBtn.innerText();
  if (!currentText.includes(targetProfile)) {
    await toggleBtn.click();
    await expect(toggleBtn).toContainText(targetProfile, { timeout: 5000 });
  }
}

/**
 * Navigates to one of the 3 primary pillars: Meals & Prep, Espresso Bar, or Cellar & Vault.
 * Uses :visible selector to adapt seamlessly between Desktop header nav and Mobile bottom nav.
 */
export async function navigateToPillar(page: Page, pillar: 'meals' | 'espresso' | 'cellar') {
  const pillarRegexes = {
    meals: /Meals/i,
    espresso: /Espresso/i,
    cellar: /Cellar/i,
  };

  const navButton = page.locator('nav:visible button, nav button:visible').filter({ hasText: pillarRegexes[pillar] }).first();
  await expect(navButton).toBeVisible({ timeout: 6000 });
  await navButton.click();
}
