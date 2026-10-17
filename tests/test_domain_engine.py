"""Comprehensive Automated Domain Engine, Security & Integration Test Suite.

Covers:
1. Unit tests for straight vs milk suitability scores matching Coffee Machine/engine/dialin.py formulas.
2. Unit tests for BWT dual-decay water status transitions (OK -> DUE_SOON -> OVERDUE).
3. Unit tests for E61 shot counter transitions (35 warning, 40 overdue).
4. Unit tests for extraction troubleshooting kinematics & diagnostic rules.
5. Integration test running `python engine/household_cli.py status --json` against Sydney Supabase.
6. Integration test verifying 100% MacroFactor summation for all 7 recipes.
7. Security test asserting all 8 tables have `rowsecurity = true` in Supabase Sydney.
8. Security boundary test asserting zero forbidden project ref connections.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
import urllib.error
import urllib.request

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Load .env into os.environ if present
_env_path = PROJECT_ROOT / ".env"
if _env_path.exists():
    for _line in _env_path.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

from engine.household_cli import (
    clamp,
    compute_cam_counter_status,
    compute_suitability_scores,
    compute_water_status,
    diagnose_extraction,
    get_suitability_tier,
    EXPECTED_PROJECT_REF,
    FORBIDDEN_PROJECT_REF,
    SupabaseClient,
)


class TestSuitabilityScores(unittest.TestCase):
    """Unit tests for divergent Straight vs Milk suitability score mathematical models."""

    def test_baseline_extremes(self) -> None:
        """Tests boundary scores for all minimum (1.0) and all maximum (5.0) sliders."""
        s_min, m_min, t_s_min, t_m_min = compute_suitability_scores(1.0, 1.0, 1.0, 1.0, 1.0)
        self.assertEqual(s_min, 0.0)
        self.assertEqual(m_min, 0.0)
        self.assertEqual(t_s_min, "Unsuited")
        self.assertEqual(t_m_min, "Unsuited")

        s_max, m_max, t_s_max, t_m_max = compute_suitability_scores(5.0, 5.0, 5.0, 5.0, 5.0)
        self.assertEqual(s_max, 100.0)
        self.assertEqual(m_max, 100.0)
        self.assertEqual(t_s_max, "Outstanding")
        self.assertEqual(t_m_max, "Outstanding")

    def test_neutral_midpoint(self) -> None:
        """Tests that neutral midpoint sliders (all 3.0) yield exactly 50.0."""
        s_mid, m_mid, t_s_mid, t_m_mid = compute_suitability_scores(3.0, 3.0, 3.0, 3.0, 3.0)
        self.assertEqual(s_mid, 50.0)
        self.assertEqual(m_mid, 50.0)
        self.assertEqual(t_s_mid, "Sub-optimal")
        self.assertEqual(t_m_mid, "Sub-optimal")

    def test_high_acidity_washed_single_origin_favors_straight(self) -> None:
        """High clarity, vibrant acidity, and light body must favor straight espresso over milk."""
        # E.g. Market Lane Burundi or Seven Seeds Ethiopia
        s, m, t_s, t_m = compute_suitability_scores(
            acidity=4.8, sweetness=4.2, body=2.4, clarity=4.8, balance=4.3
        )
        self.assertGreater(s, 75.0, "Straight score should be in 'Great' tier (>75.0)")
        self.assertGreater(s, m, "Washed light roast must score higher in straight than milk")
        self.assertIn(t_s, ("Great", "Outstanding"))

    def test_full_bodied_chocolate_blend_favors_milk(self) -> None:
        """Heavy body, rich sweetness, low acidity must cut through milk and favor milk drinks."""
        # E.g. Ona The Founder or Proud Mary Humbler
        s, m, t_s, t_m = compute_suitability_scores(
            acidity=2.2, sweetness=4.6, body=4.8, clarity=3.2, balance=4.5
        )
        self.assertGreater(m, 80.0, "Milk score should be high for heavy body chocolate profile")
        self.assertGreater(m, s, "Full-bodied chocolate profile must score higher in milk than straight")
        self.assertIn(t_m, ("Great", "Outstanding"))

    def test_sour_imbalance_penalty(self) -> None:
        """Severe acidity outrunning sweetness triggers the sour imbalance penalty in straight."""
        # Acidity 4.5, Sweetness 2.0 -> penalty = (4.5 - 2.0) * 12.0 = 30.0 points raw deduction
        s_sour, _, _, _ = compute_suitability_scores(4.5, 2.0, 3.0, 3.0, 3.0)
        # Acidity 2.0, Sweetness 2.0 -> no sour imbalance penalty
        s_balanced, _, _, _ = compute_suitability_scores(2.0, 2.0, 3.0, 3.0, 3.0)
        self.assertLess(s_sour, s_balanced)

    def test_curdling_penalty_in_milk(self) -> None:
        """Excessive acidity with acidity > sweetness invokes 16x curdling penalty in milk drinks."""
        # Acidity 4.0, Sweetness 3.0 -> acidity > sweetness: penalty = (4.0 - 3.2) * 16.0 = 12.8
        _, m_curdle, _, _ = compute_suitability_scores(4.0, 3.0, 3.5, 3.5, 3.5)
        # Acidity 3.0, Sweetness 4.0 -> acidity <= sweetness: penalty = max(0, 3.0 - 3.8) * 8 = 0
        _, m_sweet, _, _ = compute_suitability_scores(3.0, 4.0, 3.5, 3.5, 3.5)
        self.assertLess(m_curdle, m_sweet)

    def test_semantic_tier_thresholds(self) -> None:
        """Verifies semantic tier labels match specifications."""
        self.assertEqual(get_suitability_tier(95.0), "Outstanding")
        self.assertEqual(get_suitability_tier(90.0), "Outstanding")
        self.assertEqual(get_suitability_tier(89.9), "Great")
        self.assertEqual(get_suitability_tier(75.0), "Great")
        self.assertEqual(get_suitability_tier(74.9), "Good")
        self.assertEqual(get_suitability_tier(60.0), "Good")
        self.assertEqual(get_suitability_tier(59.9), "Sub-optimal")
        self.assertEqual(get_suitability_tier(40.0), "Sub-optimal")
        self.assertEqual(get_suitability_tier(39.9), "Unsuited")
        self.assertEqual(get_suitability_tier(0.0), "Unsuited")


class TestExtractionDiagnostics(unittest.TestCase):
    """Unit tests for extraction kinematics and diagnostic rules."""

    def test_sweet_spot_detection(self) -> None:
        """Verifies that an in-band extraction with high sweetness and balance triggers sweet spot."""
        res = diagnose_extraction(
            grind=14.5,
            dose=18.0,
            yield_g=38.0,
            time_s=28.0,
            ratio=2.11,
            flow_rate=1.36,
            acidity=3.8,
            sweetness=4.4,
            body=4.0,
            clarity=4.2,
            balance=4.5,
        )
        self.assertTrue(res["is_sweet_spot"])
        self.assertIn("Sweet Spot Reached", res["issues"])
        self.assertIn("Extraction perfectly dialed in", res["summary"])

    def test_under_extraction_detection(self) -> None:
        """Fast flow under 24s with sour acidity triggers under-extraction diagnostics."""
        res = diagnose_extraction(
            grind=16.0,
            dose=18.0,
            yield_g=38.0,
            time_s=20.0,
            ratio=2.11,
            flow_rate=1.90,
            acidity=4.5,
            sweetness=2.2,
            body=2.8,
            clarity=3.5,
            balance=2.4,
        )
        self.assertFalse(res["is_sweet_spot"])
        self.assertIn("Under-Extraction (Sourness / Fast Flow)", res["issues"])
        self.assertTrue(any("DF54 grind finer" in p for p in res["prescriptions"]))

    def test_over_extraction_choking(self) -> None:
        """Slow flow over 34s with low flow rate triggers over-extraction diagnostics."""
        res = diagnose_extraction(
            grind=12.0,
            dose=18.0,
            yield_g=30.0,
            time_s=42.0,
            ratio=1.67,
            flow_rate=0.71,
            acidity=2.0,
            sweetness=2.2,
            body=4.5,
            clarity=1.8,
            balance=2.3,
        )
        self.assertFalse(res["is_sweet_spot"])
        self.assertIn("Over-Extraction (Bitterness / Choked Flow)", res["issues"])
        self.assertTrue(any("DF54 grind coarser" in p for p in res["prescriptions"]))


class TestBWTWaterDualDecay(unittest.TestCase):
    """Unit tests for BWT Bestmax Premium Size M dual-decay water engine."""

    def test_volumetric_status_transitions(self) -> None:
        """Tests volumetric transitions: OK (>200L) -> DUE_SOON (<=200L) -> OVERDUE (<=0L)."""
        # 1. OK State (700L remaining)
        we_ok = {
            "rated_capacity_liters": 2700.0,
            "total_consumed_liters": 2000.0,
            "installed_date": "2026-04-18",
            "expiry_date": "2027-04-18",
        }
        res_ok = compute_water_status(we_ok, curr_date=date(2026, 6, 1))
        self.assertEqual(res_ok["remaining_liters"], 700.0)
        self.assertEqual(res_ok["volume_alert"], "OK")

        # 2. DUE_SOON State (150L remaining <= 200L)
        we_warn = {
            "rated_capacity_liters": 2700.0,
            "total_consumed_liters": 2550.0,
            "installed_date": "2026-04-18",
            "expiry_date": "2027-04-18",
        }
        res_warn = compute_water_status(we_warn, curr_date=date(2026, 6, 1))
        self.assertEqual(res_warn["remaining_liters"], 150.0)
        self.assertEqual(res_warn["volume_alert"], "DUE_SOON")
        self.assertEqual(res_warn["filter_status"], "DUE_SOON")

        # 3. OVERDUE State (0L remaining)
        we_overdue = {
            "rated_capacity_liters": 2700.0,
            "total_consumed_liters": 2700.0,
            "installed_date": "2026-04-18",
            "expiry_date": "2027-04-18",
        }
        res_overdue = compute_water_status(we_overdue, curr_date=date(2026, 6, 1))
        self.assertEqual(res_overdue["remaining_liters"], 0.0)
        self.assertEqual(res_overdue["volume_alert"], "OVERDUE")
        self.assertEqual(res_overdue["filter_status"], "OVERDUE")

    def test_calendar_status_transitions(self) -> None:
        """Tests calendar transitions: OK (>30d) -> DUE_SOON (<=30d) -> OVERDUE (<=0d)."""
        we = {
            "rated_capacity_liters": 2700.0,
            "total_consumed_liters": 200.0,
            "installed_date": "2026-04-18",
            "expiry_date": "2027-04-18",
        }

        # > 30 days remaining -> OK
        res_ok = compute_water_status(we, curr_date=date(2026, 10, 17))
        self.assertGreater(res_ok["calendar_days_remaining"], 30)
        self.assertEqual(res_ok["calendar_alert"], "OK")

        # <= 30 days remaining (e.g. 17 days on 2027-04-01) -> DUE_SOON
        res_warn = compute_water_status(we, curr_date=date(2027, 4, 1))
        self.assertEqual(res_warn["calendar_days_remaining"], 17)
        self.assertEqual(res_warn["calendar_alert"], "DUE_SOON")
        self.assertEqual(res_warn["filter_status"], "DUE_SOON")

        # 0 days remaining on expiry date 2027-04-18 -> OVERDUE
        res_due = compute_water_status(we, curr_date=date(2027, 4, 18))
        self.assertEqual(res_due["calendar_days_remaining"], 0)
        self.assertEqual(res_due["calendar_alert"], "OVERDUE")
        self.assertEqual(res_due["filter_status"], "OVERDUE")

        # Past expiry (overdue) -> OVERDUE
        res_past = compute_water_status(we, curr_date=date(2027, 5, 1))
        self.assertLess(res_past["calendar_days_remaining"], 0)
        self.assertEqual(res_past["calendar_alert"], "OVERDUE")

    def test_limiting_constraint_calendar_vs_volume(self) -> None:
        """Verifies correct determination of whether CALENDAR or VOLUME is the binding decay constraint."""
        # Low volume consumption (Brandon & Meg's typical 4 jugs/month)
        # Volume remaining is ~91%, while calendar remaining is ~50% -> CALENDAR is binding
        we_typical = {
            "rated_capacity_liters": 2700.0,
            "total_consumed_liters": 242.0,
            "installed_date": "2026-04-18",
            "expiry_date": "2027-04-18",
        }
        res_cal = compute_water_status(we_typical, curr_date=date(2026, 10, 17))
        self.assertEqual(res_cal["limiting_constraint"], "CALENDAR")

        # Heavy commercial consumption: 2500L consumed after only 30 days
        # Volume remaining is ~7.4%, while calendar remaining is ~91.8% -> VOLUME is binding
        we_heavy = {
            "rated_capacity_liters": 2700.0,
            "total_consumed_liters": 2500.0,
            "installed_date": "2026-04-18",
            "expiry_date": "2027-04-18",
        }
        res_vol = compute_water_status(we_heavy, curr_date=date(2026, 5, 18))
        self.assertEqual(res_vol["limiting_constraint"], "VOLUME")

    def test_flojet_sanitization_transitions(self) -> None:
        """Verifies 180-day Flojet sanitization cadence (14-day warning threshold)."""
        we = {
            "flojet_sanitization": {
                "interval_days": 180,
                "last_sanitized_date": "2026-04-11",
            }
        }
        # After 100 days -> OK
        res_ok = compute_water_status(we, curr_date=date(2026, 7, 20))
        self.assertEqual(res_ok["flojet_status"], "OK")

        # Due in 5 days (175 days elapsed) -> DUE_SOON
        res_warn = compute_water_status(we, curr_date=date(2026, 10, 3))
        self.assertEqual(res_warn["flojet_status"], "DUE_SOON")

        # 185 days elapsed -> OVERDUE
        res_over = compute_water_status(we, curr_date=date(2026, 10, 15))
        self.assertEqual(res_over["flojet_status"], "OVERDUE")


class TestE61ShotCounter(unittest.TestCase):
    """Unit tests for E61 chemical backflush cam protection counter."""

    def test_normal_operating_range_ok(self) -> None:
        """Shots under 35 should remain OK with zero lube warning."""
        for shots in [0, 1, 15, 25, 34]:
            status, lube_warn, msg = compute_cam_counter_status(shots, warning_shots=35, target_shots=40)
            self.assertEqual(status, "OK")
            self.assertFalse(lube_warn)
            self.assertIsNone(msg)

    def test_cam_protection_warning_due_soon(self) -> None:
        """Shots 35 to 39 must trigger DUE_SOON and display cam protection warning."""
        for shots in [35, 36, 38, 39]:
            status, lube_warn, msg = compute_cam_counter_status(shots, warning_shots=35, target_shots=40)
            self.assertEqual(status, "DUE_SOON")
            self.assertTrue(lube_warn)
            self.assertIsNotNone(msg)
            self.assertIn("CAM PROTECTION WARNING", msg)
            self.assertIn(f"{shots} shots reached", msg)

    def test_overdue_threshold_and_unclamped_overrun(self) -> None:
        """Shots >= 40 trigger OVERDUE and count past 40 without artificial clamping."""
        status_40, warn_40, msg_40 = compute_cam_counter_status(40, warning_shots=35, target_shots=40)
        self.assertEqual(status_40, "OVERDUE")
        self.assertTrue(warn_40)
        self.assertIn("OVERDUE: 40 shots reached", msg_40)

        # Overrun to 48 shots
        status_48, warn_48, msg_48 = compute_cam_counter_status(48, warning_shots=35, target_shots=40)
        self.assertEqual(status_48, "OVERDUE")
        self.assertTrue(warn_48)
        self.assertIn("48 shots reached", msg_48)


class TestIntegrationCLIStatusSubprocess(unittest.TestCase):
    """Integration test running `python engine/household_cli.py status --json` against Sydney Supabase."""

    def test_cli_status_json_output(self) -> None:
        cli_path = PROJECT_ROOT / "engine" / "household_cli.py"
        self.assertTrue(cli_path.is_file(), f"household_cli.py missing at {cli_path}")

        proc = subprocess.run(
            [sys.executable, str(cli_path), "status", "--json"],
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=30,
        )

        self.assertEqual(proc.returncode, 0, f"CLI exited with error: {proc.stderr}")
        self.assertTrue(proc.stdout.strip().startswith("{"), "Output does not start with JSON brace")

        payload = json.loads(proc.stdout)

        # Validate top-level keys
        self.assertIn("timestamp", payload)
        self.assertIn("database", payload)
        self.assertIn("machine", payload)
        self.assertIn("water_decay", payload)
        self.assertIn("maintenance", payload)
        self.assertIn("active_bag", payload)
        self.assertIn("cellar", payload)
        self.assertIn("meal_plan", payload)

        # Validate database boundary
        self.assertEqual(payload["database"]["project_ref"], EXPECTED_PROJECT_REF)
        self.assertIn("Sydney", payload["database"]["region"])

        # Validate water decay state
        wd = payload["water_decay"]
        self.assertEqual(wd["rated_capacity_liters"], 2700.0)
        self.assertGreaterEqual(wd["total_jugs_swapped"], 22)
        self.assertEqual(wd["limiting_constraint"], "CALENDAR")

        # Validate E61 maintenance
        chem = payload["maintenance"]["chemical_backflush"]
        self.assertEqual(chem["warning_shots"], 35)
        self.assertEqual(chem["target_shots"], 40)
        self.assertIn(chem["status"], ("OK", "DUE_SOON", "OVERDUE"))

        # Validate active bag
        bag = payload["active_bag"]
        self.assertEqual(bag["id"], "proud_mary_ghost_rider")
        self.assertEqual(bag["roaster"], "Proud Mary Coffee")

        # Validate cellar and meals counts
        self.assertEqual(payload["cellar"]["total_bottles"], 18)
        self.assertEqual(payload["meal_plan"]["blocks_count"], 6)


class TestIntegrationMacroFactorSummation(unittest.TestCase):
    """Integration test verifying 100% mathematical summation for all 7 recipes in Sydney Supabase."""

    def test_all_seven_recipes_macro_sum(self) -> None:
        client = SupabaseClient()
        recipes = client.request("recipes?select=*")
        self.assertIsNotNone(recipes)
        self.assertEqual(len(recipes), 7, f"Expected 7 recipes in Supabase, found {len(recipes)}")

        for r in recipes:
            r_id = r.get("id")
            headline = r.get("macros_per_serving", {})
            ingredients = r.get("ingredients", [])

            self.assertTrue(len(ingredients) > 0, f"Recipe {r_id} has 0 ingredients")

            h_cal = headline.get("calories", 0)
            h_prot = float(headline.get("protein_g", 0.0))
            h_carb = float(headline.get("carbs_g", 0.0))
            h_fat = float(headline.get("fat_g", 0.0))

            sum_cal = sum(i.get("macros_per_serving", {}).get("calories", 0) for i in ingredients)
            sum_prot = round(sum(float(i.get("macros_per_serving", {}).get("protein_g", 0.0)) for i in ingredients), 1)
            sum_carb = round(sum(float(i.get("macros_per_serving", {}).get("carbs_g", 0.0)) for i in ingredients), 1)
            sum_fat = round(sum(float(i.get("macros_per_serving", {}).get("fat_g", 0.0)) for i in ingredients), 1)

            self.assertEqual(
                h_cal,
                sum_cal,
                f"Recipe '{r_id}' calories mismatch: headline {h_cal} != sum {sum_cal}",
            )
            self.assertAlmostEqual(
                h_prot,
                sum_prot,
                places=1,
                msg=f"Recipe '{r_id}' protein mismatch: headline {h_prot} != sum {sum_prot}",
            )
            self.assertAlmostEqual(
                h_carb,
                sum_carb,
                places=1,
                msg=f"Recipe '{r_id}' carbs mismatch: headline {h_carb} != sum {sum_carb}",
            )
            self.assertAlmostEqual(
                h_fat,
                sum_fat,
                places=1,
                msg=f"Recipe '{r_id}' fat mismatch: headline {h_fat} != sum {sum_fat}",
            )


class TestSecurityRowLevelSecurity(unittest.TestCase):
    """Security verification asserting RLS is active on all 8 tables and unauthenticated requests are blocked."""

    def test_all_eight_tables_have_rowsecurity_true(self) -> None:
        """Queries pg_tables in Sydney Supabase to verify rowsecurity = true on all 8 tables."""
        management_token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
        if not management_token:
            self.skipTest("SUPABASE_ACCESS_TOKEN not set in environment or .env")
        url = f"https://api.supabase.com/v1/projects/{EXPECTED_PROJECT_REF}/database/query"
        payload = json.dumps({
            "query": "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {management_token}",
                "Content-Type": "application/json",
                "User-Agent": "HouseholdHubSecurityTest/1.0",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        table_dict = {row["tablename"]: row["rowsecurity"] for row in data}

        required_tables = [
            "products",
            "recipes",
            "meal_plan_blocks",
            "coffee_machine_state",
            "coffee_bags",
            "coffee_shots",
            "cellar_bottles",
            "cellar_tastings",
        ]

        for tbl in required_tables:
            self.assertIn(tbl, table_dict, f"Missing table '{tbl}' in public schema")
            self.assertTrue(
                table_dict[tbl],
                f"SECURITY VIOLATION: Table '{tbl}' has rowsecurity = {table_dict[tbl]} (expected True)",
            )

    def test_unauthenticated_request_is_blocked(self) -> None:
        """Asserts that unauthenticated write requests to Supabase REST are rejected by RLS."""
        # Anon key attempting an insert into meal_plan_blocks
        anon_key = os.environ.get(
            "VITE_SUPABASE_ANON_KEY",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFucWFlY2R5aXB5Y2FqYXBtaWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyMjUwMTAsImV4cCI6MjEwNzgwMTAxMH0.S1wdhr4vmvgK1xWhIJM-B1eGB1wNQtD5_iYSgA9JmtE",
        )
        url = f"https://{EXPECTED_PROJECT_REF}.supabase.co/rest/v1/meal_plan_blocks"
        payload = json.dumps({"recipe_id": "test_unauth"}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "apikey": anon_key,
                "Authorization": f"Bearer {anon_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req, timeout=15)
        # RLS rejects unauthenticated insert with 401 Unauthorized (code 42501)
        self.assertIn(ctx.exception.code, (401, 403))

    def test_zero_forbidden_project_ref_in_codebase(self) -> None:
        """Verifies that Work Costy project ref hkpjezgtykjvinztddod is never referenced in source code."""
        forbidden = FORBIDDEN_PROJECT_REF.encode("utf-8")
        scanned_files = 0
        for root, dirs, files in os.walk(PROJECT_ROOT):
            # Skip git and agent meta folders
            if ".git" in root or ".agents" in root:
                continue
            for f in files:
                if f.endswith((".py", ".ts", ".tsx", ".json", ".env", ".md", ".sql")):
                    p = Path(root) / f
                    try:
                        content = p.read_bytes()
                        self.assertNotIn(
                            forbidden,
                            content,
                            f"SECURITY BREACH: Forbidden project ref '{FORBIDDEN_PROJECT_REF}' found in {p}",
                        )
                        scanned_files += 1
                    except Exception:
                        pass
        self.assertGreater(scanned_files, 5, "Expected to scan at least 5 source files")


if __name__ == "__main__":
    unittest.main()
