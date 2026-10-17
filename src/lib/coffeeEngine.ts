import { MaintenanceEngineState, WaterEngineState } from '../types/household';

export function clamp(val: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, Number(val) || low));
}

export function getSuitabilityTier(score: number): string {
  if (score >= 90) return 'Outstanding';
  if (score >= 75) return 'Great';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Sub-optimal';
  return 'Unsuited';
}

/**
 * Exact port of compute_suitability_scores from Coffee Machine/engine/dialin.py
 */
export function computeSuitabilityScores(
  acidity: number,
  sweetness: number,
  body: number,
  clarity: number,
  balance: number
) {
  const a = clamp(acidity, 1, 5);
  const s = clamp(sweetness, 1, 5);
  const b = clamp(body, 1, 5);
  const c = clamp(clarity, 1, 5);
  const bal = clamp(balance, 1, 5);

  // 1. Straight Espresso / Long Black Suitability
  const rawStraight = 22.0 * bal + 20.0 * s + 18.0 * c + 12.0 * b + 10.0 * a;
  const penaltySourImbalance = Math.max(0.0, a - s) * 12.0;
  const penaltyHarshAstringency = bal <= 3.0 ? Math.max(0.0, 3.0 - c) * 8.0 : 0.0;
  const bonusSweetSpot = Math.max(0.0, s - 4.0) * 10.0 + Math.max(0.0, bal - 4.0) * 10.0;
  const adjStraight = rawStraight - penaltySourImbalance - penaltyHarshAstringency + bonusSweetSpot;
  const straightScore = Number(clamp(((adjStraight - 82.0) / (410.0 - 82.0)) * 100.0, 0.0, 100.0).toFixed(1));

  // 2. Milk-Based Drink Suitability
  const rawMilk = 28.0 * b + 26.0 * s + 18.0 * bal + 10.0 * c + 8.0 * a;
  const penaltyCurdle = a > s ? Math.max(0.0, a - 3.2) * 16.0 : Math.max(0.0, a - 3.8) * 8.0;
  const penaltyThinBody = Math.max(0.0, 2.8 - b) * 20.0;
  const bonusMilkSynergy = Math.max(0.0, b - 4.0) * 15.0 + Math.max(0.0, s - 4.0) * 15.0;
  const adjMilk = rawMilk - penaltyCurdle - penaltyThinBody + bonusMilkSynergy;
  const milkScore = Number(clamp(((adjMilk - 90.0) / (450.0 - 90.0)) * 100.0, 0.0, 100.0).toFixed(1));

  return {
    straightScore,
    milkScore,
    straightTier: getSuitabilityTier(straightScore),
    milkTier: getSuitabilityTier(milkScore),
  };
}

/**
 * Exact port of diagnose_extraction from Coffee Machine/engine/dialin.py
 */
