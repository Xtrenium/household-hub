#!/usr/bin/env python3
"""Household Hub Desktop Antigravity CLI Sync Bridge.

Provides bidirectional synchronization with the dedicated Sydney (ap-southeast-2)
Supabase database (anqaecdyipycajapmiev) for:
- Live Status Cockpit (Machine, BWT Dual-Decay Water, E61 Maintenance, Cellar, Meals)
- Water Jug Swap (+11L Neverfail Jug)
- Dual-Mode Shot Logging (Quick Shot vs 5-Axis Sensory Dial-In)
- Maintenance Task Reset with Equipment Safety Guardrails
- 1-10 Coffee Bag Rating & Preference Profile Learning
- 14-Bean Specialty Roaster Recommendations
- 7 MacroFactor Verified Recipes & Macros
- Wine Cellar & Barolo Watchlist Inventory

STRICT REQUIREMENT: Uses Python standard library only (urllib.request, json, argparse, sys, os, datetime).
"""

from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
import urllib.error
import urllib.request
import uuid

# Ensure Windows stdout/stderr handles UTF-8 smoothly
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

EXPECTED_PROJECT_REF = "anqaecdyipycajapmiev"
FORBIDDEN_PROJECT_REF = "hkpjezgtykjvinztddod"

# Equipment Safety Constants
RATED_CAPACITY_L = 2700.0
JUG_VOLUME_L = 11.0
WATER_WARNING_L = 200.0
WATER_WARNING_DAYS = 30
E61_WARNING_SHOTS = 35
E61_TARGET_SHOTS = 40
FLOJET_INTERVAL_DAYS = 180
FLOJET_WARNING_DAYS = 14
E61_CAM_GREASE_INTERVAL_DAYS = 180
E61_CAM_GREASE_WARNING_DAYS = 14
STEAM_BOILER_FLUSH_INTERVAL_DAYS = 60
STEAM_BOILER_FLUSH_WARNING_DAYS = 7
STEAM_WAND_SOAK_INTERVAL_DAYS = 14
STEAM_WAND_SOAK_WARNING_DAYS = 3
DF54_BURR_CLEAN_INTERVAL_DAYS = 30
DF54_BURR_CLEAN_WARNING_DAYS = 5
SHOWER_SCREEN_INTERVAL_DAYS = 30
SHOWER_SCREEN_WARNING_DAYS = 5


# ==============================================================================
# 1. DOMAIN MATH & KINEMATICS
# ==============================================================================

def clamp(val: float, low: float, high: float) -> float:
    """Clamps a numeric value strictly within [low, high]."""
    return max(low, min(high, float(val)))


def get_suitability_tier(score: float) -> str:
    """Returns qualitative semantic tier for a [0, 100] suitability score."""
    if score >= 90.0:
        return "Outstanding"
    if score >= 75.0:
        return "Great"
    if score >= 60.0:
        return "Good"
    if score >= 40.0:
        return "Sub-optimal"
    return "Unsuited"


def compute_suitability_scores(
    acidity: float, sweetness: float, body: float, clarity: float, balance: float
) -> Tuple[float, float, str, str]:
    """Computes normalized [0, 100] suitability scores for Straight Espresso vs Milk Drinks.
    
    Exact port of reference formulas from Coffee Machine/engine/dialin.py.
    """
    a = clamp(acidity, 1.0, 5.0)
    s = clamp(sweetness, 1.0, 5.0)
    b = clamp(body, 1.0, 5.0)
    c = clamp(clarity, 1.0, 5.0)
    bal = clamp(balance, 1.0, 5.0)

    # 1. Straight Espresso / Long Black Suitability
    raw_straight = (22.0 * bal) + (20.0 * s) + (18.0 * c) + (12.0 * b) + (10.0 * a)
    penalty_sour_imbalance = max(0.0, a - s) * 12.0
    penalty_harsh_astringency = max(0.0, 3.0 - c) * 8.0 if bal <= 3.0 else 0.0
    bonus_sweet_spot = (max(0.0, s - 4.0) * 10.0) + (max(0.0, bal - 4.0) * 10.0)
    adj_straight = raw_straight - penalty_sour_imbalance - penalty_harsh_astringency + bonus_sweet_spot
    score_straight = clamp(((adj_straight - 82.0) / (410.0 - 82.0)) * 100.0, 0.0, 100.0)
    score_straight = round(score_straight, 1)

    # 2. Milk-Based Drink Suitability
    raw_milk = (28.0 * b) + (26.0 * s) + (18.0 * bal) + (10.0 * c) + (8.0 * a)
    if a > s:
        penalty_curdle = max(0.0, a - 3.2) * 16.0
    else:
        penalty_curdle = max(0.0, a - 3.8) * 8.0
    penalty_thin_body = max(0.0, 2.8 - b) * 20.0
    bonus_milk_synergy = (max(0.0, b - 4.0) * 15.0) + (max(0.0, s - 4.0) * 15.0)
    adj_milk = raw_milk - penalty_curdle - penalty_thin_body + bonus_milk_synergy
    score_milk = clamp(((adj_milk - 90.0) / (450.0 - 90.0)) * 100.0, 0.0, 100.0)
    score_milk = round(score_milk, 1)

    return (
        score_straight,
        score_milk,
        get_suitability_tier(score_straight),
        get_suitability_tier(score_milk),
    )


def diagnose_extraction(
    grind: float,
    dose: float,
    yield_g: float,
    time_s: float,
    ratio: float,
    flow_rate: float,
    acidity: float,
    sweetness: float,
    body: float,
    clarity: float,
    balance: float,
    flow_profile: str = "",
) -> Dict[str, Any]:
    """Generates extraction troubleshooting advice and flags sweet spot."""
    issues: List[str] = []
    prescriptions: List[str] = []

    # Channeling & Puck Fracture
    if (acidity >= 3.8 and clarity <= 2.2 and balance <= 2.5) or flow_rate > 1.85:
        issues.append("Channeling & Puck Fracture")
        prescriptions.append("Declump thoroughly with a 0.3mm needle WDT tool and tamp level.")
        prescriptions.append("Add a 1.7mm puck screen to distribute water evenly and prevent bed erosion.")
        prescriptions.append("Engage soft pre-infusion (paddle cracked 1/4 turn @ 2.5 bar for 6-8s).")

    # Under-Extraction (Sourness / Fast Flow)
    if time_s < 24.0 or flow_rate > 1.55 or (acidity >= 3.8 and sweetness <= 2.5):
        issues.append("Under-Extraction (Sourness / Fast Flow)")
        prescriptions.append("Adjust DF54 grind finer by -0.8 to -1.5 marks to increase contact time.")
        prescriptions.append("Extend brew ratio (e.g. from 1:2.0 to 1:2.3) to extract balancing late sugars.")
        prescriptions.append("Raise Profitec Drive PID temperature by +1.0°C to +2.0°C.")

    # Over-Extraction (Bitterness / Choked Flow)
    if time_s > 34.0 or flow_rate < 0.95 or (clarity <= 2.0 and balance <= 2.5 and sweetness <= 2.5):
        issues.append("Over-Extraction (Bitterness / Choked Flow)")
        prescriptions.append("Adjust DF54 grind coarser by +0.8 to +1.5 marks.")
        prescriptions.append("Shorten brew ratio (e.g. pull 1:1.8 to 1:2.0) to eliminate bitter blonding tail.")
        prescriptions.append("Engage declining flow: taper paddle down to 5.0-6.0 bar past 50% yield.")
        prescriptions.append("Drop brew PID temperature by -1.0°C to -2.0°C.")

    # Muddy Body / Low Clarity
    if body >= 4.2 and clarity <= 2.2 and sweetness >= 3.5:
        issues.append("Muddy Body / Low Flavor Clarity")
        prescriptions.append("Use high-flow precision basket (IMS 18g Competition).")
        prescriptions.append("Consider a Turboshot: coarsen DF54 dial by +4.0 marks, pull 1:2.5 in 16-18s at 6.0 bar.")

    # Weak / Thin Extraction
    if body <= 2.0 and sweetness <= 2.2 and acidity <= 2.5:
        issues.append("Weak / Watery Extraction")
        prescriptions.append("Increase dry dose by +0.5g to +1.0g to increase bed depth.")
        prescriptions.append("Tighten brew ratio (e.g. 1:1.8 to 1:2.0).")

    # Sweet Spot Reached
    is_sweet_spot = False
    if (24.0 <= time_s <= 33.0) and (1.8 <= ratio <= 2.3) and balance >= 3.8 and sweetness >= 3.8:
        is_sweet_spot = True
        if not issues:
            issues.append("Sweet Spot Reached")
            prescriptions.append("Extraction perfectly dialed in! Peak sweetness, sparkling clarity, and velvety mouthfeel.")

    summary = "; ".join(prescriptions) if prescriptions else "Extraction balanced. Minor adjustments to taste."

    return {
        "channeling_detected": "Channeling & Puck Fracture" in issues,
        "is_sweet_spot": is_sweet_spot,
        "issues": issues,
        "prescriptions": prescriptions,
        "summary": summary,
    }


