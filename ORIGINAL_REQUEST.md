# Original User Request

## Initial Request — 2026-10-17T10:20:46Z

> Requested team: [none — teamwork routes from the description]

Build, verify, and deploy **Household Hub**, a production-ready, mobile-first Progressive Web Application (PWA) and synchronized Desktop CLI for Brandon and Meg that unifies three existing projects (**Meal Planner**, **Coffee Machine**, and **Coffee App**) into a single 3-pillar application (**Meals & Prep**, **Profitec/DF54 Espresso Bar**, and **Wine/Whiskey Cellar & Watchlist**), backed by the dedicated Sydney (`ap-southeast-2`) Supabase database (`anqaecdyipycajapmiev`), pushed to GitHub (`Xtrenium/household-hub`), and hosted live on Vercel.

Working directory: `C:\Users\User\Documents\AntiGravity Projects\Household Hub`
Integrity mode: development

## Reference Material & Existing Assets
- Existing Meal Planner source & data: `C:\Users\User\Documents\AntiGravity Projects\Meal Planner` (`saved_recipes.json`, `local_products.json`, `profiles.json`, `GEMINI.md`)
- Existing Coffee Machine engine, state & test suites: `C:\Users\User\Documents\AntiGravity Projects\Coffee Machine` (`.coffee_state.json`, `engine/coffee_hub.py`, `engine/water.py`, `engine/maintenance.py`, `engine/dialin.py`, `engine/recommender.py`, `tests/test_coffee_hub.py`)
- Existing Coffee App UI reference: `C:\Users\User\Documents\AntiGravity Projects\Coffee App`
- Barolo Watchlist seed dataset: `C:\Users\User\Documents\antigravity\quirky-volta\wine_experience_barolo_inventory.json`
- Provisioned Sydney (`ap-southeast-2`) Supabase project: `https://anqaecdyipycajapmiev.supabase.co` (credentials in `.env` and `scripts/seed_supabase.py` inside the working directory; all 8 tables and RLS policies already applied and seeded)

## Requirements

### R1. Unified 3-Pillar Mobile-First PWA, Auth & Household Profile Switching
Deliver an installable, responsive mobile-first web application (`manifest.json`, mobile viewport ergonomics, native `<dialog closedby="any">` modals with `overscroll-behavior: contain` scroll containment) protected by strict Supabase authentication (`signInWithPassword` with persistent sessions and Row Level Security blocking unauthenticated access). Provide a 1-tap in-app **Brandon / Meg** profile switcher persisted per device so Brandon's phone defaults to his 1,500 kcal / 160g P target (including his +100 kcal / +18g P high-protein yoghurt supplement) and Meg's phone defaults to her strict 1,400 kcal / 142g P target across 3 core meals. Exclude legacy bloat from `Coffee App`: no in-app Gemini chat or API key modal, no coffee blend studio, no pour-over stopwatch, no infinity bottle simulator, and zero fake sample data.

### R2. Pillar 1 — Meals & Prep (Multi-Day Batch Assigner, Dynamic Scaling & Google Keep Export)
Display and manage all 7 MacroFactor-verified recipes and 31 Coles-grounded products in Supabase (`public.recipes`, `public.products`, `public.meal_plan_blocks`). Provide a **Multi-Day / Slot Batch Assigner** where selecting a recipe once, choosing the target diners (`Both Adults`, `Brandon`, `Meg`, `Both Kids`, `Wolf`) and Cook Session (`Sunday Prep`, `Monday Night`, `Wednesday Night`), and toggling multiple day pills (`Sun`–`Sat` or cadence presets like `Mon–Fri`, `Sun–Thu`, `Sun–Fri`, `Mon/Tue/Thu/Fri`) assigns the entire batch without entering the same meal 5 times. Dynamically scale ingredient quantities, Coles package counts (`shop_packs`), and 3/2 burrito freeze splits based on total assigned servings (`assigned_days.length * diners_per_day`); display a 7-day macro and protein compliance strip; persist live step-by-step cooking checkoffs to Supabase; and provide a 1-tap **Google Keep Exporter** generating pristine shopping lists and recipe checklists (zero Markdown `- [ ]` brackets, zero bullet points, zero blank lines, grouped by `--- CATEGORY ---` headers).

### R3. Pillar 2 — Espresso Bar (Profitec Drive E61 + DF54 + Flojet/BWT Engine & Dual-Mode Shot Logging)
Integrate the exact domain math and state for the **Profitec Drive**, **Turin DF54**, and **Flojet BW5000 + BWT Bestmax Premium Size M** (`public.coffee_machine_state`, `public.coffee_bags`, `public.coffee_shots`). Provide side-by-side **Option 1: 1-Tap Quick Shot Logging** (`+1 Shot 18g` and `+2 Morning Coffees 36g`) and **Option 2: Detail Dial-In & 5-Axis Sensory Logging** (DF54 grind `#`, dose, yield, time, flow profile, and 1–5 sliders for Acidity, Sweetness, Body, Clarity, and Balance, computing Straight vs. Milk suitability scores 0–100 and extraction troubleshooting prescriptions). Both modes must atomically deduct the pulled dose from the active coffee bag's remaining weight and increment the E61 chemical backflush shot counter (35-shot warning / 40-shot overdue limit). Include 1-tap `+11L Neverfail Jug` water logging, dual-decay BWT filter monitoring (2,700L volumetric vs. `2027-04-18` 12-month calendar expiry), 1-tap completion resets for all 7 E61/DF54/Flojet maintenance tasks (enforcing the strict non-chlorine oxygen-sanitizer guardrail), 1–10 bag ratings (Overall, Black, Milk), and the 14-bean Australian Specialty Roaster Catalog & Recommender.