export function diagnoseExtraction(params: {
  grind: number;
  dose: number;
  yieldG: number;
  timeS: number;
  acidity: number;
  sweetness: number;
  body: number;
  clarity: number;
  balance: number;
}) {
  const { grind, dose, yieldG, timeS, acidity, sweetness, body, balance } = params;
  const ratio = dose > 0 ? Number((yieldG / dose).toFixed(2)) : 2.0;
  const flowRate = timeS > 0 ? Number((yieldG / timeS).toFixed(2)) : 1.35;

  const issues: string[] = [];
  const prescriptions: string[] = [];

  if (timeS < 22 || flowRate > 2.0) {
    issues.push(`Fast gusher (${timeS.toFixed(1)}s, ${flowRate} g/s) — low puck resistance.`);
    prescriptions.push(
      `Grind FINER on DF54 by 0.5–1.0 steps (toward #${Math.max(10, grind - 0.8).toFixed(1)}) or increase dose by +0.5g.`
    );
  } else if (timeS > 36 || flowRate < 0.9) {
    issues.push(`Choked / slow extraction (${timeS.toFixed(1)}s, ${flowRate} g/s).`);
    prescriptions.push(
      `Grind COARSER on DF54 by 0.5–1.0 steps (toward #${(grind + 0.8).toFixed(1)}) or use 5s 2-bar pre-infusion on the Profitec flow paddle.`
    );
  }

  if (acidity >= 4.2 && sweetness <= 3.2) {
    issues.push('Sour-dominant under-extraction (sharp acidity outrunning sweetness).');
    prescriptions.push(
      `Extend yield ratio from 1:${ratio} to 1:${(ratio + 0.25).toFixed(2)} (+4g out) or raise Profitec PID brew temp by +1°C.`
    );
  }

  if (balance <= 2.8 && body >= 4.0 && sweetness <= 3.0) {
    issues.push('Heavy, bitter/astringent late extraction.');
    prescriptions.push(
      'Taper the Profitec E61 flow control paddle down to 6 bar for the final 10g of the shot, or shorten yield by 3–4g.'
    );
  }

  const isSweetSpot =
    issues.length === 0 &&
    timeS >= 24 &&
    timeS <= 34 &&
    sweetness >= 3.8 &&
    balance >= 3.8;

  const summary = isSweetSpot
    ? 'Optimal Sweet Spot Achieved! Dial-in locked for Profitec Drive & DF54.'
    : issues.length > 0
      ? `${issues[0]} → ${prescriptions[0]}`
      : 'Balanced extraction kinematics. Fine-tune ratio ±2g to taste.';

  return {
    ratio,
    flowRate,
    is_sweet_spot: isSweetSpot,
    summary,
    issues,
    prescriptions,
  };
}

/**
 * Computes live BWT Bestmax Premium Size M & Flojet BW5000 status
 */
export function computeWaterStatus(we: WaterEngineState) {
  const now = new Date();
  const installDate = new Date(we.installed_date || '2026-04-18');
  const expiryDate = new Date(we.expiry_date || '2027-04-18');
  const lastSanitized = new Date(we.flojet_sanitization?.last_sanitized_date || '2026-04-11');

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalCalendarDays = Math.max(1, Math.round((expiryDate.getTime() - installDate.getTime()) / msPerDay));
  const calendarDaysRemaining = Math.round((expiryDate.getTime() - now.getTime()) / msPerDay);
  const calendarPercentRemaining = clamp((calendarDaysRemaining / totalCalendarDays) * 100, 0, 100);

  const ratedCap = we.rated_capacity_liters || 2700;
  const consumed = we.total_consumed_liters || 0;
  const remainingL = Math.max(0, ratedCap - consumed);
  const volumePercentRemaining = clamp((remainingL / ratedCap) * 100, 0, 100);

  const limitingConstraint = calendarPercentRemaining <= volumePercentRemaining ? 'CALENDAR' : 'VOLUME';

  let filterAlertStatus: 'OK' | 'DUE_SOON' | 'OVERDUE' = 'OK';
  if (calendarDaysRemaining <= 0 || remainingL <= 0) {
    filterAlertStatus = 'OVERDUE';
  } else if (calendarDaysRemaining <= 30 || remainingL <= 200) {
    filterAlertStatus = 'DUE_SOON';
  }

  const flojetElapsed = Math.round((now.getTime() - lastSanitized.getTime()) / msPerDay);
  const flojetInterval = we.flojet_sanitization?.interval_days || 180;
  const flojetDaysRemaining = flojetInterval - flojetElapsed;
  let flojetAlertStatus: 'OK' | 'DUE_SOON' | 'OVERDUE' = 'OK';
  if (flojetDaysRemaining <= 0) flojetAlertStatus = 'OVERDUE';
  else if (flojetDaysRemaining <= 14) flojetAlertStatus = 'DUE_SOON';

  return {
    consumedL: Number(consumed.toFixed(1)),
    remainingL: Number(remainingL.toFixed(1)),
    ratedCap,
    volumePercentUsed: Number((100 - volumePercentRemaining).toFixed(1)),
    volumePercentRemaining: Number(volumePercentRemaining.toFixed(1)),
    jugsRemaining: Math.floor(remainingL / (we.jug_volume_liters || 11)),
    calendarDaysRemaining,
    calendarPercentRemaining: Number(calendarPercentRemaining.toFixed(1)),
    limitingConstraint,
    filterAlertStatus,
    flojetDaysRemaining,
    flojetAlertStatus,
  };
}

