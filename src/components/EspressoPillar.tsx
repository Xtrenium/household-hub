import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coffee,
  Droplets,
  Flame,
  Info,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  Wrench,
  X,
} from 'lucide-react';
import {
  computeMaintenanceStatus,
  computeSuitabilityScores,
  computeWaterStatus,
  diagnoseExtraction,
} from '../lib/coffeeEngine';
import { supabase } from '../lib/supabase';
import {
  CoffeeBag,
  CoffeeMachineState,
  CoffeeShot,
  HouseholdProfile,
} from '../types/household';

interface EspressoPillarProps {
  profile: HouseholdProfile;
}

export const EspressoPillar: React.FC<EspressoPillarProps> = ({ profile }) => {
  const [machineState, setMachineState] = useState<CoffeeMachineState | null>(null);
  const [bags, setBags] = useState<CoffeeBag[]>([]);
  const [shots, setShots] = useState<CoffeeShot[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Sub-tabs for Espresso Pillar
  const [viewTab, setViewTab] = useState<'cockpit' | 'catalog' | 'history'>('cockpit');

  // Detail Dial-In Dialog Ref & State
  const dialInDialogRef = useRef<HTMLDialogElement>(null);
  const [dialInGrind, setDialInGrind] = useState<number>(14.5);
  const [dialInDose, setDialInDose] = useState<number>(18.0);
  const [dialInYield, setDialInYield] = useState<number>(38.0);
  const [dialInTime, setDialInTime] = useState<number>(28.0);
  const [dialInDrinkType, setDialInDrinkType] = useState<string>('espresso');
  const [dialInFlowProfile, setDialInFlowProfile] = useState<string>('standard_9bar');
  const [dialInAcidity, setDialInAcidity] = useState<number>(3.8);
  const [dialInSweetness, setDialInSweetness] = useState<number>(4.2);
  const [dialInBody, setDialInBody] = useState<number>(4.0);
  const [dialInClarity, setDialInClarity] = useState<number>(4.0);
  const [dialInBalance, setDialInBalance] = useState<number>(4.2);
  const [dialInNotes, setDialInNotes] = useState<string>('');

  // Flojet Oxygen Sanitizer Guardrail Dialog Ref
  const flojetDialogRef = useRef<HTMLDialogElement>(null);
  const [flojetConfirmed, setFlojetConfirmed] = useState(false);

  // Bag Rating Dialog Ref & State
  const ratingDialogRef = useRef<HTMLDialogElement>(null);
  const [ratingBag, setRatingBag] = useState<CoffeeBag | null>(null);
  const [ratingOverall, setRatingOverall] = useState<number>(8.5);
  const [ratingBlack, setRatingBlack] = useState<number>(8.5);
  const [ratingMilk, setRatingMilk] = useState<number>(8.5);
  const [ratingNotes, setRatingNotes] = useState<string>('');

  // Catalog Filter
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'straight' | 'milk'>('all');

  // Fetch all live coffee state from Supabase
  const fetchCoffeeData = async () => {
    try {
      setLoading(true);
      const [stateRes, bagsRes, shotsRes] = await Promise.all([
        supabase.from('coffee_machine_state').select('*').eq('id', 'profitec_drive_primary').single(),
        supabase.from('coffee_bags').select('*').order('name'),
        supabase.from('coffee_shots').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      if (stateRes.data) {
        setMachineState(stateRes.data as CoffeeMachineState);
      }
      if (bagsRes.data) {
        setBags(bagsRes.data as CoffeeBag[]);
      }
      if (shotsRes.data) {
        setShots(shotsRes.data as CoffeeShot[]);
      }
    } catch (err) {
      console.error('Error fetching coffee data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoffeeData();
  }, []);

  // Active Hopper Bag
  const activeBag = useMemo(() => {
    return bags.find((b) => b.status === 'ACTIVE') || bags[0] || null;
  }, [bags]);

  // Derived Water & Maintenance Status
  const waterStatus = useMemo(() => {
    if (!machineState?.water_engine) return null;
    return computeWaterStatus(machineState.water_engine);
  }, [machineState]);

  const maintStatus = useMemo(() => {
    if (!machineState?.maintenance_engine) return null;
    return computeMaintenanceStatus(machineState.maintenance_engine);
  }, [machineState]);

  // Live computed scores for Detail Dial-In Modal
  const dialInSensoryScores = useMemo(() => {
    return computeSuitabilityScores(
      dialInAcidity,
      dialInSweetness,
      dialInBody,
      dialInClarity,
      dialInBalance
    );
  }, [dialInAcidity, dialInSweetness, dialInBody, dialInClarity, dialInBalance]);

  const dialInDiagnostics = useMemo(() => {
    return diagnoseExtraction({
      grind: dialInGrind,
      dose: dialInDose,
      yieldG: dialInYield,
      timeS: dialInTime,
      acidity: dialInAcidity,
      sweetness: dialInSweetness,
      body: dialInBody,
      clarity: dialInClarity,
      balance: dialInBalance,
    });
  }, [
    dialInGrind,
    dialInDose,
    dialInYield,
    dialInTime,
    dialInAcidity,
    dialInSweetness,
    dialInBody,
    dialInClarity,
    dialInBalance,
  ]);

  // 1-Tap Neverfail 11L Jug Swap
  const handleSwapJug = async () => {
    if (!machineState) return;
    try {
      setActionLoading(true);
      const curWe = machineState.water_engine;
      const newTotalJugs = (curWe.total_jugs_swapped || 0) + 1;
      const newConsumed = (curWe.total_consumed_liters || 0) + 11.0;
      const newRemaining = Math.max(0, (curWe.rated_capacity_liters || 2700.0) - newConsumed);

      const nextWaterEngine = {
        ...curWe,
        total_jugs_swapped: newTotalJugs,
        total_consumed_liters: newConsumed,
        total_remaining_liters: newRemaining,
      };

      const auditEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: 'water',
        action: 'swap_jug',
        details: {
          volume_l: 11.0,
          total_jugs: newTotalJugs,
          swapped_by: profile,
        },
      };

      const nextAuditLog = [auditEntry, ...(machineState.audit_log || [])];

      const { error } = await supabase
        .from('coffee_machine_state')
        .update({
          water_engine: nextWaterEngine,
          audit_log: nextAuditLog,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'profitec_drive_primary');

      if (error) throw error;

      setMachineState((prev) =>
        prev
          ? {
              ...prev,
              water_engine: nextWaterEngine,
              audit_log: nextAuditLog,
            }
          : null
      );

      setFeedbackMsg({ type: 'ok', text: '+11L Neverfail Jug logged successfully! Fresh spring water engaged.' });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update water';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Option 1: 1-Tap Quick Shot Logging (+1 Shot 18g OR +2 Morning Coffees 36g)
  const handleQuickShot = async (count: 1 | 2) => {
    if (!activeBag || !machineState) return;
    try {
      setActionLoading(true);
      const dosePerShot = activeBag.current_dose_g || 18.0;
      const totalDose = dosePerShot * count;
      const totalYield = (activeBag.current_yield_g || 38.0) * count;
      const grind = activeBag.current_grind_setting || 14.5;
      const timeS = activeBag.current_time_s || 28.0;

      // 1. Decrement active bag remaining weight
      const newBagWeight = Math.max(0, (activeBag.remaining_weight_g || 250.0) - totalDose);
      const newBagStatus: CoffeeBag['status'] = newBagWeight <= 18.0 ? 'ARCHIVED' : activeBag.status;

      await supabase
        .from('coffee_bags')
        .update({
          remaining_weight_g: newBagWeight,
          status: newBagStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeBag.id);

      // 2. Increment machine state shots_since_last_clean
      const curChem = machineState.maintenance_engine?.chemical_backflush || {
        target_shots: 40,
        warning_shots: 35,
        shots_since_last_clean: 0,
        last_cleaned_date: '2026-10-01',
        detergent: 'Breville Eco BES013CLR',
      };
      const newShotsSinceClean = (curChem.shots_since_last_clean || 0) + count;
      const nextMaintEngine = {
        ...machineState.maintenance_engine,
        chemical_backflush: {
          ...curChem,
          shots_since_last_clean: newShotsSinceClean,
        },
      };

      await supabase
        .from('coffee_machine_state')
        .update({
          maintenance_engine: nextMaintEngine,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'profitec_drive_primary');

      // 3. Insert record into coffee_shots
      const ratio = Number((totalYield / totalDose).toFixed(2));
      const flowRate = Number((totalYield / timeS).toFixed(2));

      const shotData = {
        bag_id: activeBag.id,
        bean_name: activeBag.name,
        roaster: activeBag.roaster,
        log_mode: 'QUICK' as const,
        logged_by: profile,
        shots_pulled: count,
        grind_setting: grind,
        dose_g: totalDose,
        yield_g: totalYield,
        time_s: timeS,
        brew_ratio: ratio,
        flow_rate_gps: flowRate,
        drink_type: count === 1 ? 'espresso' : 'morning_coffees',
        flow_profile: 'standard_9bar',
        acidity: activeBag.typical_radar?.acidity || 3.8,
        sweetness: activeBag.typical_radar?.sweetness || 4.2,
        body: activeBag.typical_radar?.body || 4.0,
        clarity: activeBag.typical_radar?.clarity || 4.0,
        balance: activeBag.typical_radar?.balance || 4.2,
      };

      const { data: insertedShot, error: shotErr } = await supabase
        .from('coffee_shots')
        .insert([shotData])
        .select()
        .single();

      if (shotErr) throw shotErr;

      // Update local state optimistically
      setBags((prev) =>
        prev.map((b) => (b.id === activeBag.id ? { ...b, remaining_weight_g: newBagWeight, status: newBagStatus } : b))
      );
      setMachineState((prev) =>
        prev
          ? {
              ...prev,
              maintenance_engine: nextMaintEngine,
            }
          : null
      );
      if (insertedShot) {
        setShots((prev) => [insertedShot as CoffeeShot, ...prev]);
      }

      setFeedbackMsg({
        type: 'ok',
        text: `Quick Shot logged: +${count} shot(s) (${totalDose}g pulled from ${activeBag.name}). Counter: ${newShotsSinceClean} shots.`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to log shot';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Option 2: Open Detail Dial-In Modal
  const openDialInModal = () => {
    if (activeBag) {
      setDialInGrind(activeBag.current_grind_setting || 14.5);
      setDialInDose(activeBag.current_dose_g || 18.0);
      setDialInYield(activeBag.current_yield_g || 38.0);
      setDialInTime(activeBag.current_time_s || 28.0);
      setDialInAcidity(activeBag.typical_radar?.acidity || 3.8);
      setDialInSweetness(activeBag.typical_radar?.sweetness || 4.2);
      setDialInBody(activeBag.typical_radar?.body || 4.0);
      setDialInClarity(activeBag.typical_radar?.clarity || 4.0);
      setDialInBalance(activeBag.typical_radar?.balance || 4.2);
    }
    dialInDialogRef.current?.showModal();
  };

  // Save Detail Dial-In Modal Shot
  const handleSaveDetailShot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBag || !machineState) return;

    try {
      setActionLoading(true);

      // Deduct dose from active bag and update dial settings
      const newBagWeight = Math.max(0, (activeBag.remaining_weight_g || 250.0) - dialInDose);
      const newBagStatus: CoffeeBag['status'] = newBagWeight <= 18.0 ? 'ARCHIVED' : activeBag.status;

      await supabase
        .from('coffee_bags')
        .update({
          remaining_weight_g: newBagWeight,
          status: newBagStatus,
          current_grind_setting: dialInGrind,
          current_dose_g: dialInDose,
          current_yield_g: dialInYield,
          current_time_s: dialInTime,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeBag.id);

      // Increment machine shots counter
      const curChem = machineState.maintenance_engine?.chemical_backflush || {
        target_shots: 40,
        warning_shots: 35,
        shots_since_last_clean: 0,
        last_cleaned_date: '2026-10-01',
        detergent: 'Breville Eco BES013CLR',
      };
      const newShotsSinceClean = (curChem.shots_since_last_clean || 0) + 1;
      const nextMaintEngine = {
        ...machineState.maintenance_engine,
        chemical_backflush: {
          ...curChem,
          shots_since_last_clean: newShotsSinceClean,
        },
      };

      await supabase
        .from('coffee_machine_state')
        .update({
          maintenance_engine: nextMaintEngine,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'profitec_drive_primary');

      // Insert full sensory detail shot
      const shotData = {
        bag_id: activeBag.id,
        bean_name: activeBag.name,
        roaster: activeBag.roaster,
        log_mode: 'DETAIL' as const,
        logged_by: profile,
        shots_pulled: 1,
        grind_setting: dialInGrind,
        dose_g: dialInDose,
        yield_g: dialInYield,
        time_s: dialInTime,
        brew_ratio: dialInDiagnostics.ratio,
        flow_rate_gps: dialInDiagnostics.flowRate,
        drink_type: dialInDrinkType,
        flow_profile: dialInFlowProfile,
        acidity: dialInAcidity,
        sweetness: dialInSweetness,
        body: dialInBody,
        clarity: dialInClarity,
        balance: dialInBalance,
        straight_score: dialInSensoryScores.straightScore,
        milk_score: dialInSensoryScores.milkScore,
        straight_tier: dialInSensoryScores.straightTier,
        milk_tier: dialInSensoryScores.milkTier,
        troubleshooting: {
          is_sweet_spot: dialInDiagnostics.is_sweet_spot,
          summary: dialInDiagnostics.summary,
          issues: dialInDiagnostics.issues,
          prescriptions: dialInDiagnostics.prescriptions,
        },
        notes: dialInNotes.trim() || undefined,
      };

      const { data: insertedShot, error: shotErr } = await supabase
        .from('coffee_shots')
        .insert([shotData])
        .select()
        .single();

      if (shotErr) throw shotErr;

      // Update state
      setBags((prev) =>
        prev.map((b) =>
          b.id === activeBag.id
            ? {
                ...b,
                remaining_weight_g: newBagWeight,
                status: newBagStatus,
                current_grind_setting: dialInGrind,
                current_dose_g: dialInDose,
                current_yield_g: dialInYield,
                current_time_s: dialInTime,
              }
            : b
        )
      );
      setMachineState((prev) =>
        prev
          ? {
              ...prev,
              maintenance_engine: nextMaintEngine,
            }
          : null
      );
      if (insertedShot) {
        setShots((prev) => [insertedShot as CoffeeShot, ...prev]);
      }

      dialInDialogRef.current?.close();
      setFeedbackMsg({
        type: 'ok',
        text: `Sensory Shot Saved! Straight: ${dialInSensoryScores.straightScore} (${dialInSensoryScores.straightTier}), Milk: ${dialInSensoryScores.milkScore} (${dialInSensoryScores.milkTier}).`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save dial-in shot';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Reset Maintenance Task Handlers
  const handleResetTask = async (taskKey: string) => {
    if (!machineState) return;

    if (taskKey === 'flojet_sanitization') {
      setFlojetConfirmed(false);
      flojetDialogRef.current?.showModal();
      return;
    }

    try {
      setActionLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const curMaint = machineState.maintenance_engine;
      let nextMaint = { ...curMaint };
      let auditMsg = '';

      if (taskKey === 'chemical_backflush') {
        const curChem = curMaint.chemical_backflush;
        nextMaint = {
          ...curMaint,
          chemical_backflush: {
            ...curChem,
            shots_since_last_clean: 0,
            last_cleaned_date: today,
            status: 'OK',
          },
        };
        auditMsg = 'Chemical backflush performed with 1 Breville Eco Tablet. Seasoning shot required to restore cam lipids.';
      } else {
        const keyTyped = taskKey as keyof Omit<typeof curMaint, 'chemical_backflush'>;
        const curTask = curMaint[keyTyped] || { interval_days: 30 };
        nextMaint = {
          ...curMaint,
          [keyTyped]: {
            ...curTask,
            last_performed_date: today,
          },
        };
        auditMsg = `Maintenance completed: ${taskKey}`;
      }

      const auditEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: 'maintenance',
        action: taskKey,
        details: {
          performed_by: profile,
          note: auditMsg,
        },
      };

      const nextAuditLog = [auditEntry, ...(machineState.audit_log || [])];

      const { error } = await supabase
        .from('coffee_machine_state')
        .update({
          maintenance_engine: nextMaint,
          audit_log: nextAuditLog,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'profitec_drive_primary');

      if (error) throw error;

      setMachineState((prev) =>
        prev
          ? {
              ...prev,
              maintenance_engine: nextMaint,
              audit_log: nextAuditLog,
            }
          : null
      );

      setFeedbackMsg({ type: 'ok', text: `${taskKey} reset completed!` });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reset maintenance';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm Flojet Oxygen Sanitization
  const handleConfirmFlojet = async () => {
    if (!machineState) return;
    try {
      setActionLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const nextWaterEngine = {
        ...machineState.water_engine,
        flojet_sanitization: {
          ...machineState.water_engine.flojet_sanitization,
          last_sanitized_date: today,
        },
      };

      const auditEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        category: 'maintenance',
        action: 'flojet_sanitization',
        details: {
          performed_by: profile,
          protocol: 'Oxygen-based sanitizer (Cafetto Inverso). Disconnected upstream of BWT.',
        },
      };

      const nextAuditLog = [auditEntry, ...(machineState.audit_log || [])];

      const { error } = await supabase
        .from('coffee_machine_state')
        .update({
          water_engine: nextWaterEngine,
          audit_log: nextAuditLog,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'profitec_drive_primary');

      if (error) throw error;

      setMachineState((prev) =>
        prev
          ? {
              ...prev,
              water_engine: nextWaterEngine,
              audit_log: nextAuditLog,
            }
          : null
      );

      flojetDialogRef.current?.close();
      setFeedbackMsg({ type: 'ok', text: 'Flojet suction line sanitized with oxygen sanitizer! Next due in 180 days.' });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update Flojet status';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Switch Active Hopper Bag
  const handleSetActiveBag = async (bagId: string) => {
    try {
      setActionLoading(true);
      // Set all other active bags to CATALOG
      await supabase.from('coffee_bags').update({ status: 'CATALOG' }).eq('status', 'ACTIVE');
      // Set target bag to ACTIVE
      await supabase.from('coffee_bags').update({ status: 'ACTIVE' }).eq('id', bagId);

      setBags((prev) =>
        prev.map((b) => ({
          ...b,
          status: b.id === bagId ? 'ACTIVE' : b.status === 'ACTIVE' ? 'CATALOG' : b.status,
        }))
      );

      setFeedbackMsg({ type: 'ok', text: 'Active hopper bean updated!' });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set active bag';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Bag Rating Modal
  const openRatingModal = (bag: CoffeeBag) => {
    setRatingBag(bag);
    setRatingOverall(bag.rating_overall || 8.0);
    setRatingBlack(bag.rating_black || 8.0);
    setRatingMilk(bag.rating_milk || 8.0);
    setRatingNotes(bag.user_notes || '');
    ratingDialogRef.current?.showModal();
  };

  // Save Bag Rating
  const handleSaveBagRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingBag) return;

    try {
      setActionLoading(true);
      const updates = {
        rating_overall: ratingOverall,
        rating_black: ratingBlack,
        rating_milk: ratingMilk,
        user_notes: ratingNotes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('coffee_bags').update(updates).eq('id', ratingBag.id);
      if (error) throw error;

      setBags((prev) => prev.map((b) => (b.id === ratingBag.id ? { ...b, ...updates } : b)));
      ratingDialogRef.current?.close();
      setFeedbackMsg({ type: 'ok', text: `Rating saved for ${ratingBag.name}!` });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save rating';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered & Ranked 14-Bean Catalog
  const filteredCatalog = useMemo(() => {
    const list = [...bags];
    if (catalogFilter === 'straight') {
      // Sort by Straight suitability (clarity, sweetness, acidity balance)
      return list.sort((a, b) => {
        const scoreA = (a.typical_radar?.clarity || 0) * 1.5 + (a.typical_radar?.sweetness || 0) * 1.5;
        const scoreB = (b.typical_radar?.clarity || 0) * 1.5 + (b.typical_radar?.sweetness || 0) * 1.5;
        return scoreB - scoreA;
      });
    }
    if (catalogFilter === 'milk') {
      // Sort by Milk suitability (body, sweetness)
      return list.sort((a, b) => {
        const scoreA = (a.typical_radar?.body || 0) * 2.0 + (a.typical_radar?.sweetness || 0) * 1.5;
        const scoreB = (b.typical_radar?.body || 0) * 2.0 + (b.typical_radar?.sweetness || 0) * 1.5;
        return scoreB - scoreA;
      });
    }
    return list;
  }, [bags, catalogFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 text-slate-400">
        <Coffee className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium">Connecting to Profitec Drive &amp; BWT Engine...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Toast Alert */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            feedbackMsg.type === 'ok'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Banner & Sub-View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-black shadow-inner">
            <Coffee className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Espresso Bar</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Profitec Drive E61
              </span>
            </div>
            <p className="text-xs text-slate-400">
              DF54 (54mm DLC) • Flojet BW5000 • BWT Bestmax Premium Size M
            </p>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setViewTab('cockpit')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              viewTab === 'cockpit' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Cockpit &amp; Logging
          </button>
          <button
            onClick={() => setViewTab('catalog')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              viewTab === 'catalog' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            14-Bean Catalog ({bags.length})
          </button>
          <button
            onClick={() => setViewTab('history')}
            className={`px-3.5 py-1.5 rounded-lg transition ${
              viewTab === 'history' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Shot History ({shots.length})
          </button>
        </div>
      </div>

      {viewTab === 'cockpit' && (
        <>
          {/* Visual Equipment Cockpit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Machine Specs Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <span>Machine Cockpit</span>
                <span className="text-emerald-400 font-bold">PID Ready</span>
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Profitec Drive E61</h3>
                <p className="text-xs text-slate-400">Dual Boiler • Commercial Rotary Pump</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase">Brew PID</div>
                  <div className="text-sm font-bold text-amber-400">93.0°C</div>
                  <div className="text-[10px] text-slate-400">0.75L Stainless</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase">Steam PID</div>
                  <div className="text-sm font-bold text-cyan-400">1.4 Bar</div>
                  <div className="text-[10px] text-slate-400">2.0L Stainless</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Needle valve flow paddle (0 to 8 g/s standard)</span>
              </div>
            </div>

            {/* DF54 Grinder Specs Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <span>Single-Dose Grinder</span>
                <span className="text-cyan-400 font-bold">Ionizer Active</span>
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Turin / MiiCoffee DF54</h3>
                <p className="text-xs text-slate-400">54mm DLC Flat Burrs • &lt;0.1g Retention</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase">Active Grind #</div>
                  <div className="text-sm font-bold text-emerald-400">
                    #{activeBag?.current_grind_setting?.toFixed(1) || '14.5'}
                  </div>
                  <div className="text-[10px] text-slate-400">Stepless Collar</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase">Plasma Ionizer</div>
                  <div className="text-sm font-bold text-indigo-400">Zero Static</div>
                  <div className="text-[10px] text-slate-400">Twin Emitter Pins</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Next burr chamber vacuum due in {maintStatus?.tasks.find((t) => t.key === 'df54_burr_clean')?.daysRemaining || 24}d</span>
              </div>
            </div>

            {/* Flojet & BWT Water Overview */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
                <span>Mineralization &amp; Water</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    waterStatus?.filterAlertStatus === 'OK'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {waterStatus?.filterAlertStatus || 'OK'}
                </span>
              </div>
              <div>
                <h3 className="font-bold text-white text-base">BWT Bestmax Premium (M)</h3>
                <p className="text-xs text-slate-400">Bypass 0 • AromaPLUS Magnesium Enriched</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase">Remaining Spring Water</div>
                  <div className="text-sm font-bold text-cyan-400">{waterStatus?.remainingL || 2458} L</div>
                  <div className="text-[10px] text-slate-400">of 2,700L Rated</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 font-medium uppercase">Calendar Expiry</div>
                  <div className="text-sm font-bold text-amber-400">{waterStatus?.calendarDaysRemaining || 183}d</div>
                  <div className="text-[10px] text-slate-400">2027-04-18 (12-Mo)</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Binding constraint: <strong className="text-amber-400">{waterStatus?.limitingConstraint}</strong></span>
                <span className="text-[10px] text-slate-500">{waterStatus?.jugsRemaining} Neverfail jugs left</span>
              </div>
            </div>
          </div>

          {/* Water Dual-Decay & +11L Neverfail Jug Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-base font-bold text-white">Water Engine &amp; Dual-Decay Monitor</h2>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                      waterStatus?.filterAlertStatus === 'OK'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    Filter Status: {waterStatus?.filterAlertStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  2,700L volumetric rating vs. 2027-04-18 DIN 1988 12-month calendar hygienic expiration.
                </p>
              </div>

              {/* 1-Tap +11L Jug Button */}
              <button
                onClick={handleSwapJug}
                disabled={actionLoading}
                className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+11L Neverfail Jug</span>
              </button>
            </div>

            {/* Dual Decay Progress Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Volumetric Bar */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Volumetric Remaining</span>
                  <span className="font-bold text-white">
                    {waterStatus?.remainingL} L / {waterStatus?.ratedCap} L ({waterStatus?.volumePercentRemaining}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                    style={{ width: `${waterStatus?.volumePercentRemaining || 91}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Consumed: {waterStatus?.consumedL} L ({machineState?.water_engine.total_jugs_swapped || 22} jugs swapped)</span>
                  <span>Limiting: {waterStatus?.limitingConstraint === 'VOLUME' ? 'YES' : 'NO'}</span>
                </div>
              </div>

              {/* Calendar Countdown Bar */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Calendar Remaining (12-Mo DIN Expiry)</span>
                  <span className="font-bold text-amber-400">
                    {waterStatus?.calendarDaysRemaining} days remaining ({waterStatus?.calendarPercentRemaining}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${waterStatus?.calendarPercentRemaining || 50}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Installed: {machineState?.water_engine.installed_date || '2026-04-18'}</span>
                  <span>Limiting Constraint: <strong className="text-amber-400">{waterStatus?.limitingConstraint}</strong></span>
                </div>
              </div>
            </div>

            {/* Flojet Sanitization Badge & Guardrail Link */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-slate-300">
                  Flojet Suction Wand Sanitization: Next due in{' '}
                  <strong className="text-white">{waterStatus?.flojetDaysRemaining || 174} days</strong> (180d cycle).
                </span>
              </div>
              <button
                onClick={() => handleResetTask('flojet_sanitization')}
                className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline"
              >
                Log Sanitization
              </button>
            </div>
          </div>

          {/* E61 Shot Counter & Cam Protection Alert */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-bold text-white">E61 Shot Counter &amp; Cam Protection</h2>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                      maintStatus?.chem.status === 'OK'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : maintStatus?.chem.status === 'DUE_SOON'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    Status: {maintStatus?.chem.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Chemical detergent strips silicone grease (Molykote 111) from brass operating cams. Strictly metered to 35–40 shots.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleResetTask('chemical_backflush')}
                  disabled={actionLoading}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reset Detergent Clean</span>
                </button>
              </div>
            </div>

            {/* Shots Counter Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">
                  Shots Since Chemical Clean:{' '}
                  <strong className="text-white text-sm">{maintStatus?.chem.shots_since_last_clean || 15}</strong> / 40 shots limit
                </span>
                <span className="text-[11px] text-slate-400">
                  Warning at <strong>35 shots</strong> • Overdue at <strong>40 shots</strong>
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (maintStatus?.chem.shots_since_last_clean || 15) >= 40
                      ? 'bg-rose-500'
                      : (maintStatus?.chem.shots_since_last_clean || 15) >= 35
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(100, (((maintStatus?.chem.shots_since_last_clean || 15) / 40) * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Overdue/Warning Banner */}
            {(maintStatus?.chem.shots_since_last_clean || 0) >= 35 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong>CAM LUBRICATION PROTECTION:</strong> 35-shot threshold reached. Perform chemical backflush with 1 Breville Eco Tablet, then <strong>pull and discard 1 seasoning shot</strong> to re-coat brass cams with coffee oils.
                </div>
              </div>
            )}
          </div>

          {/* Active Hopper Bag & Dual-Mode Shot Logging */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-bold text-white">Active Hopper Coffee &amp; Dual-Mode Logging</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Pulls automatically deduct grams from the active bag and advance the E61 cam counter.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={openDialInModal}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5 transition border border-slate-700 shadow"
                >
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>Detail Dial-In &amp; Sensory Log</span>
                </button>
              </div>
            </div>

            {/* Active Bag Profile Card */}
            {activeBag ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
                <div className="space-y-1 lg:col-span-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black">
                      ACTIVE HOPPER
                    </span>
                    <span className="text-xs text-slate-400">
                      {activeBag.roaster} • {activeBag.city || 'Melbourne'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{activeBag.name}</h3>
                  <p className="text-xs text-slate-300">
                    {activeBag.process} • {activeBag.roast_level} • Origins: {activeBag.origins?.join(', ')}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeBag.flavor_notes?.map((note, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-amber-300 font-medium"
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 lg:border-l lg:border-slate-800 lg:pl-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Remaining Beans:</span>
                    <strong className="text-white text-sm">
                      {activeBag.remaining_weight_g?.toFixed(1) || '250.0'}g
                    </strong>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        activeBag.remaining_weight_g <= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(100, ((activeBag.remaining_weight_g || 250) / 250) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Dial: #{activeBag.current_grind_setting || '14.5'}</span>
                    <span>1:{activeBag.recommended_ratio || '2.1'} ratio</span>
                    <span>{activeBag.drink_suitability}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                No active bag selected. Choose one from the 14-bean catalog below.
              </div>
            )}

            {/* Option 1: 1-Tap Quick Shot Buttons */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Coffee className="w-4 h-4 text-amber-400" />
                <span>Option 1: 1-Tap Quick Shot Logging</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => handleQuickShot(1)}
                  disabled={actionLoading || !activeBag}
                  className="p-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-sm flex items-center justify-between transition group shadow-md disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                      +1
                    </div>
                    <div className="text-left">
                      <div className="text-white font-bold group-hover:text-amber-300">Quick Single Double (18g)</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        18g dose • 38g out • 28s • #{activeBag?.current_grind_setting || '14.5'}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition" />
                </button>

                <button
                  onClick={() => handleQuickShot(2)}
                  disabled={actionLoading || !activeBag}
                  className="p-3.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-sm flex items-center justify-between transition group shadow-md disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-black">
                      +2
                    </div>
                    <div className="text-left">
                      <div className="text-white font-bold group-hover:text-indigo-300">2x Morning Coffees (36g)</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        Brandon &amp; Meg • 36g dose • 76g out • 28s
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-1 transition" />
                </button>
              </div>
            </div>
          </div>

          {/* 7 Maintenance Tasks Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-bold text-white">7 Maintenance Tasks &amp; Safety Guardrails</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  1-Tap completion resets. Strict oxygen-based sanitizer guardrail enforced for Flojet.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {maintStatus?.tasks.map((task) => (
                <div
                  key={task.key}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">{task.label}</h4>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          task.status === 'OK'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : task.status === 'DUE_SOON'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{task.detail}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-500">
                      Due in: <strong className="text-slate-300">{task.daysRemaining}d</strong> ({task.intervalDays}d cycle)
                    </span>
                    <button
                      onClick={() => handleResetTask(task.key)}
                      disabled={actionLoading}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ViewTab: 14-Bean Catalog & Recommender */}
      {viewTab === 'catalog' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">14-Bean Australian Specialty Roaster Catalog</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Curated roaster blends &amp; single origins from Melbourne, Sydney, and Canberra.
              </p>
            </div>

            {/* Catalog Filter Tabs */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold self-start sm:self-auto">
              <button
                onClick={() => setCatalogFilter('all')}
                className={`px-3 py-1 rounded-lg transition ${
                  catalogFilter === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                All 14
              </button>
              <button
                onClick={() => setCatalogFilter('straight')}
                className={`px-3 py-1 rounded-lg transition ${
                  catalogFilter === 'straight' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Top Straight Picks
              </button>
              <button
                onClick={() => setCatalogFilter('milk')}
                className={`px-3 py-1 rounded-lg transition ${
                  catalogFilter === 'milk' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Top Milk Picks
              </button>
            </div>
          </div>

          {/* Beans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCatalog.map((bag) => {
              const isActive = bag.status === 'ACTIVE';
              return (
                <div
                  key={bag.id}
                  className={`p-4 rounded-xl border transition flex flex-col justify-between space-y-3 ${
                    isActive
                      ? 'bg-amber-500/5 border-amber-500/40 shadow-lg'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                        {bag.roaster} • {bag.city}
                      </span>
                      {isActive ? (
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                          Active Hopper
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">{bag.drink_suitability}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{bag.name}</h3>
                      <p className="text-xs text-slate-400">
                        {bag.process} • {bag.roast_level} • ${bag.price_aud?.toFixed(2)} AUD / 250g
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {bag.flavor_notes?.map((fn, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                        >
                          {fn}
                        </span>
                      ))}
                    </div>

                    {/* Sensory Radar Miniature */}
                    <div className="grid grid-cols-5 gap-1 pt-1 text-center">
                      <div className="p-1 rounded bg-slate-900 text-[9px] text-slate-400">
                        Acid <strong className="block text-slate-200">{bag.typical_radar?.acidity}</strong>
                      </div>
                      <div className="p-1 rounded bg-slate-900 text-[9px] text-slate-400">
                        Sweet <strong className="block text-amber-400">{bag.typical_radar?.sweetness}</strong>
                      </div>
                      <div className="p-1 rounded bg-slate-900 text-[9px] text-slate-400">
                        Body <strong className="block text-slate-200">{bag.typical_radar?.body}</strong>
                      </div>
                      <div className="p-1 rounded bg-slate-900 text-[9px] text-slate-400">
                        Clar <strong className="block text-slate-200">{bag.typical_radar?.clarity}</strong>
                      </div>
                      <div className="p-1 rounded bg-slate-900 text-[9px] text-slate-400">
                        Bal <strong className="block text-emerald-400">{bag.typical_radar?.balance}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions & Ratings */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openRatingModal(bag)}
                        className="text-[11px] font-semibold text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {bag.rating_overall ? `${bag.rating_overall}/10` : 'Rate Bag'}
                        </span>
                      </button>
                    </div>

                    {!isActive && (
                      <button
                        onClick={() => handleSetActiveBag(bag.id)}
                        disabled={actionLoading}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-white transition"
                      >
                        Set as Active Hopper
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ViewTab: Shot History */}
      {viewTab === 'history' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Recent Shot History</h2>
              <p className="text-xs text-slate-400 mt-0.5">Last 20 extractions recorded in Sydney Supabase</p>
            </div>
          </div>

          <div className="divide-y divide-slate-800">
            {shots.map((shot) => (
              <div key={shot.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{shot.bean_name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {shot.log_mode}
                    </span>
                    <span className="text-[10px] text-amber-400">by {shot.logged_by}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {shot.dose_g}g in • {shot.yield_g}g out • {shot.time_s}s • #{shot.grind_setting} • {shot.drink_type}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  {shot.straight_score ? (
                    <div>
                      <div className="text-xs font-bold text-amber-400">
                        Str: {shot.straight_score} ({shot.straight_tier})
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Milk: {shot.milk_score} ({shot.milk_tier})
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500">Quick Shot</span>
                  )}
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {new Date(shot.created_at).toLocaleDateString()} {new Date(shot.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Option 2: Detail Dial-In Modal (Native <dialog closedby="any">) */}
      <dialog
        ref={dialInDialogRef}
        closedby="any"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="w-full max-w-2xl bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white">Detail Dial-In &amp; 5-Axis Sensory Logging</h3>
              <p className="text-xs text-slate-400">
                Puck kinematics + Divergent Straight vs. Milk suitability scoring
              </p>
            </div>
          </div>
          <button
            onClick={() => dialInDialogRef.current?.close()}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveDetailShot} className="space-y-4">
          {/* Kinematics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                DF54 Grind #
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={dialInGrind}
                onChange={(e) => setDialInGrind(parseFloat(e.target.value) || 14.5)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Dose (g)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={dialInDose}
                onChange={(e) => setDialInDose(parseFloat(e.target.value) || 18.0)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Yield (g)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={dialInYield}
                onChange={(e) => setDialInYield(parseFloat(e.target.value) || 38.0)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Time (s)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={dialInTime}
                onChange={(e) => setDialInTime(parseFloat(e.target.value) || 28.0)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-amber-500"
              />
            </div>
          </div>

          {/* Flow Profile & Drink Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Drink Target
              </label>
              <select
                value={dialInDrinkType}
                onChange={(e) => setDialInDrinkType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500"
              >
                <option value="espresso">Espresso (Straight)</option>
                <option value="long_black">Long Black</option>
                <option value="flat_white">Flat White</option>
                <option value="latte">Latte</option>
                <option value="cappuccino">Cappuccino</option>
                <option value="piccolo">Piccolo</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Profitec Flow Profile
              </label>
              <select
                value={dialInFlowProfile}
                onChange={(e) => setDialInFlowProfile(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500"
              >
                <option value="standard_9bar">Standard 9-Bar Flat Profile</option>
                <option value="soft_preinfusion_6s">Soft Pre-Infusion (1/4 turn 2.5 bar 6s)</option>
                <option value="declining_flow_6bar">Declining Flow (Taper to 5-6 bar past 50%)</option>
              </select>
            </div>
          </div>

          {/* 5-Axis Sensory Sliders */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              5-Axis Sensory Radar (1.0 to 5.0)
            </h4>

            {/* Acidity */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Acidity (Tartness &amp; Malic/Citric Sparkle)</span>
                <span className="font-bold text-amber-400">{dialInAcidity.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.1"
                value={dialInAcidity}
                onChange={(e) => setDialInAcidity(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Sweetness */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Sweetness (Caramel, Fruit Fructose, Panela)</span>
                <span className="font-bold text-amber-400">{dialInSweetness.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.1"
                value={dialInSweetness}
                onChange={(e) => setDialInSweetness(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Body */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Body (Tactile Texture &amp; Creamy Weight)</span>
                <span className="font-bold text-amber-400">{dialInBody.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.1"
                value={dialInBody}
                onChange={(e) => setDialInBody(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Clarity */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Clarity (Individual Note Separation)</span>
                <span className="font-bold text-amber-400">{dialInClarity.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.1"
                value={dialInClarity}
                onChange={(e) => setDialInClarity(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            {/* Balance */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Balance (Harmonic Integration)</span>
                <span className="font-bold text-amber-400">{dialInBalance.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="5.0"
                step="0.1"
                value={dialInBalance}
                onChange={(e) => setDialInBalance(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>

          {/* Computed Suitability Scores & Diagnostics Card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Straight Espresso Score</div>
                <div className="text-xl font-black text-amber-400">
                  {dialInSensoryScores.straightScore}
                  <span className="text-xs text-slate-400 font-normal"> / 100</span>
                </div>
                <div className="text-xs font-semibold text-emerald-400">
                  {dialInSensoryScores.straightTier}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Milk Drink Score</div>
                <div className="text-xl font-black text-cyan-400">
                  {dialInSensoryScores.milkScore}
                  <span className="text-xs text-slate-400 font-normal"> / 100</span>
                </div>
                <div className="text-xs font-semibold text-indigo-400">
                  {dialInSensoryScores.milkTier}
                </div>
              </div>
            </div>

            {/* Diagnostics Summary */}
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Kinematics:</span>
                <span className="font-bold text-white">
                  1:{dialInDiagnostics.ratio} ratio • {dialInDiagnostics.flowRate} g/s flow rate
                </span>
                {dialInDiagnostics.is_sweet_spot && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    SWEET SPOT
                  </span>
                )}
              </div>
              <div className="text-slate-300 font-medium">{dialInDiagnostics.summary}</div>
            </div>
          </div>

          {/* Tasting Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Barista Tasting Notes
            </label>
            <textarea
              rows={2}
              value={dialInNotes}
              onChange={(e) => setDialInNotes(e.target.value)}
              placeholder="e.g. Crisp blood orange, juicy panela sweetness, syrupy finish..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => dialInDialogRef.current?.close()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shadow-lg shadow-amber-500/20"
            >
              Save Dial-In Shot
            </button>
          </div>
        </form>
      </dialog>

      {/* Flojet Sanitization Guardrail Modal */}
      <dialog
        ref={flojetDialogRef}
        closedby="any"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="w-full max-w-md bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start gap-3 text-rose-400 mb-3">
          <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-white text-base">Flojet Sanitization Safety Guardrail</h3>
            <p className="text-xs text-rose-300 mt-1 font-semibold">
              MANDATORY OXYGEN-BASED SANITIZER PROTOCOL
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-slate-300 p-3.5 rounded-xl bg-slate-950 border border-slate-800 leading-relaxed">
          <p>
            <strong className="text-white">Strict Chemical Rule:</strong> Use{' '}
            <strong className="text-emerald-400">OXYGEN-BASED SANITIZER ONLY</strong> (e.g. Cafetto Inverso or 100% Sodium Percarbonate).
          </p>
          <p className="text-rose-300">
            <strong>NEVER use chlorine, bleach, or Milton tablets:</strong> Chlorides cause catastrophic stress corrosion cracking in stainless steel boilers and permanently destroy BWT ion-exchange resin.
          </p>
          <p>
            <strong className="text-amber-400">Disconnection Invariant:</strong> Always disconnect the Flojet line upstream of the BWT filter head before circulating sanitizer, and flush thoroughly with fresh spring water before reconnecting.
          </p>
        </div>

        <div className="pt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="guardrailCheck"
            checked={flojetConfirmed}
            onChange={(e) => setFlojetConfirmed(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-0"
          />
          <label htmlFor="guardrailCheck" className="text-xs text-slate-300 font-medium">
            I confirm oxygen sanitizer was used with BWT disconnected
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={() => flojetDialogRef.current?.close()}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!flojetConfirmed || actionLoading}
            onClick={handleConfirmFlojet}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs"
          >
            Confirm Sanitization Reset
          </button>
        </div>
      </dialog>

      {/* Bag Rating Modal */}
      <dialog
        ref={ratingDialogRef}
        closedby="any"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="w-full max-w-md bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-base">Rate {ratingBag?.name}</h3>
          </div>
          <button
            onClick={() => ratingDialogRef.current?.close()}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveBagRating} className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Overall Rating (1–10)</span>
              <span className="font-bold text-amber-400">{ratingOverall.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.5"
              value={ratingOverall}
              onChange={(e) => setRatingOverall(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Black / Straight Rating (1–10)</span>
              <span className="font-bold text-amber-400">{ratingBlack.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.5"
              value={ratingBlack}
              onChange={(e) => setRatingBlack(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Milk Drink Rating (1–10)</span>
              <span className="font-bold text-amber-400">{ratingMilk.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.5"
              value={ratingMilk}
              onChange={(e) => setRatingMilk(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              User Notes
            </label>
            <textarea
              rows={2}
              value={ratingNotes}
              onChange={(e) => setRatingNotes(e.target.value)}
              placeholder="e.g. Sublime acidity with milk chocolate body..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => ratingDialogRef.current?.close()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
            >
              Save Rating
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};
