# Antigravity Workspace Rule — Household Hub (Brandon & Meg)

This workspace powers **Household Hub**, unifying Meals & Prep, Profitec/DF54 Espresso Bar, and Cellar & Vault for Brandon & Meg, backed by the dedicated Sydney (`ap-southeast-2`) Supabase database (`anqaecdyipycajapmiev`), pushed to GitHub (`Xtrenium/household-hub`), and deployed to Vercel.

---

## 1. Controlled Database Boundary

- **STRICT MANDATE**: Connect ONLY to the dedicated Sydney (`ap-southeast-2`) Supabase project `anqaecdyipycajapmiev` (`https://anqaecdyipycajapmiev.supabase.co`).
- **PROHIBITED REFERENCE**: NEVER query, modify, or reference the Work Costy database (`hkpjezgtykjvinztddod`).
- All 8 database tables enforce Row Level Security (`rowsecurity = true`) and require authenticated household authorization (`household_auth_all`).

---

## 2. Desktop CLI Sync Bridge (Mandatory Execution Protocol)

Whenever the user mentions cooking or meal prep, pulling espresso shots, swapping spring water jugs, performing machine maintenance, rating coffee bags, or managing wine/spirits bottles, **never rely on conversational memory alone**. Execute operations via `engine/household_cli.py` to ensure desktop AI interactions and the mobile PWA remain 100% synchronized in real time.

### CLI Command Reference:

| Intent | CLI Command | Notes |
|---|---|---|
| **System Cockpit** | `python engine/household_cli.py status` | Add `--json` for machine-readable JSON |
| **Swap Water Jug** | `python engine/household_cli.py swap-jug --volume 11.0` | Adds 11L, decrements BWT remaining |
| **Quick 1-Tap Shot** | `python engine/household_cli.py log-shot --quick 1` | 18g in, 38g out, 28s; decrements active bag, increments E61 counter |
| **Morning Double Shot** | `python engine/household_cli.py log-shot --quick 2` | 36g in (Brandon & Meg), 2 shots counted |
| **Detail Dial-In Shot** | `python engine/household_cli.py log-shot --grind 14.5 --dose 18.0 --yield 38.0 --time 28.0 --acidity 4.2 --sweetness 4.6 --body 4.0 --clarity 4.2 --balance 4.5 --notes "Dialing in"` | Computes 0–100 Straight & Milk suitability and troubleshooting diagnostics |
| **Reset Maintenance** | `python engine/household_cli.py log-maint chemical_backflush` | Resets shot counter to 0; enforces seasoning shot protocol |
| **Reset Water Filter** | `python engine/household_cli.py log-maint water_filter_replace` | Resets liters and extends calendar expiry by 365 days |
| **Sanitize Flojet** | `python engine/household_cli.py log-maint flojet_sanitization` | Enforces oxygen sanitizer guardrail |
| **Rate Coffee Bag** | `python engine/household_cli.py rate-bag proud_mary_ghost_rider 9.0 8.8 9.2 --tags "Blueberry,Cream"` | Updates bag ratings and preference profile affinities |
| **Roaster Recommendations**| `python engine/household_cli.py recommend --drink straight` | Utility ranking across 14 Australian specialty roasters |
| **MacroFactor Recipes** | `python engine/household_cli.py recipes` | Lists 7 recipes with verified ingredients and macros |
| **Cellar & Watchlist** | `python engine/household_cli.py cellar --status watchlist` | Lists Barolo watchlist and owned bottles |

---

## 3. Equipment Safety Rules & Physical Guardrails

### 3.1 Flojet BW5000 & BWT Water Safety Guardrail
- **OXYGEN-BASED SANITIZER ONLY**: Always sanitize Flojet suction wand and lines with **Cafetto Inverso** or **100% Sodium Percarbonate**.
- **STRICT PROHIBITION**: NEVER use chlorine, bleach, or Milton tablets. Chlorides cause catastrophic stress corrosion cracking and pitting in stainless steel boilers and permanently destroy BWT ion-exchange resin.
- **Disconnection Invariant**: Always disconnect the Flojet line upstream of the BWT Bestmax filter head before circulating sanitizer, flushing thoroughly with fresh spring water before reconnecting.

### 3.2 E61 Grouphead Cam Protection & Metering
- **Shot Counter Ceilings**: Chemical detergent backflushing strips the food-safe silicone lubricant (**DuPont Molykote 111**) from internal brass cams. Chemical backflushes are strictly metered to **every 35–40 shots** (warning at 35 shots, overdue ceiling at 40 shots).
- **Mandatory Seasoning Shot**: Immediately following any chemical detergent backflush, pull and discard 1 double espresso shot to restore a protective coffee lipid boundary across brass cam surfaces.
- **Daily Cleaning**: Use plain hot water backflushes (blind basket, 3–5 pulses of 5s) daily. Plain water does not strip cam lubrication.
- **Cam Re-greasing**: Disassemble operating lever shaft every 180 days and lubricate internal brass cams with NSF H1 certified DuPont Molykote 111 or Haynes Lubri-Film.

### 3.3 Boiler Longevity & No Chemical Descaling
- **Zero Chemical Descaling**: Never advise pumping chemical descaling acids through the Profitec Drive dual boilers (corrodes heating elements and nickel/chrome plating).
- **Steam Boiler TDS Flush**: Evacuate 1.5–2.0L water from the hot water tap under pressure (1.2–1.5 bar) every 60 days with main power switched OFF to flush out concentrated mineral salts.

---

## 4. Household Profiles & Macro Targets

- **Brandon Profile**: Default 1,500 kcal / 160g Protein per day across 3 core batch meals, plus his dedicated +100 kcal / +18g Protein high-protein yoghurt supplement (YoPRO 15g P pouch or Chobani Fit).
- **Meg Profile**: Default strict 1,400 kcal / 142g Protein target per day evenly distributed across the 3 core batch meals (Breakfast ~500 kcal, Lunch ~425 kcal, Dinner ~475 kcal).
- **Pillar 1 Meals & Prep**: All 7 recipes are verified with 100% mathematical summation between itemized ingredients and headline macros. Multi-day batch assigner dynamically scales Coles package counts (`shop_packs`) and manages the 3/2 burrito freeze split (Mon/Tue in fridge, Wed/Thu/Fri in foil in freezer).
- **Google Keep Export Standard**: Pristine checklists only — zero Markdown brackets (`- [ ]`), zero bullet points (`- ` or `* `), zero blank lines, grouped under `--- CATEGORY ---` section headers.
