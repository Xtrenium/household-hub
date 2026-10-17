# TEST_INFRA.md: Playwright E2E Test Infrastructure & Specification

## 1. Executive Summary & Test Philosophy

This document defines the End-to-End (E2E) testing infrastructure, architectural principles, feature inventory, coverage thresholds, and verification procedures for **Household Hub**, an installable, mobile-first Progressive Web Application (PWA) and synchronized Desktop CLI for Brandon and Meg. Household Hub unifies three core domains:
1. **Pillar 1: Meals & Prep** (MacroFactor-verified recipes, Coles-grounded products, multi-day batch assigner with cadence presets, dynamic scaling, 3/2 burrito freeze split, 7-day macro compliance strip, live cooking checkoffs, and pristine Google Keep exporter).
2. **Pillar 2: Profitec/DF54 Espresso Bar** (Profitec Drive E61 + Turin DF54 + Flojet BW5000 / BWT Bestmax Premium dual-decay water engine, 1-tap quick shots vs. 5-axis sensory dial-in logging, remaining bag weight deduction, E61 chemical backflush counter [35 warning / 40 overdue], 7 maintenance cadences with oxygen-sanitizer guardrail, and 14 Australian specialty roasters).
3. **Pillar 3: Wine/Whiskey Cellar & Watchlist** (18 pre-seeded Wine Experience Barolo bottles, wine/whiskey filtering, 1-tap stock count / spirit fill % updates, verdicts [`BUY_AGAIN`, `TRY_NEXT`, `AVOID`], Sommelier SAT & BLIC [`Balance`, `Length`, `Intensity`, `Complexity`] + 100-point tasting notes, drinking windows, decanting curves, storage orientation physics [horizontal cork wine vs. strictly vertical spirits], and Kamado Joe / Ninja Woodfire BBQ pairings).

Backed exclusively by the dedicated Sydney (`ap-southeast-2`) Supabase project (`anqaecdyipycajapmiev`).

### 1.1 Opaque-Box, Requirement-Driven Verification
All test cases in this suite are designed strictly from the authoritative specifications set forth in:
1. `ORIGINAL_REQUEST.md`: Original user requirements, physical equipment specs, household macro targets, and acceptance criteria.
2. `PROJECT.md`: 20-feature inventory, module breakdowns, database boundaries, and cross-subsystem interface contracts.
3. `GEMINI.md`: Desktop Antigravity synchronization rules and equipment safety guardrails.
4. Explorer Survey Handoffs (`explorer_survey_1`, `explorer_survey_2`, `explorer_survey_3`).

The test framework enforces a strict **opaque-box** testing model:
- Tests interact with the application through genuine user interactions via Playwright (form submissions, button taps, modal dialog interactions, and storage inspection).
- Tests do NOT use artificial mock shortcuts or circumvent the application layer.
- Tests verify deterministic state transitions, dynamic scaling arithmetic, character hygiene, and equipment safety invariants across both desktop and mobile viewports.

### 1.2 Dual Viewport Emulation
- **Mobile Viewport**: Emulated via Google Pixel 7 (390 × 844 px, `isMobile: true`), validating mobile ergonomics, touch targets, and native `<dialog closedby="any">` modals with `overscroll-behavior: contain`.
- **Desktop Viewport**: Standard Desktop Chrome (1280 × 720 px), validating wide-screen 7-day compliance layouts and multi-column grid responsiveness.

---

## 2. Complete Feature Inventory