def compute_water_status(we: Dict[str, Any], curr_date: Optional[date] = None) -> Dict[str, Any]:
    """Computes BWT Bestmax Premium Size M dual-decay water status and Flojet sanitization."""
    if curr_date is None:
        curr_date = date.today()

    rated_capacity = float(we.get("rated_capacity_liters", RATED_CAPACITY_L))
    consumed_l = float(we.get("total_consumed_liters", 0.0))
    remaining_l = max(0.0, round(rated_capacity - consumed_l, 2))

    vol_pct = max(0.0, round((remaining_l / rated_capacity) * 100.0, 2)) if rated_capacity > 0 else 0.0

    install_date_str = we.get("installed_date", "2026-04-18")
    expiry_date_str = we.get("expiry_date", "2027-04-18")
    install_date = datetime.strptime(install_date_str, "%Y-%m-%d").date()
    expiry_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()

    total_calendar_days = max(1, (expiry_date - install_date).days)
    calendar_days_remaining = (expiry_date - curr_date).days
    cal_pct = max(0.0, round((calendar_days_remaining / total_calendar_days) * 100.0, 2))

    limiting_constraint = "CALENDAR" if cal_pct <= vol_pct else "VOLUME"

    # Volume Alert
    if remaining_l <= 0.0:
        volume_alert = "OVERDUE"
    elif remaining_l <= WATER_WARNING_L:
        volume_alert = "DUE_SOON"
    else:
        volume_alert = "OK"

    # Calendar Alert
    if calendar_days_remaining <= 0:
        calendar_alert = "OVERDUE"
    elif calendar_days_remaining <= WATER_WARNING_DAYS:
        calendar_alert = "DUE_SOON"
    else:
        calendar_alert = "OK"

    # Composite Filter Alert
    if volume_alert == "OVERDUE" or calendar_alert == "OVERDUE":
        filter_status = "OVERDUE"
    elif volume_alert == "DUE_SOON" or calendar_alert == "DUE_SOON":
        filter_status = "DUE_SOON"
    else:
        filter_status = "OK"

    # Flojet sanitization
    flojet = we.get("flojet_sanitization", {})
    flojet_interval = int(flojet.get("interval_days", FLOJET_INTERVAL_DAYS))
    flojet_last_str = flojet.get("last_sanitized_date", "2026-04-11")
    flojet_last = datetime.strptime(flojet_last_str, "%Y-%m-%d").date()
    flojet_next = flojet_last + timedelta(days=flojet_interval)
    flojet_days_remaining = (flojet_next - curr_date).days

    if flojet_days_remaining <= 0:
        flojet_status = "OVERDUE"
    elif flojet_days_remaining <= FLOJET_WARNING_DAYS:
        flojet_status = "DUE_SOON"
    else:
        flojet_status = "OK"

    jug_vol = float(we.get("jug_volume_liters", JUG_VOLUME_L))
    jugs_remaining = int(remaining_l // jug_vol)

    return {
        "rated_capacity_liters": rated_capacity,
        "consumed_liters": consumed_l,
        "remaining_liters": remaining_l,
        "volume_percent_remaining": vol_pct,
        "total_calendar_days": total_calendar_days,
        "calendar_days_remaining": calendar_days_remaining,
        "calendar_percent_remaining": cal_pct,
        "limiting_constraint": limiting_constraint,
        "volume_alert": volume_alert,
        "calendar_alert": calendar_alert,
        "filter_status": filter_status,
        "jugs_remaining": jugs_remaining,
        "total_jugs_swapped": int(we.get("total_jugs_swapped", 0)),
        "flojet_days_remaining": flojet_days_remaining,
        "flojet_status": flojet_status,
        "installed_date": install_date_str,
        "expiry_date": expiry_date_str,
    }


def compute_cam_counter_status(shots: int, warning_shots: int = 35, target_shots: int = 40) -> Tuple[str, bool, Optional[str]]:
    """Calculates status and warning flags for E61 chemical backflush cam protection."""
    if shots >= target_shots:
        return (
            "OVERDUE",
            True,
            f"OVERDUE: {shots} shots reached (target {target_shots}). Chemical backflush required immediately.",
        )
    if shots >= warning_shots:
        return (
            "DUE_SOON",
            True,
            f"CAM PROTECTION WARNING: {shots} shots reached (warning {warning_shots}). Prepare for chemical backflush.",
        )
    return ("OK", False, None)


# ==============================================================================
# 2. SUPABASE REST API CLIENT (Standard Library Only)
# ==============================================================================

class SupabaseClient:
    """Zero-dependency Supabase REST Client targeting Sydney ap-southeast-2."""

    def __init__(self, env_path: Optional[str] = None) -> None:
        self.url, self.key = self._load_credentials(env_path)
        self._validate_boundary()

    def _load_credentials(self, env_path: Optional[str]) -> Tuple[str, str]:
        # Search locations for .env
        candidates = []
        if env_path:
            candidates.append(Path(env_path))
        
        current = Path(__file__).resolve().parent
        candidates.extend([
            current / ".env",
            current.parent / ".env",
            Path.cwd() / ".env",
        ])

        env_dict: Dict[str, str] = {}
        for c in candidates:
            if c.is_file():
                try:
                    for line in c.read_text(encoding="utf-8").splitlines():
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            env_dict[k.strip()] = v.strip().strip("'\"")
                    if "VITE_SUPABASE_URL" in env_dict or "SUPABASE_URL" in env_dict:
                        break
                except Exception:
                    pass

        url = (
            os.environ.get("VITE_SUPABASE_URL")
            or os.environ.get("SUPABASE_URL")
            or env_dict.get("VITE_SUPABASE_URL")
            or env_dict.get("SUPABASE_URL")
            or f"https://{EXPECTED_PROJECT_REF}.supabase.co"
        )

        key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or env_dict.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("VITE_SUPABASE_ANON_KEY")
            or env_dict.get("VITE_SUPABASE_ANON_KEY")
            or ""
        )

        return url.rstrip("/"), key

    def _validate_boundary(self) -> None:
        """Enforces strictly connecting to Sydney Supabase and never Work Costy."""
        if FORBIDDEN_PROJECT_REF in self.url:
            raise RuntimeError(
                f"SAFETY VIOLATION: Forbidden connection to Work Costy project ref '{FORBIDDEN_PROJECT_REF}' detected! Aborting."
            )
        if EXPECTED_PROJECT_REF not in self.url:
            raise RuntimeError(
                f"SAFETY VIOLATION: Must connect strictly to Sydney project ref '{EXPECTED_PROJECT_REF}', got '{self.url}'."
            )

    def request(
        self,
        endpoint: str,
        method: str = "GET",
        payload: Optional[Any] = None,
        prefer: Optional[str] = None,
    ) -> Any:
        url = f"{self.url}/rest/v1/{endpoint.lstrip('/')}"
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "User-Agent": "HouseholdHubCLI/1.0",
        }
        if prefer:
            headers["Prefer"] = prefer

        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                resp_text = resp.read().decode("utf-8")
                return json.loads(resp_text) if resp_text else None
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase REST error HTTP {e.code} on {method} {url}: {error_body}") from e