export interface MaintenanceTaskStatus {
  key: string;
  label: string;
  intervalDays: number;
  lastDate: string;
  daysRemaining: number;
  status: 'OK' | 'DUE_SOON' | 'OVERDUE';
  detail: string;
}

export function computeMaintenanceStatus(me: MaintenanceEngineState) {
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;

  const chem = me.chemical_backflush || {
    target_shots: 40,
    warning_shots: 35,
    shots_since_last_clean: 0,
    last_cleaned_date: '2026-10-01',
    detergent: 'Breville Eco BES013CLR (1 tablet)',
  };

  let chemStatus: 'OK' | 'DUE_SOON' | 'OVERDUE' = 'OK';
  if (chem.shots_since_last_clean >= chem.target_shots) chemStatus = 'OVERDUE';
  else if (chem.shots_since_last_clean >= chem.warning_shots) chemStatus = 'DUE_SOON';

  const definitions: Array<{
    key: keyof Omit<MaintenanceEngineState, 'chemical_backflush'>;
    label: string;
    warnDays: number;
    detail: string;
  }> = [
    {
      key: 'water_backflush',
      label: 'Plain Water Backflush',
      warnDays: 0,
      detail: '3–5 hot water pulses (5s) w/ blind basket. Does not strip E61 cam lube.',
    },
    {
      key: 'steam_wand_soak',
      label: 'Steam Wand Tip Soak',
      warnDays: 3,
      detail: 'Soak tip 15m in warm water + 1/2 Breville Eco tablet or 50/50 white vinegar.',
    },
    {
      key: 'shower_screen_gasket',
      label: 'E61 Shower Screen & Gasket',
      warnDays: 5,
      detail: 'Lever off screen & 8.5mm silicone gasket; soak 15m in hot water + 1 Breville Eco tablet.',
    },
    {
      key: 'df54_burr_clean',
      label: 'DF54 Burr & Ionizer Clean',
      warnDays: 5,
      detail: 'Unthread DF54 top collar, vacuum 54mm flat burrs & brush plasma ionizer needles.',
    },
    {
      key: 'steam_boiler_flush',
      label: 'Steam Boiler TDS Flush',
      warnDays: 7,
      detail: 'Heat to 1.2–1.5 bar, turn power OFF, open hot water tap until 0 bar (~1.2L purged).',
    },
    {
      key: 'e61_cam_grease',
      label: 'E61 Brass Cam Molykote 111',
      warnDays: 14,
      detail: 'Apply food-safe DuPont Molykote 111 / Haynes Lubri-Film to E61 lever cam & O-rings.',
    },
  ];

  const tasks: MaintenanceTaskStatus[] = definitions.map((d) => {
    const raw = me[d.key] || { interval_days: 30, last_performed_date: '2026-04-11' };
    const last = new Date(raw.last_performed_date || '2026-04-11');
    const elapsed = Math.floor((now.getTime() - last.getTime()) / msPerDay);
    const daysRemaining = raw.interval_days - elapsed;
    let status: 'OK' | 'DUE_SOON' | 'OVERDUE' = 'OK';
    if (daysRemaining <= 0) status = 'OVERDUE';
    else if (daysRemaining <= d.warnDays) status = 'DUE_SOON';

    return {
      key: d.key,
      label: d.label,
      intervalDays: raw.interval_days,
      lastDate: raw.last_performed_date,
      daysRemaining,
      status,
      detail: d.detail,
    };
  });

  return {
    chem: {
      ...chem,
      status: chemStatus,
    },
    tasks,
  };
}