| ID | Feature Name | Primary Component / Module | Key Invariants / Behavioral Contract |
|---|---|---|---|
| **F01** | Controlled Supabase Boundary | `src/lib/supabase.ts` | Exclusively connects to Sydney Supabase (`anqaecdyipycajapmiev`); zero connection to `hkpjezgtykjvinztddod`. |
| **F02** | Row Level Security (RLS) Gate | Database / Schema | All 8 tables have `rowsecurity = true`; unauthenticated reads/writes rejected with HTTP 401/empty array. |
| **F03** | Seed & Schema Validation | Database / Schema | 31 Coles products, 7 recipes with 100% macro sum match, 6 meal plan blocks, Profitec machine state, 14 roaster coffee bags, 18 Barolo bottles. |
| **F04** | AuthGate & Persistent Session | `src/components/AuthGate.tsx` | Supabase `signInWithPassword`, credential validation, error banners, and persistent session storage. |
| **F05** | Brandon / Meg Profile Switcher | App Shell / Header | 1-tap profile toggle, per-device localStorage persistence, Brandon (1,500 kcal / 160g P + 100 kcal yoghurt) vs. Meg (1,400 kcal / 142g P). |
| **F06** | Bloat Exclusion Enforcement | Full Application | 0 Gemini chat, 0 API key modal, 0 blend studio, 0 pour-over stopwatch, 0 infinity bottle simulator, 0 mock sample data. |
| **F07** | Meals Multi-Day Batch Assigner | `src/components/MealsPillar.tsx` | Select recipe once, choose diners/session, toggle cadence presets (`Mon–Fri`, `Sun–Thu`, `Sun–Fri`, `Wolf School`), computing `totalServings = days.length * diners`. |
| **F08** | Dynamic Scaling & Coles Packs | `src/components/MealsPillar.tsx` | Dynamic ingredient scaling `scaleFactor = batchServings / recipe.servings`; Coles package counts scale via `Math.ceil(shop_packs * scaleFactor)`. |
| **F09** | 3/2 Burrito Freeze Split | `src/components/MealsPillar.tsx` | Fridge servings = `Math.min(batch, diners * 2)` (4 for Mon/Tue); Freeze servings = `Math.max(0, batch - fridge)` (6 in foil for Wed/Thu/Fri). |
| **F10** | 7-Day Macro Compliance Strip | `src/components/MealsPillar.tsx` | Evaluates daily calories vs target (Brandon 1,500 kcal with +95–100 kcal yoghurt; Meg strict 1,400 kcal). |
| **F11** | Live Cooking Step Persistence | `src/components/MealsPillar.tsx` | Interactive checkoff toggling indices in `meal_plan_blocks.checked_steps`. |
| **F12** | Google Keep Exporter | `src/components/MealsPillar.tsx` | 1-tap pristine shopping list and prep checklist (0 `- [ ]`, 0 bullets, 0 blank lines, grouped by `--- CATEGORY ---`). |
| **F13** | Water Dual-Decay Model | `src/lib/coffeeEngine.ts` | 2,700L rated capacity vs 2027-04-18 calendar expiry, `CALENDAR` vs `VOLUME` binding constraint, 3-tier status (`OK`, `DUE_SOON`, `OVERDUE`). |
| **F14** | 1-Tap Neverfail Jug Swap | `src/components/EspressoPillar.tsx` | Increments `total_jugs_swapped` by +1 and consumed volume by +11.0L. |
| **F15** | E61 Chemical Backflush Counter | `src/components/EspressoPillar.tsx` | Tracks shots since clean, warning at 35 shots (`DUE_SOON`), overdue at 40 shots (`OVERDUE`), protecting DuPont Molykote 111 brass cam lubrication. |
| **F16** | Option 1: Quick Shot Logging | `src/components/EspressoPillar.tsx` | `+1 Shot 18g` and `+2 Morning Coffees 36g`, atomically decrementing bag weight and incrementing machine shot counter. |
| **F17** | Option 2: Detail Dial-In & 5-Axis Sensory | `src/components/EspressoPillar.tsx` | DF54 grind `#`, dose, yield, time, flow profile, 5 sliders (1–5) -> Straight & Milk suitability scores (0–100) + extraction troubleshooting. |
| **F18** | 14-Bean Catalog & Recommender | `src/components/EspressoPillar.tsx` | 14 Australian specialty roasters catalog, utility ranking, roaster dial notes. |
| **F19** | Cellar & Vault Multi-Filter Inventory | `src/components/CellarPillar.tsx` | Filters by Status (`All`, `In Cellar`, `Watchlist`) and Category (`Wine`, `Whiskey & Spirits`), 18 Barolo bottles, stock `+`/`-`, spirit fill levels. |
| **F20** | Sommelier SAT & BLIC Tasting Notes | `src/components/CellarPillar.tsx` | Balance, Length, Intensity, Complexity (1–4) + 100-point reviews, paired meals, Kamado Joe Big Joe III and Ninja Woodfire BBQ tags. |

---

## 3. Test Tier Architecture

The test harness is organized into four hierarchical verification tiers:

```
+-------------------------------------------------------------------------+
|                  TIER 4: REAL-WORLD APPLICATION SCENARIOS               |
|   Sunday prep batch assignment, morning coffee, weekend dial-in, etc.   |
+-------------------------------------------------------------------------+
                                    ^
+-------------------------------------------------------------------------+
|                  TIER 3: CROSS-FEATURE INTERACTIONS                     |
|   Profile ↔ Macros, Shot Logging ↔ Bag Weight + Machine Counter, etc.   |
+-------------------------------------------------------------------------+
                                    ^
+-------------------------------------------------------------------------+
|                  TIER 2: BOUNDARY & CORNER CASES                        |
|   Empty states, 0-qty limits, <=60g bag, 35/40 shots, regex hygiene     |
+-------------------------------------------------------------------------+
                                    ^
+-------------------------------------------------------------------------+
|                  TIER 1: FEATURE COVERAGE (HAPPY PATH)                  |
|   AuthGate, Profile Switcher, Batch Assigner, Keep Export, Espresso     |
+-------------------------------------------------------------------------+
```