### R4. Pillar 3 — Cellar & Vault (Wine Cellar, Whiskey/Spirits Vault & Barolo Watchlist)
Manage owned cellar/vault bottles alongside the **Watchlist** pre-seeded with all 18 Wine Experience Barolo bottles (`public.cellar_bottles`, `public.cellar_tastings`). Support filtering by status (`All`, `In Cellar`, `Watchlist`) and category (`Wine`, `Whiskey & Spirits`), 1-tap stock count / spirit fill `%` updates, `BUY_AGAIN` / `TRY_NEXT` / `AVOID` verdicts, adding new bottles, and logging Sommelier SAT & BLIC (`Balance`, `Length`, `Intensity`, `Complexity`) + 100-point tastings with paired meals. Display drinking windows, decanting protocols, service temperatures, storage orientation rules (`Horizontal` for cork wine vs. `Strictly Vertical` for high-proof spirits), and Kamado Joe Big Joe III / Ninja Woodfire Pro BBQ pairing tags.

### R5. Controlled Infrastructure, Desktop CLI Sync Bridge, Git Repo & Vercel Deployment
- **Controlled Database Boundary:** Use ONLY the dedicated Sydney (`ap-southeast-2`) Supabase project `anqaecdyipycajapmiev` (`https://anqaecdyipycajapmiev.supabase.co`). NEVER modify or connect to the Work Costy Supabase project (`hkpjezgtykjvinztddod`).
- **Desktop Antigravity CLI Sync Bridge:** Provide a unified Python CLI (`engine/household_cli.py`) and workspace `GEMINI.md` that reads and writes directly to the `anqaecdyipycajapmiev` Supabase database (`status`, `swap-jug`, `log-shot`, `log-maint`, `rate-bag`, `recommend`, `recipes`, `cellar`) so Desktop Antigravity and the mobile PWA never diverge.
- **Git & Live Hosting:** Initialize and push the repository to GitHub (`https://github.com/Xtrenium/household-hub.git`, strictly excluding `.env` and secret keys) and deploy the production app to Vercel with SPA routing and security headers (`vercel.json`).

## Acceptance Criteria

### Build & Database Integrity
- [ ] `npm run build` (`tsc && vite build`) succeeds with 0 TypeScript or bundler errors.
- [ ] All 8 tables in `anqaecdyipycajapmiev` (`products`, `recipes`, `meal_plan_blocks`, `coffee_machine_state`, `coffee_bags`, `coffee_shots`, `cellar_bottles`, `cellar_tastings`) have Row Level Security (RLS) enabled (`rowsecurity = true`), blocking `anon` reads/writes while permitting authenticated household operations.
- [ ] Database contains all 31 Coles products, 7 MacroFactor recipes (where each recipe's headline `macros_per_serving` equals the mathematical sum of its ingredients), 6 default multi-day meal plan blocks, the Profitec Drive + DF54 + BWT state, 14 Australian specialty coffee bags, and 18 Wine Experience Barolo watchlist bottles, with 0 fake sample bottles from the old `Coffee App`.

### Domain Logic & CLI Verification
- [ ] Automated Python/TypeScript unit and integration tests verify: (a) Straight vs. Milk suitability score calculations and extraction troubleshooting match the reference formulas from `Coffee Machine/engine/dialin.py`, (b) BWT dual-decay water status and E61 35-warning / 40-target shot counter transitions (`OK` → `DUE_SOON` → `OVERDUE`), and (c) `python engine/household_cli.py status --json` returns valid live state from Supabase.
- [ ] Google Keep export generator produces output with 0 Markdown checkbox brackets (`- [ ]`), 0 bullet prefixes (`- ` or `* `), and 0 empty blank lines.

### End-to-End UI & Deployment Verification
- [ ] Automated Playwright E2E tests verify login via `AuthGate`, switching between **Brandon (1,500 kcal)** and **Meg (1,400 kcal)** profiles, creating/scaling a multi-day batch in **Meals & Prep**, copying the Google Keep shopping list, executing both **Quick Shot Log (`+1 Shot`)** and **Detail Dial-In Shot Log** in **Espresso Bar** (verifying bag gram deduction and E61 counter increment), and filtering/updating bottles in **Cellar & Vault**.
- [ ] Code is committed and pushed to GitHub (`Xtrenium/household-hub` with zero leaked secrets in tracked files) and deployed to a live Vercel URL returning HTTP 200.