# ==============================================================================
# 3. CLI COMMAND IMPLEMENTATIONS
# ==============================================================================

def cmd_status(client: SupabaseClient, as_json: bool = False) -> None:
    """Query live state across machine, water, maintenance, active bag, cellar, meals."""
    # 1. Machine State
    state_rows = client.request("coffee_machine_state?select=*")
    if not state_rows:
        raise RuntimeError("No coffee_machine_state record found in Supabase.")
    state = state_rows[0]
    we = state.get("water_engine", {})
    me = state.get("maintenance_engine", {})

    water_status = compute_water_status(we)

    chem = me.get("chemical_backflush", {})
    shots_since = int(chem.get("shots_since_last_clean", 0))
    warn_shots = int(chem.get("warning_shots", E61_WARNING_SHOTS))
    target_shots = int(chem.get("target_shots", E61_TARGET_SHOTS))
    chem_status, lube_warn, warn_msg = compute_cam_counter_status(shots_since, warn_shots, target_shots)

    # 2. Active Bag
    active_bags = client.request("coffee_bags?status=eq.ACTIVE&limit=1")
    active_bag = active_bags[0] if active_bags else None
    if not active_bag:
        # Fallback to proud_mary_ghost_rider
        pm = client.request("coffee_bags?id=eq.proud_mary_ghost_rider")
        active_bag = pm[0] if pm else None

    # 3. Cellar Counts
    cellar_bottles = client.request("cellar_bottles?select=id,collection_status,category,quantity") or []
    owned_count = sum(1 for b in cellar_bottles if b.get("collection_status") == "OWNED" or (b.get("quantity") or 0) > 0)
    watchlist_count = sum(1 for b in cellar_bottles if b.get("collection_status") == "WATCHLIST" and (b.get("quantity") or 0) == 0)

    # 4. Meal Plan Blocks Count
    meal_blocks = client.request("meal_plan_blocks?select=id") or []
    blocks_count = len(meal_blocks)

    # 5. Last Shot
    recent_shots = client.request("coffee_shots?select=*&order=created_at.desc&limit=1") or []
    last_shot = recent_shots[0] if recent_shots else None

    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": {
            "project_ref": EXPECTED_PROJECT_REF,
            "region": "ap-southeast-2 (Sydney)",
            "status": "ONLINE",
        },
        "machine": {
            "model": state.get("system_meta", {}).get("machine_model", "Profitec Drive E61"),
            "grinder": state.get("system_meta", {}).get("grinder_model", "Turin / MiiCoffee DF54"),
            "water_system": state.get("system_meta", {}).get("water_system", "Flojet BW5000 + BWT Bestmax Premium M"),
        },
        "water_decay": water_status,
        "maintenance": {
            "chemical_backflush": {
                "shots_since_last_clean": shots_since,
                "warning_shots": warn_shots,
                "target_shots": target_shots,
                "status": chem_status,
                "lube_warning": lube_warn,
                "warning_message": warn_msg,
                "last_cleaned_date": chem.get("last_cleaned_date"),
                "detergent": chem.get("detergent"),
            },
            "flojet_sanitization": {
                "status": water_status["flojet_status"],
                "days_remaining": water_status["flojet_days_remaining"],
                "protocol": we.get("flojet_sanitization", {}).get("protocol"),
            },
            "tasks": me,
        },
        "active_bag": {
            "id": active_bag.get("id") if active_bag else None,
            "roaster": active_bag.get("roaster") if active_bag else None,
            "name": active_bag.get("name") if active_bag else None,
            "remaining_weight_g": active_bag.get("remaining_weight_g") if active_bag else 0.0,
            "grind_setting": active_bag.get("current_grind_setting") if active_bag else 14.5,
            "status": active_bag.get("status") if active_bag else "NONE",
        },
        "cellar": {
            "owned_count": owned_count,
            "watchlist_count": watchlist_count,
            "total_bottles": len(cellar_bottles),
        },
        "meal_plan": {
            "blocks_count": blocks_count,
        },
        "last_shot": last_shot,
    }

    if as_json:
        print(json.dumps(payload, indent=2))
        return

    # Formatted Terminal Output
    print("================================================================================")
    print(" ☕ HOUSEHOLD HUB — DESKTOP COCKPIT (Sydney Supabase anqaecdyipycajapmiev)")
    print("================================================================================")
    print(f"Machine:     {payload['machine']['model']}")
    print(f"Grinder:     {payload['machine']['grinder']}")
    print(f"Water:       {payload['machine']['water_system']}")
    print("--------------------------------------------------------------------------------")
    print(f"🌊 WATER DUAL-DECAY STATUS:  [{water_status['filter_status']}]")
    print(f"   Consumed: {water_status['consumed_liters']} L ({water_status['total_jugs_swapped']} jugs swapped)")
    print(f"   Remaining: {water_status['remaining_liters']} L ({water_status['jugs_remaining']} jugs, {water_status['volume_percent_remaining']}% of rated {water_status['rated_capacity_liters']} L)")
    print(f"   Calendar: {water_status['calendar_days_remaining']} days remaining (Expiry: {water_status['expiry_date']})")
    print(f"   Binding Constraint: {water_status['limiting_constraint']}")
    print(f"   Flojet Sanitize: [{water_status['flojet_status']}] ({water_status['flojet_days_remaining']} days remaining)")
    print("--------------------------------------------------------------------------------")
    print(f"🔧 E61 CAM MAINTENANCE:      [{chem_status}]")
    print(f"   Shots Since Clean: {shots_since} / {target_shots} (Warning at {warn_shots})")
    if lube_warn:
        print(f"   ⚠️  ALERT: {warn_msg}")
    else:
        print("   Cam lubrication protected (Molykote 111 / coffee lipid barrier intact)")
    print("--------------------------------------------------------------------------------")
    if active_bag:
        print(f"📦 ACTIVE COFFEE HOPPER:")
        print(f"   {active_bag['roaster']} — {active_bag['name']}")
        print(f"   Remaining: {active_bag['remaining_weight_g']}g | Grind: #{active_bag.get('current_grind_setting', 14.5)} DF54")
    else:
        print("📦 ACTIVE COFFEE HOPPER: No active bag set!")
    print("--------------------------------------------------------------------------------")
    print(f"🍷 CELLAR & VAULT: {owned_count} Owned Bottles | {watchlist_count} Barolo Watchlist Bottles")
    print(f"🥗 MEALS & PREP:   {blocks_count} Active Multi-Day Meal Plan Blocks")
    print("================================================================================")