### Tier 1: Feature Coverage (Nominal Behavior)
- **Scope**: Exercises the primary happy-path behavior of every feature in scope.
- **Test Specs**: `e2e/tier1-feature-coverage.spec.ts`
  - `TC-T1-01`: Displays AuthGate on unauthenticated visit and rejects invalid password.
  - `TC-T1-02`: Successfully logs in with valid household credentials and persists session.
  - `TC-T1-03`: Switching between Brandon and Meg updates macro targets and persists on reload.
  - `TC-T1-04`: Batch Assigner selects cadence presets and dynamically calculates servings.
  - `TC-T1-05`: Live cooking steps toggle interactively and maintain progress.
  - `TC-T1-06`: Google Keep modal produces pristine export with zero bullets, brackets, or blank lines.
  - `TC-T1-07`: Option 1 Quick Shot (`+1 Shot 18g`) executes and updates state.
  - `TC-T1-08`: 1-Tap Neverfail Jug swap increments total volume.
  - `TC-T1-09`: Detail dial-in modal computes 5-axis suitability scores in real time.
  - `TC-T1-10`: Filtering bottles by Status and Category correctly narrows bottle inventory.
  - `TC-T1-11`: 1-Tap stock quantity controls update bottle counts.
  - `TC-T1-12`: Sommelier SAT & BLIC tasting modal opens and accepts notes.

### Tier 2: Boundary & Corner Cases
- **Scope**: Stress tests limits, edge conditions, invalid ranges, and format hygiene.
- **Test Specs**: `e2e/tier2-boundary-corner-cases.spec.ts`
  - `TC-T2-01`: Cellar search with non-existent query displays clean empty state without crashing.
  - `TC-T2-02`: Meals 7-day strip displays "Free / Flex" when zero meals are assigned to a day.
  - `TC-T2-03`: Coffee bag remaining weight <= 60g triggers Low Bag alert/badge.
  - `TC-T2-04`: Bottle quantity decrement cannot go below zero.
  - `TC-T2-05`: Shot counter displays cam protection warning and due/overdue indicator (35/40 shots).
  - `TC-T2-06`: 5-Axis sensory math handles minimum (1.0) and maximum (5.0) extremes correctly.
  - `TC-T2-07`: Diagnostic engine identifies fast gushing and choked extractions with precise prescriptions.
  - `TC-T2-08`: Export output strictly adheres to character hygiene constraints.

### Tier 3: Cross-Feature Combinations
- **Scope**: Validates synchronization and state consistency across decoupled subsystems.
- **Test Specs**: `e2e/tier3-cross-feature-combinations.spec.ts`
  - `TC-T3-01`: Profile switch directly recalculates daily calories and yoghurt supplement in 7-day strip.
  - `TC-T3-02`: Logging a quick shot simultaneously decrements bag grams and increments E61 counter.
  - `TC-T3-03`: Incrementing stock transitions bottle from WATCHLIST to OWNED and updates filters.

### Tier 4: Real-World Application Scenarios
- **Scope**: Multi-step realistic user journeys representing actual household routines.
- **Test Specs**: `e2e/tier4-application-scenarios.spec.ts`
  - `TC-T4-01`: Full Sunday Prep Batch Assignment with 3/2 Burrito Freeze Split.
  - `TC-T4-02`: Morning Coffee Workflow (`+2 Morning Coffees 36g`).
  - `TC-T4-03`: Weekend Dial-In Workflow (5-Axis Sensory Logging & Sweet Spot).
  - `TC-T4-04`: Cellar Tasting Workflow (Barolo SAT/BLIC Review & BBQ Pairing).

---

## 4. Execution Commands & Test Harness Invocation

The E2E test suite is executed using Playwright:

```bash
# Run all E2E test suites (all Tiers across Desktop and Mobile viewports)
npx playwright test

# Run a specific verification tier
npx playwright test e2e/tier1-feature-coverage.spec.ts
npx playwright test e2e/tier2-boundary-corner-cases.spec.ts
npx playwright test e2e/tier3-cross-feature-combinations.spec.ts
npx playwright test e2e/tier4-application-scenarios.spec.ts

# Run on Desktop Chrome only
npx playwright test --project="Desktop Chrome"

# Run on Mobile Chrome only
npx playwright test --project="Mobile Chrome"

# Run in interactive UI mode
npx playwright test --ui

# View HTML Test Report
npx playwright show-report
```

---

## 5. Coverage Thresholds & Quality Gates

To guarantee production readiness, the E2E test suite enforces the following mandatory quality gates:
1. **Pass Rate**: **100.0% Pass Rate**. Zero failures, zero flaky test workarounds.
2. **Database Boundary Protection**: Zero calls or credentials pointing to `hkpjezgtykjvinztddod`; exclusively Sydney `anqaecdyipycajapmiev`.
3. **Pristine Keep Export Hygiene**:
   - Zero markdown checkbox brackets: `- [ ]`
   - Zero bullet points: `- ` or `* `
   - Zero blank lines
   - Grouped by `--- CATEGORY ---`
4. **Physical Equipment Protection**:
   - E61 cam lubrication warning triggers at 35 shots; overdue at 40 shots.
   - Low coffee bag threshold triggers at `<= 60g`.
   - Neverfail jug swaps increment by 11.0L.
   - Dual-decay model correctly recognizes calendar vs volume binding constraint.