def cmd_swap_jug(client: SupabaseClient, volume_l: float = 11.0, as_json: bool = False) -> None:
    """Logs replacement of an 11L Neverfail Spring Water jug."""
    state_rows = client.request("coffee_machine_state?select=*")
    if not state_rows:
        raise RuntimeError("No coffee_machine_state record found in Supabase.")
    state = state_rows[0]
    we = state.get("water_engine", {})
    audit = state.get("audit_log", [])

    total_swapped = int(we.get("total_jugs_swapped", 0)) + 1
    consumed = round(float(we.get("total_consumed_liters", 0.0)) + volume_l, 2)
    rated = float(we.get("rated_capacity_liters", RATED_CAPACITY_L))
    remaining = max(0.0, round(rated - consumed, 2))
    today_str = date.today().strftime("%Y-%m-%d")

    we["total_jugs_swapped"] = total_swapped
    we["total_consumed_liters"] = consumed
    we["total_remaining_liters"] = remaining
    we["volume_consumed_l"] = consumed
    we["volume_remaining_l"] = remaining
    we["last_jug_swapped_date"] = today_str

    event_id = f"jug-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"
    audit.append({
        "id": event_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "category": "WATER",
        "action": "JUG_SWAPPED",
        "details": {
            "volume_l": volume_l,
            "total_jugs_swapped": total_swapped,
            "total_consumed_liters": consumed,
            "total_remaining_liters": remaining,
        },
    })

    client.request(
        "coffee_machine_state?id=eq.profitec_drive_primary",
        method="PATCH",
        payload={
            "water_engine": we,
            "audit_log": audit,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        prefer="return=minimal",
    )

    result = {
        "status": "SUCCESS",
        "action": "swap-jug",
        "volume_added_l": volume_l,
        "total_jugs_swapped": total_swapped,
        "total_consumed_liters": consumed,
        "total_remaining_liters": remaining,
        "last_jug_swapped_date": today_str,
    }

    if as_json:
        print(json.dumps(result, indent=2))
    else:
        print(f"✅ Successfully swapped Neverfail jug (+{volume_l}L).")
        print(f"   Total jugs: {total_swapped} | Consumed: {consumed}L | Remaining BWT: {remaining}L")


def cmd_log_shot(
    client: SupabaseClient,
    quick_shots: Optional[int] = None,
    dose_g: float = 18.0,
    yield_g: float = 38.0,
    time_s: float = 28.0,
    grind: float = 14.5,
    flow_profile: str = "standard_9bar",
    drink_type: str = "espresso",
    acidity: float = 3.8,
    sweetness: float = 4.2,
    body: float = 3.8,
    clarity: float = 4.0,
    balance: float = 4.2,
    notes: str = "",
    logged_by: str = "Brandon",
    as_json: bool = False,
) -> None:
    """Logs quick or detail shot, atomically deducting bag weight and incrementing cam counter."""
    is_quick = quick_shots is not None and quick_shots > 0
    shots_pulled = quick_shots if is_quick else 1

    # 1. Fetch Active Bag
    active_bags = client.request("coffee_bags?status=eq.ACTIVE&limit=1")
    if not active_bags:
        active_bags = client.request("coffee_bags?id=eq.proud_mary_ghost_rider")
    if not active_bags:
        raise RuntimeError("No active or fallback coffee bag found in Supabase.")
    active_bag = active_bags[0]
    bag_id = active_bag["id"]

    # Quick shot parameter calculation
    if is_quick:
        dose = 18.0 * shots_pulled
        actual_yield = 38.0 * shots_pulled
        shot_time = 28.0
        grind_val = float(active_bag.get("current_grind_setting", 14.5))
        a, s, b, c, bal = 3.5, 4.0, 3.5, 4.0, 4.0
        log_mode = "QUICK"
        notes_str = f"Quick 1-tap shot log ({shots_pulled}x 18g double basket)"
    else:
        dose = float(dose_g)
        actual_yield = float(yield_g)
        shot_time = float(time_s)
        grind_val = float(grind)
        a, s, b, c, bal = float(acidity), float(sweetness), float(body), float(clarity), float(balance)
        log_mode = "DETAIL"
        notes_str = notes

    ratio = round(actual_yield / dose, 2) if dose > 0 else 2.0
    flow_rate = round(actual_yield / shot_time, 2) if shot_time > 0 else 1.35

    straight_score, milk_score, straight_tier, milk_tier = compute_suitability_scores(a, s, b, c, bal)
    diag = diagnose_extraction(grind_val, dose, actual_yield, shot_time, ratio, flow_rate, a, s, b, c, bal, flow_profile)

    # 2. Insert into coffee_shots
    shot_id = str(uuid.uuid4())
    shot_record = {
        "id": shot_id,
        "bag_id": bag_id,
        "bean_name": active_bag.get("name", "Unknown"),
        "roaster": active_bag.get("roaster", "Unknown"),
        "log_mode": log_mode,
        "logged_by": logged_by,
        "shots_pulled": shots_pulled,
        "grind_setting": grind_val,
        "dose_g": dose,
        "yield_g": actual_yield,
        "time_s": shot_time,
        "brew_ratio": ratio,
        "flow_rate_gps": flow_rate,
        "drink_type": drink_type,
        "flow_profile": flow_profile,
        "acidity": a,
        "sweetness": s,
        "body": b,
        "clarity": c,
        "balance": bal,
        "straight_score": straight_score,
        "milk_score": milk_score,
        "straight_tier": straight_tier,
        "milk_tier": milk_tier,
        "troubleshooting": diag,
        "notes": notes_str,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    client.request("coffee_shots", method="POST", payload=shot_record, prefer="return=minimal")

    # 3. Atomically Deduct Bag Remaining Weight
    curr_weight = float(active_bag.get("remaining_weight_g", 250.0))
    new_weight = max(0.0, round(curr_weight - dose, 1))
    new_status = active_bag.get("status", "ACTIVE")
    if new_weight <= 18.0:
        new_status = "EMPTY"
    elif new_weight <= 60.0:
        new_status = "LOW"

    client.request(
        f"coffee_bags?id=eq.{bag_id}",
        method="PATCH",
        payload={
            "remaining_weight_g": new_weight,
            "status": new_status,
            "current_grind_setting": grind_val,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        prefer="return=minimal",
    )

    # 4. Atomically Increment E61 Shot Counter
    state_rows = client.request("coffee_machine_state?select=*")
    state = state_rows[0]
    me = state.get("maintenance_engine", {})
    chem = me.setdefault("chemical_backflush", {
        "target_shots": E61_TARGET_SHOTS,
        "warning_shots": E61_WARNING_SHOTS,
        "shots_since_last_clean": 0,
        "last_cleaned_date": date.today().strftime("%Y-%m-%d"),
        "detergent": "Breville Eco Coffee Residue Cleaning Tablets (BES013CLR, 1 tablet)",
    })
    curr_shots = int(chem.get("shots_since_last_clean", 0))
    new_shots = curr_shots + shots_pulled
    status, lube_warn, warn_msg = compute_cam_counter_status(new_shots, int(chem.get("warning_shots", E61_WARNING_SHOTS)), int(chem.get("target_shots", E61_TARGET_SHOTS)))
    chem["shots_since_last_clean"] = new_shots
    chem["status"] = status
    chem["lube_warning"] = lube_warn
    chem["warning_message"] = warn_msg

    client.request(
        "coffee_machine_state?id=eq.profitec_drive_primary",
        method="PATCH",
        payload={
            "maintenance_engine": me,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        prefer="return=minimal",
    )

    result = {
        "status": "SUCCESS",
        "shot_id": shot_id,
        "log_mode": log_mode,
        "bag_id": bag_id,
        "bean_name": active_bag.get("name"),
        "roaster": active_bag.get("roaster"),
        "dose_g": dose,
        "yield_g": actual_yield,
        "time_s": shot_time,
        "ratio": ratio,
        "flow_rate_gps": flow_rate,
        "straight_score": straight_score,
        "milk_score": milk_score,
        "straight_tier": straight_tier,
        "milk_tier": milk_tier,
        "is_sweet_spot": diag["is_sweet_spot"],
        "issues": diag["issues"],
        "prescriptions": diag["prescriptions"],
        "summary": diag["summary"],
        "remaining_bag_weight_g": new_weight,
        "bag_status": new_status,
        "shots_since_last_clean": new_shots,
        "e61_status": status,
        "lube_warning": lube_warn,
    }

    if as_json:
        print(json.dumps(result, indent=2))
    else:
        print(f"☕ Shot successfully logged ({log_mode} Mode by {logged_by})!")
        print(f"   Bean: {active_bag.get('roaster')} — {active_bag.get('name')}")
        print(f"   Extraction: {dose}g in → {actual_yield}g out in {shot_time}s (Ratio 1:{ratio}, {flow_rate} g/s)")
        print(f"   Suitability: Straight {straight_score}/100 [{straight_tier}] | Milk {milk_score}/100 [{milk_tier}]")
        if diag["is_sweet_spot"]:
            print("   🌟 SWEET SPOT ACHIEVED: Peak sweetness & balance!")
        elif diag["issues"]:
            print(f"   ⚠️  Diagnostics: {diag['summary']}")
        print(f"   Bag weight: {new_weight}g remaining [{new_status}]")
        print(f"   E61 Chemical clean counter: {new_shots}/40 shots [{status}]")


def cmd_log_maint(
    client: SupabaseClient,
    task_id: str,
    service_date: Optional[str] = None,
    notes: Optional[str] = None,
    as_json: bool = False,
) -> None:
    """Resets maintenance task timers and counters with safety protocol guardrails."""
    state_rows = client.request("coffee_machine_state?select=*")
    if not state_rows:
        raise RuntimeError("No coffee_machine_state record found in Supabase.")
    state = state_rows[0]
    me = state.get("maintenance_engine", {})
    we = state.get("water_engine", {})
    audit = state.get("audit_log", [])

    today_str = service_date or date.today().strftime("%Y-%m-%d")
    t = task_id.strip().lower().replace("-", "_")

    event_id = f"maint-{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}"
    task_result = {}

    if t in ("chemical_backflush", "chem", "chemical", "chem_backflush"):
        chem = me.setdefault("chemical_backflush", {})
        chem["shots_since_last_clean"] = 0
        chem["last_cleaned_date"] = today_str
        chem["status"] = "OK"
        chem["lube_warning"] = False
        chem["warning_message"] = None
        
        note = notes or "Chemical detergent backflush completed (1 Breville Eco tablet BES013CLR). Mandatory seasoning shot pulled and discarded to protect E61 cam."
        audit.append({
            "id": event_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": "MAINTENANCE",
            "action": "CHEMICAL_BACKFLUSH_RESET",
            "details": {
                "task": "chemical_backflush",
                "seasoning_shot_pulled": True,
                "notes": note,
            },
        })
        task_result = {"task": "chemical_backflush", "shots_since_last_clean": 0, "status": "OK", "seasoning_shot_required": True}

    elif t in ("water_filter_replace", "filter_replace", "filter"):
        we["total_jugs_swapped"] = 0
        we["total_consumed_liters"] = 0.0
        we["total_remaining_liters"] = RATED_CAPACITY_L
        we["volume_consumed_l"] = 0.0
        we["volume_remaining_l"] = RATED_CAPACITY_L
        we["installed_date"] = today_str
        
        # 365 days expiry
        inst_d = datetime.strptime(today_str, "%Y-%m-%d").date()
        try:
            exp_d = inst_d.replace(year=inst_d.year + 1)
        except ValueError:
            exp_d = inst_d.replace(year=inst_d.year + 1, day=28)
        we["expiry_date"] = exp_d.strftime("%Y-%m-%d")

        audit.append({
            "id": event_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": "MAINTENANCE",
            "action": "FILTER_REPLACED",
            "details": {
                "task": "water_filter_replace",
                "installed_date": today_str,
                "expiry_date": we["expiry_date"],
                "rated_capacity": RATED_CAPACITY_L,
                "notes": notes or "BWT Bestmax Premium Size M cartridge replaced (Bypass 0). Volume and calendar timers reset.",
            },
        })
        task_result = {"task": "water_filter_replace", "installed_date": today_str, "expiry_date": we["expiry_date"], "remaining_liters": RATED_CAPACITY_L}

    elif t in ("flojet_sanitization", "flojet", "flojet_sanitize"):
        flojet = we.setdefault("flojet_sanitization", {})
        flojet["last_sanitized_date"] = today_str
        flojet["interval_days"] = FLOJET_INTERVAL_DAYS
        
        guardrail_warning = "CRITICAL SAFETY GUARDRAIL: Oxygen-based sanitizer ONLY (Cafetto Inverso / Sodium Percarbonate). NEVER use chlorine/bleach/Milton tablets. Disconnect line upstream of BWT filter."
        flojet["protocol"] = guardrail_warning
        
        audit.append({
            "id": event_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": "MAINTENANCE",
            "action": "FLOJET_SANITIZED",
            "details": {
                "task": "flojet_sanitization",
                "last_sanitized_date": today_str,
                "guardrail": guardrail_warning,
                "notes": notes or "Flojet BW5000 suction wand sanitized using oxygen-based solution, flushed with fresh spring water.",
            },
        })
        task_result = {"task": "flojet_sanitization", "last_sanitized_date": today_str, "guardrail": guardrail_warning}

    elif t in ("e61_cam_grease", "e61", "cam_grease", "molykote"):
        e61 = me.setdefault("e61_cam_grease", {})
        e61["last_performed_date"] = today_str
        e61["interval_days"] = E61_CAM_GREASE_INTERVAL_DAYS
        e61["lubricant"] = "DuPont Molykote 111 / Haynes Lubri-Film"
        audit.append({
            "id": event_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": "MAINTENANCE",
            "action": "E61_CAM_LUBRICATED",
            "details": {"task": "e61_cam_grease", "notes": notes or "E61 operating lever cam disassembled and coated with food-grade Molykote 111."},
        })
        task_result = {"task": "e61_cam_grease", "last_performed_date": today_str}

    elif t in ("water_backflush", "water"):
        wb = me.setdefault("water_backflush", {})
        wb["last_performed_date"] = today_str
        wb["interval_days"] = 1
        audit.append({
            "id": event_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": "MAINTENANCE",
            "action": "WATER_BACKFLUSH_DONE",
            "details": {"task": "water_backflush", "notes": notes or "Daily plain hot water backflush (blind basket, 3-5 pulses)."},
        })
        task_result = {"task": "water_backflush", "last_performed_date": today_str}

    elif t in ("steam_boiler_flush", "boiler", "boiler_flush"):
        sbf = me.setdefault("steam_boiler_flush", {})
        sbf["last_performed_date"] = today_str
        sbf["interval_days"] = STEAM_BOILER_FLUSH_INTERVAL_DAYS
        audit.append({
            "id": event_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": "MAINTENANCE",
            "action": "STEAM_BOILER_FLUSHED",
            "details": {"task": "steam_boiler_flush", "notes": notes or "Steam boiler drained under pressure (1.5L evacuated with power OFF) to clear TDS minerals."},
        })
        task_result = {"task": "steam_boiler_flush", "last_performed_date": today_str}

    elif t in ("steam_wand_soak", "wand", "wand_soak"):
        sws = me.setdefault("steam_wand_soak", {})
        sws["last_performed_date"] = today_str
        sws["interval_days"] = STEAM_WAND_SOAK_INTERVAL_DAYS
        audit.append({
            "id": event_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": "MAINTENANCE",
            "action": "STEAM_WAND_SOAKED",
            "details": {"task": "steam_wand_soak", "notes": notes or "Steam wand tip soaked in warm water with 1/2 Breville Eco tablet."},
        })
        task_result = {"task": "steam_wand_soak", "last_performed_date": today_str}

    elif t in ("df54_burr_clean", "df54", "burr_clean"):
        df = me.setdefault("df54_burr_clean", {})
        df["last_performed_date"] = today_str
        df["interval_days"] = DF54_BURR_CLEAN_INTERVAL_DAYS
        audit.append({
            "id": event_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": "MAINTENANCE",
            "action": "DF54_BURR_CLEANED",
            "details": {"task": "df54_burr_clean", "notes": notes or "DF54 upper collar unthreaded, burr chamber vacuumed, plasma ionizer pins brushed."},
        })
        task_result = {"task": "df54_burr_clean", "last_performed_date": today_str}

    elif t in ("shower_screen_gasket", "screen", "shower_screen"):
        ss = me.setdefault("shower_screen_gasket", {})
        ss["last_performed_date"] = today_str
        ss["interval_days"] = SHOWER_SCREEN_INTERVAL_DAYS
        audit.append({
            "id": event_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "category": "MAINTENANCE",
            "action": "SHOWER_SCREEN_CLEANED",
            "details": {"task": "shower_screen_gasket", "notes": notes or "Shower screen & silicone gasket soaked in hot water with 1 Breville Eco tablet."},
        })
        task_result = {"task": "shower_screen_gasket", "last_performed_date": today_str}

    else:
        raise ValueError(
            f"Unknown maintenance task: '{task_id}'. Supported tasks: "
            "chemical_backflush, water_backflush, e61_cam_grease, steam_boiler_flush, "
            "steam_wand_soak, df54_burr_clean, flojet_sanitization, shower_screen_gasket, water_filter_replace"
        )

    client.request(
        "coffee_machine_state?id=eq.profitec_drive_primary",
        method="PATCH",
        payload={
            "maintenance_engine": me,
            "water_engine": we,
            "audit_log": audit,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        prefer="return=minimal",
    )

    if as_json:
        print(json.dumps({"status": "SUCCESS", "details": task_result}, indent=2))
    else:
        print(f"🔧 Maintenance task '{task_id}' successfully recorded!")
        if t in ("chemical_backflush", "chem"):
            print("   ⚠️  IMPORTANT: Mandatory seasoning shot protocol active! Pull & discard 1 shot now to re-coat brass cam with protective coffee lipids.")
        elif t in ("flojet_sanitization", "flojet"):
            print("   🛡️  SAFETY RULE VERIFIED: Non-chlorine oxygen sanitizer only (Cafetto Inverso). Never use chlorine/Milton.")


def cmd_rate_bag(
    client: SupabaseClient,
    bag_id: str,
    overall: float,
    black: float,
    milk: float,
    notes: Optional[str] = None,
    tags: Optional[str] = None,
    rebuy: bool = True,
    archive: bool = False,
    as_json: bool = False,
) -> None:
    """Updates sensory ratings for a coffee bag and adjusts taste preference profile."""
    bags = client.request(f"coffee_bags?id=eq.{bag_id}")
    if not bags:
        raise RuntimeError(f"Coffee bag '{bag_id}' not found in Supabase.")
    bag = bags[0]

    user_tags = [t.strip() for t in tags.split(",") if t.strip()] if tags else bag.get("user_tags", [])
    rating_ov = clamp(overall, 1.0, 10.0)
    rating_bk = clamp(black, 1.0, 10.0)
    rating_mk = clamp(milk, 1.0, 10.0)

    bag_patch: Dict[str, Any] = {
        "rating_overall": rating_ov,
        "rating_black": rating_bk,
        "rating_milk": rating_mk,
        "user_tags": user_tags,
        "user_notes": notes or bag.get("user_notes"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if archive:
        bag_patch["status"] = "ARCHIVED"

    client.request(f"coffee_bags?id=eq.{bag_id}", method="PATCH", payload=bag_patch, prefer="return=minimal")

    # Learn preferences in coffee_machine_state
    state_rows = client.request("coffee_machine_state?select=*")
    state = state_rows[0]
    profile = state.get("user_preference_profile", {})
    affinities = profile.setdefault("flavor_affinities", {})
    favorites = profile.setdefault("favorite_beans", [])
    disliked = profile.setdefault("disliked_beans", [])

    bean_label = f"{bag.get('roaster')} - {bag.get('name')}"

    if rating_ov >= 7.5 and rebuy:
        for fn in bag.get("flavor_notes", []):
            fn_low = str(fn).lower()
            affinities[fn_low] = max(affinities.get(fn_low, 0.5), round(rating_ov / 10.0, 2))
        if bean_label not in favorites:
            favorites.append(bean_label)
        if bean_label in disliked:
            disliked.remove(bean_label)
    elif rating_ov <= 5.5 or not rebuy:
        if bean_label not in disliked:
            disliked.append(bean_label)
        if bean_label in favorites:
            favorites.remove(bean_label)
        for fn in bag.get("flavor_notes", []):
            fn_low = str(fn).lower()
            if fn_low in affinities:
                affinities[fn_low] = round(affinities[fn_low] * 0.7, 2)

    client.request(
        "coffee_machine_state?id=eq.profitec_drive_primary",
        method="PATCH",
        payload={
            "user_preference_profile": profile,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        prefer="return=minimal",
    )

    res = {
        "status": "SUCCESS",
        "bag_id": bag_id,
        "name": bag.get("name"),
        "rating_overall": rating_ov,
        "rating_black": rating_bk,
        "rating_milk": rating_mk,
        "rebuy": rebuy,
        "status": bag_patch.get("status", bag.get("status")),
    }
    if as_json:
        print(json.dumps(res, indent=2))
    else:
        print(f"⭐ Rated {bag.get('roaster')} — {bag.get('name')}:")
        print(f"   Overall: {rating_ov}/10 | Black: {rating_bk}/10 | Milk: {rating_mk}/10 (Rebuy: {rebuy})")
        print(f"   Updated preference affinities across {len(bag.get('flavor_notes', []))} flavor notes.")


def cmd_recommend(
    client: SupabaseClient,
    drink_mode: str = "all",
    top_n: int = 3,
    preference: Optional[str] = None,
    roaster: Optional[str] = None,
    as_json: bool = False,
) -> None:
    """Evaluates multi-attribute utility rankings across Australian specialty roasters."""
    # 1. Fetch catalog
    all_bags = client.request("coffee_bags?select=*") or []
    if not all_bags:
        raise RuntimeError("No coffee bags found in Supabase.")

    # 2. Fetch machine state preferences
    state_rows = client.request("coffee_machine_state?select=*")
    state = state_rows[0] if state_rows else {}
    profile = state.get("user_preference_profile", {})
    affinities = profile.get("flavor_affinities", {})
    disliked = set(str(d).lower() for d in profile.get("disliked_beans", []))

    # Drink target
    drink_str = drink_mode.strip().lower()
    target_drink = "Black" if "straight" in drink_str or "black" in drink_str else ("Milk" if "milk" in drink_str else "All")

    # Baseline radar
    target_radar = {"acidity": 3.8, "sweetness": 4.5, "body": 4.0, "clarity": 4.2, "balance": 4.5}
    if target_drink == "Milk":
        target_radar = {"acidity": 3.0, "sweetness": 4.7, "body": 4.6, "clarity": 3.6, "balance": 4.6}
    elif target_drink == "Black":
        target_radar = {"acidity": 4.2, "sweetness": 4.4, "body": 3.4, "clarity": 4.6, "balance": 4.4}

    scored_beans: List[Dict[str, Any]] = []

    for b in all_bags:
        roaster_name = b.get("roaster", "")
        if roaster and roaster.lower() not in roaster_name.lower():
            continue

        bean_id = b.get("id")
        bean_label = f"{roaster_name} - {b.get('name')}".lower()
        if bean_label in disliked:
            continue

        radar = b.get("typical_radar", {})
        # Radar Euclidean Similarity
        dist_sq = sum(
            (float(target_radar.get(k, 3.5)) - float(radar.get(k, 3.5))) ** 2
            for k in ["acidity", "sweetness", "body", "clarity", "balance"]
        )
        sim_radar = max(0.0, 100.0 * (1.0 - (math.sqrt(dist_sq) / math.sqrt(80.0))))

        # Flavor notes affinity
        notes_list = [str(n).lower() for n in b.get("flavor_notes", [])]
        matched_affinities = [affinities.get(n, 0.6) for n in notes_list]
        sim_flavor = (sum(matched_affinities) / len(matched_affinities) * 100.0) if matched_affinities else 65.0

        # Drink suitability match
        suit = b.get("drink_suitability", "All-Rounder")
        if target_drink == "Milk":
            match_drink = 100.0 if suit == "Milk" else (85.0 if suit == "All-Rounder" else 45.0)
        elif target_drink == "Black":
            match_drink = 100.0 if suit == "Black" else (85.0 if suit == "All-Rounder" else 50.0)
        else:
            match_drink = 100.0 if suit == "All-Rounder" else 80.0

        sim_proc = 85.0
        sim_roast = 85.0
        bonus_novelty = 2.0 if b.get("status") != "ACTIVE" else 0.0

        composite = (
            0.35 * sim_radar
            + 0.35 * sim_flavor
            + 0.15 * sim_proc
            + 0.05 * sim_roast
            + 0.10 * match_drink
            + bonus_novelty
        )
        composite = clamp(composite, 0.0, 100.0)

        scored_beans.append({
            "id": bean_id,
            "roaster": roaster_name,
            "name": b.get("name"),
            "city": b.get("city"),
            "process": b.get("process"),
            "flavor_notes": b.get("flavor_notes"),
            "recommended_ratio": b.get("recommended_ratio", 2.0),
            "drink_suitability": suit,
            "price_aud": b.get("price_aud"),
            "typical_radar": radar,
            "match_score": round(composite, 1),
            "roaster_dial_notes": b.get("roaster_dial_notes"),
        })

    scored_beans.sort(key=lambda x: (x["match_score"], x["typical_radar"].get("sweetness", 0)), reverse=True)
    top_results = scored_beans[:top_n]

    if as_json:
        print(json.dumps(top_results, indent=2))
        return

    print("================================================================================")
    print(f" 🏆 TOP {top_n} AUSTRALIAN SPECIALTY ROASTER RECOMMENDATIONS (Target: {target_drink})")
    print("================================================================================")
    for i, bean in enumerate(top_results, 1):
        print(f"#{i} — {bean['roaster']} — {bean['name']} ({bean['match_score']}% Match)")
        print(f"    Region: {bean['city']} | Process: {bean['process']} | Format: {bean['drink_suitability']}")
        print(f"    Flavor Notes: {', '.join(bean['flavor_notes'])}")
        print(f"    Dial Guide: 1:{bean['recommended_ratio']} ratio | {bean['roaster_dial_notes']}")
        print(f"    Price: ${bean['price_aud']} AUD / 250g")
        print("--------------------------------------------------------------------------------")


def cmd_recipes(client: SupabaseClient, category: Optional[str] = None, as_json: bool = False) -> None:
    """Lists verified recipes and itemized MacroFactor macronutrient breakdown."""
    url = "recipes?select=*"
    if category:
        url += f"&category=ilike.*{category}*"
    recipes = client.request(url) or []

    if as_json:
        print(json.dumps(recipes, indent=2))
        return

    print("================================================================================")
    print(f" 🥗 HOUSEHOLD HUB — {len(recipes)} MACROFACTOR VERIFIED RECIPES")
    print("================================================================================")
    for r in sorted(recipes, key=lambda x: x.get("id")):
        m = r.get("macros_per_serving", {})
        ings = r.get("ingredients", [])
        print(f"📌 {r.get('title')} ({r.get('id')})")
        print(f"   Category: {r.get('category')} | Rotation: {r.get('rotation_group', 'N/A')} | Servings: {r.get('servings')}")
        print(f"   Macros / Serving: {m.get('calories')} kcal | {m.get('protein_g')}g P | {m.get('carbs_g')}g C | {m.get('fat_g')}g F")
        print(f"   Ingredients ({len(ings)} items):")
        for ing in ings:
            im = ing.get("macros_per_serving", {})
            qty_str = ing.get("quantity") or f"{ing.get('quantity_raw', '')} {ing.get('unit', '')}".strip()
            print(f"     • {ing.get('name')}: {qty_str} ({im.get('calories')} kcal, {im.get('protein_g')}g P)")
        print("--------------------------------------------------------------------------------")


def cmd_cellar(
    client: SupabaseClient,
    status_filter: str = "all",
    category_filter: str = "all",
    as_json: bool = False,
) -> None:
    """Lists wine cellar and spirits vault bottles alongside the Barolo watchlist."""
    url = "cellar_bottles?select=*"
    s_low = status_filter.strip().lower()
    if s_low in ("in_cellar", "owned"):
        url += "&or=(collection_status.eq.OWNED,quantity.gt.0)"
    elif s_low == "watchlist":
        url += "&collection_status.eq.WATCHLIST"

    c_low = category_filter.strip().lower()
    if c_low in ("wine", "whiskey", "spirit"):
        url += f"&category=eq.{c_low}"

    bottles = client.request(url) or []

    if as_json:
        print(json.dumps(bottles, indent=2))
        return

    print("================================================================================")
    print(f" 🍷 CELLAR & SPIRITS VAULT ({len(bottles)} Bottles — Filter: status={status_filter}, category={category_filter})")
    print("================================================================================")
    for b in bottles:
        qty = b.get("quantity", 0)
        status = b.get("collection_status", "WATCHLIST")
        print(f"🍾 {b.get('producer')} — {b.get('name')} {b.get('vintage') or ''}")
        print(f"   Status: [{status}] (Qty: {qty} in stock | Fill: {b.get('fill_level_percent', 100)}%)")
        print(f"   Region: {b.get('region_or_cru', 'N/A')} ({b.get('country')}) | Varietal: {b.get('varietal_or_style')}")
        print(f"   Orientation: {b.get('storage_orientation')} | Decant: {b.get('decant_protocol', 'N/A')}")
        if b.get("drinking_window"):
            print(f"   Window: {b.get('drinking_window')} | Rating: {b.get('rating_100', 'N/A')}/100")
        if b.get("bbq_pairing_tags"):
            print(f"   BBQ Pairing: {', '.join(b.get('bbq_pairing_tags', []))}")
        print("--------------------------------------------------------------------------------")


# ==============================================================================
# 4. CLI ARGUMENT PARSER & ENTRYPOINT
# ==============================================================================

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="household_cli.py",
        description="Household Hub Desktop CLI Sync Bridge (Sydney Supabase anqaecdyipycajapmiev)",
    )
    parser.add_argument("--env-path", help="Path to .env configuration file", default=None)

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # 1. status
    status_parser = subparsers.add_parser("status", help="Live status of machine, water, maintenance, cellar, meals")
    status_parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")

    # 2. swap-jug
    swap_parser = subparsers.add_parser("swap-jug", help="Record swapping an 11L Neverfail Spring Water jug")
    swap_parser.add_argument("--volume", type=float, default=11.0, help="Volume of water jug in liters (default 11.0)")
    swap_parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")

    # 3. log-shot
    shot_parser = subparsers.add_parser("log-shot", help="Log an espresso shot (Quick 1-Tap or 5-Axis Sensory Detail)")
    shot_parser.add_argument("--quick", type=int, nargs="?", const=1, default=None, help="Quick shot mode (1 for 18g double basket, 2 for 36g morning coffees)")
    shot_parser.add_argument("--dose", type=float, default=18.0, help="Dose dry weight in grams (default 18.0)")
    shot_parser.add_argument("--yield", dest="yield_g", type=float, default=38.0, help="Liquid yield in grams (default 38.0)")
    shot_parser.add_argument("--time", type=float, default=28.0, help="Shot duration in seconds (default 28.0)")
    shot_parser.add_argument("--grind", type=float, default=14.5, help="DF54 stepless grind setting (default 14.5)")
    shot_parser.add_argument("--flow-profile", default="standard_9bar", help="Profitec flow profile")
    shot_parser.add_argument("--drink-type", default="espresso", help="Drink type (espresso, flat_white, long_black)")
    shot_parser.add_argument("--acidity", type=float, default=3.8, help="Acidity slider (1.0 to 5.0)")
    shot_parser.add_argument("--sweetness", type=float, default=4.2, help="Sweetness slider (1.0 to 5.0)")
    shot_parser.add_argument("--body", type=float, default=3.8, help="Body slider (1.0 to 5.0)")
    shot_parser.add_argument("--clarity", type=float, default=4.0, help="Clarity slider (1.0 to 5.0)")
    shot_parser.add_argument("--balance", type=float, default=4.2, help="Balance slider (1.0 to 5.0)")
    shot_parser.add_argument("--notes", default="", help="Tasting notes")
    shot_parser.add_argument("--logged-by", default="Brandon", help="Barista name ('Brandon' or 'Meg')")
    shot_parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")

    # 4. log-maint
    maint_parser = subparsers.add_parser("log-maint", help="Record equipment maintenance completion")
    maint_parser.add_argument("task_id", nargs="?", default=None, help="Maintenance task identifier")
    maint_parser.add_argument("--task", dest="task_opt", default=None, help="Maintenance task alias")
    maint_parser.add_argument("--date", default=None, help="Service completion date YYYY-MM-DD")
    maint_parser.add_argument("--notes", default=None, help="Optional service notes")
    maint_parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")

    # 5. rate-bag
    rate_parser = subparsers.add_parser("rate-bag", help="Rate a coffee bag and adjust preference profiles")
    rate_parser.add_argument("bag_id", help="Coffee bag ID (e.g. proud_mary_ghost_rider)")
    rate_parser.add_argument("overall", type=float, help="Overall rating (1.0 to 10.0)")
    rate_parser.add_argument("black", type=float, help="Black espresso rating (1.0 to 10.0)")
    rate_parser.add_argument("milk", type=float, help="Milk drink rating (1.0 to 10.0)")
    rate_parser.add_argument("--notes", default=None, help="Barista verdict notes")
    rate_parser.add_argument("--tags", default=None, help="Comma-separated flavor tags")
    rate_parser.add_argument("--no-rebuy", dest="rebuy", action="store_false", default=True, help="Flag if bag would not be repurchased")
    rate_parser.add_argument("--archive", action="store_true", help="Archive bag status")
    rate_parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")

    # 6. recommend
    rec_parser = subparsers.add_parser("recommend", help="Synthesize specialty roaster recommendations")
    rec_parser.add_argument("--drink", default="all", choices=["straight", "black", "milk", "all"], help="Drink mode")
    rec_parser.add_argument("--top", type=int, default=3, help="Number of recommendations (default 3)")
    rec_parser.add_argument("--preference", default=None, help="Flavor preference string")
    rec_parser.add_argument("--roaster", default=None, help="Filter by roaster name")
    rec_parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")

    # 7. recipes
    recip_parser = subparsers.add_parser("recipes", help="List 7 MacroFactor verified recipes and macros")
    recip_parser.add_argument("--category", default=None, help="Filter by category")
    recip_parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")

    # 8. cellar
    cellar_parser = subparsers.add_parser("cellar", help="List wine cellar, spirits vault, and Barolo watchlist")
    cellar_parser.add_argument("--status", default="all", choices=["in_cellar", "owned", "watchlist", "all"], help="Filter by status")
    cellar_parser.add_argument("--category", default="all", choices=["wine", "whiskey", "spirit", "all"], help="Filter by category")
    cellar_parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    try:
        client = SupabaseClient(args.env_path)
    except Exception as e:
        sys.stderr.write(f"Configuration / Connection Error: {e}\n")
        return 1

    try:
        if args.command == "status":
            cmd_status(client, as_json=args.json)
        elif args.command == "swap-jug":
            cmd_swap_jug(client, volume_l=args.volume, as_json=args.json)
        elif args.command == "log-shot":
            cmd_log_shot(
                client,
                quick_shots=args.quick,
                dose_g=args.dose,
                yield_g=args.yield_g,
                time_s=args.time,
                grind=args.grind,
                flow_profile=args.flow_profile,
                drink_type=args.drink_type,
                acidity=args.acidity,
                sweetness=args.sweetness,
                body=args.body,
                clarity=args.clarity,
                balance=args.balance,
                notes=args.notes,
                logged_by=args.logged_by,
                as_json=args.json,
            )
        elif args.command == "log-maint":
            task_name = args.task_id or args.task_opt
            if not task_name:
                sys.stderr.write("Error: log-maint requires a task identifier (e.g. chemical_backflush, water_filter_replace).\n")
                return 1
            cmd_log_maint(client, task_id=task_name, service_date=args.date, notes=args.notes, as_json=args.json)
        elif args.command == "rate-bag":
            cmd_rate_bag(
                client,
                bag_id=args.bag_id,
                overall=args.overall,
                black=args.black,
                milk=args.milk,
                notes=args.notes,
                tags=args.tags,
                rebuy=args.rebuy,
                archive=args.archive,
                as_json=args.json,
            )
        elif args.command == "recommend":
            cmd_recommend(
                client,
                drink_mode=args.drink,
                top_n=args.top,
                preference=args.preference,
                roaster=args.roaster,
                as_json=args.json,
            )
        elif args.command == "recipes":
            cmd_recipes(client, category=args.category, as_json=args.json)
        elif args.command == "cellar":
            cmd_cellar(client, status_filter=args.status, category_filter=args.category, as_json=args.json)
        return 0
    except Exception as e:
        sys.stderr.write(f"Command Execution Error: {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
