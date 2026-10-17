import React, { useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChefHat,
  ClipboardCheck,
  Copy,
  Flame,
  Plus,
  Snowflake,
  Trash2,
  Utensils,
} from 'lucide-react';
import {
  ALL_DAYS,
  DayCode,
  HouseholdProfile,
  MealPlanBlock,
  Product,
  Recipe,
} from '../types/household';

interface MealsPillarProps {
  profile: HouseholdProfile;
  recipes: Recipe[];
  products: Product[];
  blocks: MealPlanBlock[];
  onAddBlock: (block: Omit<MealPlanBlock, 'id'>) => Promise<void>;
  onUpdateBlock: (id: string, updates: Partial<MealPlanBlock>) => Promise<void>;
  onDeleteBlock: (id: string) => Promise<void>;
}

export const MealsPillar: React.FC<MealsPillarProps> = ({
  profile,
  recipes,
  products,
  blocks,
  onAddBlock,
  onUpdateBlock,
  onDeleteBlock,
}) => {
  const [subView, setSubView] = useState<'schedule' | 'vault'>('schedule');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(
    recipes[0]?.id || 'rec_adult_bkfst_burritos'
  );
  const [mealSlot, setMealSlot] = useState<string>('Breakfast');
  const [targetGroup, setTargetGroup] = useState<string>('Both Adults');
  const [dinersPerDay, setDinersPerDay] = useState<number>(2);
  const [cookSession, setCookSession] = useState<string>('Sunday Prep');
  const [selectedDays, setSelectedDays] = useState<DayCode[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [savingBlock, setSavingBlock] = useState(false);
  const [copiedKeep, setCopiedKeep] = useState(false);
  const [keepMode, setKeepMode] = useState<'shopping' | 'recipes'>('shopping');

  const keepDialogRef = useRef<HTMLDialogElement>(null);

  const recipeMap = useMemo(() => {
    const m = new Map<string, Recipe>();
    recipes.forEach((r) => m.set(r.id, r));
    return m;
  }, [recipes]);

  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const selectedRecipe = recipeMap.get(selectedRecipeId) || recipes[0];
  const totalAssignedServings = selectedDays.length * dinersPerDay;

  const toggleDay = (day: DayCode) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const applyPreset = (days: DayCode[]) => {
    setSelectedDays(days);
  };

  const handleRecipeSelectChange = (recId: string) => {
    setSelectedRecipeId(recId);
    const r = recipeMap.get(recId);
    if (!r) return;
    if (r.category.toLowerCase().includes('breakfast')) {
      setMealSlot('Breakfast');
      setTargetGroup('Both Adults');
      setDinersPerDay(2);
      setCookSession('Sunday Prep');
    } else if (r.category.toLowerCase().includes('kids lunch')) {
      setMealSlot('Wolf Lunchbox');
      setTargetGroup('Wolf');
      setDinersPerDay(1);
      setSelectedDays(['Mon', 'Tue', 'Thu', 'Fri']);
      setCookSession('Sunday Prep & Wednesday Night');
    } else if (r.category.toLowerCase().includes('kids')) {
      setMealSlot('Kid Dinner');
      setTargetGroup('Both Kids');
      setDinersPerDay(2);
      setCookSession('Sunday Prep');
    } else if (r.category.toLowerCase().includes('lunch')) {
      setMealSlot('Lunch');
      setTargetGroup('Both Adults');
      setDinersPerDay(2);
      setCookSession('Sunday Prep');
    } else {
      setMealSlot('Dinner');
      setTargetGroup('Both Adults');
      setDinersPerDay(2);
      setCookSession('Monday Night');
    }
  };

  const handleCreateBatchBlock = async () => {
    if (!selectedRecipe || selectedDays.length === 0) return;
    setSavingBlock(true);
    try {
      await onAddBlock({
        recipe_id: selectedRecipe.id,
        meal_slot: mealSlot,
        target_group: targetGroup,
        diners_per_day: dinersPerDay,
        assigned_days: selectedDays,
        cook_session: cookSession,
        checked_steps: [],
        sort_order: blocks.length + 1,
        active: true,
      });
    } finally {
      setSavingBlock(false);
    }
  };

  const handleToggleStep = async (block: MealPlanBlock, stepIndex: number) => {
    const exists = block.checked_steps.includes(stepIndex);
    const nextSteps = exists
      ? block.checked_steps.filter((i) => i !== stepIndex)
      : [...block.checked_steps, stepIndex];
    await onUpdateBlock(block.id, { checked_steps: nextSteps });
  };

  // Compute daily macro totals for the active Adult profile (Brandon vs Meg)
  const dailyAdultMacros = useMemo(() => {
    const result: Record<DayCode, { calories: number; protein: number; meals: string[] }> = {
      Sun: { calories: 0, protein: 0, meals: [] },
      Mon: { calories: 0, protein: 0, meals: [] },
      Tue: { calories: 0, protein: 0, meals: [] },
      Wed: { calories: 0, protein: 0, meals: [] },
      Thu: { calories: 0, protein: 0, meals: [] },
      Fri: { calories: 0, protein: 0, meals: [] },
      Sat: { calories: 0, protein: 0, meals: [] },
    };

    blocks.forEach((b) => {
      if (!b.active) return;
      const appliesToAdult =
        b.target_group === 'Both Adults' ||
        b.target_group === 'Adults' ||
        b.target_group === profile;
      if (!appliesToAdult) return;

      const rec = recipeMap.get(b.recipe_id);
      if (!rec) return;

      b.assigned_days.forEach((d) => {
        if (result[d]) {
          result[d].calories += rec.macros_per_serving?.calories || 0;
          result[d].protein += rec.macros_per_serving?.protein_g || 0;
          result[d].meals.push(`${b.meal_slot}: ${rec.title}`);
        }
      });
    });

    // Add Brandon's +100 kcal / +18g P yoghurt/cottage cheese supplement on active prep days
    if (profile === 'Brandon') {
      ALL_DAYS.forEach((d) => {
        if (result[d].calories > 0) {
          result[d].calories += 95;
          result[d].protein += 17;
        }
      });
    }

    return result;
  }, [blocks, recipeMap, profile]);

  // Pristine Google Keep text generator (STRICTLY NO bullets, NO brackets, NO blank lines)
  const googleKeepText = useMemo(() => {
    if (keepMode === 'shopping') {
      const grouped: Record<string, string[]> = {};

      blocks
        .filter((b) => b.active)
        .forEach((b) => {
          const rec = recipeMap.get(b.recipe_id);
          if (!rec) return;
          const totalServings = b.assigned_days.length * b.diners_per_day;
          const scale = rec.servings > 0 ? totalServings / rec.servings : 1;

          rec.ingredients.forEach((ing) => {
            const prod = ing.product_id ? productMap.get(ing.product_id) : undefined;
            const cat = (prod?.category || 'MEAL PREP INGREDIENTS').toUpperCase();
            if (!grouped[cat]) grouped[cat] = [];

            const scaledPacks = ing.shop_packs
              ? Math.max(1, Math.ceil(Number((ing.shop_packs * scale).toFixed(2))))
              : null;
            const packPrefix = scaledPacks ? `${scaledPacks}x pack ` : '';
            const scaleNote =
              scale !== 1
                ? ` (scaled ${totalServings}x vs ${rec.servings}x base)`
                : '';
            const line = `${packPrefix}${ing.name} — ${ing.quantity}${scaleNote} [${rec.title.slice(0, 28)}]`;
            grouped[cat].push(line);
          });
        });

      if (profile === 'Brandon') {
        const dairyKey = 'DAIRY & EGGS';
        if (!grouped[dairyKey]) grouped[dairyKey] = [];
        grouped[dairyKey].push(
          '1x 700g tub Coles High Protein Plain Yoghurt or Cottage Cheese [Brandon +100 kcal / 18g P Daily Supplement]'
        );
      }

      const lines: string[] = [];
      Object.entries(grouped).forEach(([cat, items]) => {
        lines.push(`--- ${cat} ---`);
        items.forEach((item) => lines.push(item));
      });
      return lines.join('\n');
    } else {
      const lines: string[] = [];
      blocks
        .filter((b) => b.active)
        .forEach((b) => {
          const rec = recipeMap.get(b.recipe_id);
          if (!rec) return;
          const totalServings = b.assigned_days.length * b.diners_per_day;
          lines.push(
            `=== ${rec.title.toUpperCase()} (${totalServings} SERVINGS • ${b.assigned_days.join(', ')}) ===`
          );
          lines.push(
            `Macros/serving: ${rec.macros_per_serving.calories} kcal | ${rec.macros_per_serving.protein_g}g P | ${rec.macros_per_serving.carbs_g}g C | ${rec.macros_per_serving.fat_g}g F`
          );
          lines.push('--- INGREDIENTS ---');
          rec.ingredients.forEach((ing) => {
            const m = ing.macros_per_serving;
            const mTag = m
              ? ` [${m.calories} kcal | ${m.protein_g}g P | ${m.carbs_g}g C | ${m.fat_g}g F]`
              : '';
            lines.push(`${ing.quantity} ${ing.name}${mTag}`);
          });
          lines.push('--- COOKING STEPS ---');
          rec.instructions.forEach((step, idx) => {
            lines.push(`Step ${idx + 1}: ${step}`);
          });
        });
      return lines.join('\n');
    }
  }, [blocks, recipeMap, productMap, profile, keepMode]);

  const handleCopyKeep = async () => {
    await navigator.clipboard.writeText(googleKeepText);
    setCopiedKeep(true);
    setTimeout(() => setCopiedKeep(false), 2200);
  };

  return (
    <div className="space-y-6">
      {/* Top Macro Target & Google Keep Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
              {profile}&apos;s Macro Target
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white">
              {profile === 'Brandon'
                ? '1,500 kcal | 160g Protein (Shared 1,400 kcal + 150g High-Protein Yoghurt)'
                : '1,400 kcal | 142g Protein (Strict 3 Core Meals, Zero Snacks)'}
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Daily Trifecta: Beef Breakfast (~485 kcal) • Poultry Lunch (~400 kcal) • Pork/Distinct Dinner (~515 kcal) • Mission 25cm Burrito Wraps
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-1">
            <button
              onClick={() => setSubView('schedule')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                subView === 'schedule'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Weekly Prep &amp; Batch Plan
            </button>
            <button
              onClick={() => setSubView('vault')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                subView === 'vault'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Recipe Vault ({recipes.length})
            </button>
          </div>

          <button
            onClick={() => keepDialogRef.current?.showModal()}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
          >
            <Copy className="w-3.5 h-3.5" />
            Google Keep Shopping List
          </button>
        </div>
      </div>

      {/* 7-Day Macro Compliance Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {ALL_DAYS.map((day) => {
          const dm = dailyAdultMacros[day];
          const targetCal = profile === 'Brandon' ? 1500 : 1400;
          const isOnTarget = dm.calories > 0 && Math.abs(dm.calories - targetCal) <= 130;
          return (
            <div
              key={day}
              className={`rounded-xl border p-3 transition ${
                dm.calories > 0
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-slate-950/60 border-slate-900 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {day}
                </span>
                {dm.calories > 0 && (
                  <span
                    className={`text-xs font-bold ${
                      isOnTarget ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {Math.round(dm.protein)}g P
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm font-bold text-white">
                {dm.calories > 0 ? `${Math.round(dm.calories)} kcal` : 'Free / Flex'}
              </div>
              <div className="text-xs text-slate-400 truncate mt-0.5">
                {dm.meals.length > 0 ? `${dm.meals.length} planned meals` : 'No batch assigned'}
              </div>
            </div>
          );
        })}
      </div>

      {subView === 'schedule' ? (
        <>
          {/* Multi-Day / Slot Batch Assigner */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  Flex Multi-Day Batch Assigner (Add a Meal Across Multiple Days at Once)
                </h3>
                <p className="text-xs text-slate-400">
                  Select a recipe once, tap the days covered (e.g. Sun–Fri or Mon–Thu), and ingredient packs scale automatically.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])}
                  className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-300 hover:border-amber-500 transition"
                >
                  Mon–Fri (5d)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(['Sun', 'Mon', 'Tue', 'Wed', 'Thu'])}
                  className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-300 hover:border-amber-500 transition"
                >
                  Sun–Thu (5d)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'])}
                  className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-300 hover:border-amber-500 transition"
                >
                  Sun–Fri (6d)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(['Mon', 'Tue', 'Thu', 'Fri'])}
                  className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-300 hover:border-amber-500 transition"
                >
                  Wolf School (Mon/Tue/Thu/Fri)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  1. Recipe
                </label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => handleRecipeSelectChange(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs sm:text-sm text-white"
                >
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.macros_per_serving.calories} kcal | {r.macros_per_serving.protein_g}g P)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  2. Meal Slot
                </label>
                <select
                  value={mealSlot}
                  onChange={(e) => setMealSlot(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs sm:text-sm text-white"
                >
                  <option value="Breakfast">Adult Breakfast</option>
                  <option value="Lunch">Adult Lunch</option>
                  <option value="Dinner">Adult Dinner</option>
                  <option value="Kid Dinner">Kids Dinner (Wolf &amp; 3yo)</option>
                  <option value="Wolf Lunchbox">Wolf School Lunchbox</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  3. Diners &amp; Target
                </label>
                <select
                  value={`${targetGroup}|${dinersPerDay}`}
                  onChange={(e) => {
                    const [tg, dp] = e.target.value.split('|');
                    setTargetGroup(tg);
                    setDinersPerDay(Number(dp));
                  }}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs sm:text-sm text-white"
                >
                  <option value="Both Adults|2">Both Adults (Brandon &amp; Meg — 2/day)</option>
                  <option value="Brandon|1">Just Brandon (1/day)</option>
                  <option value="Meg|1">Just Meg (1/day)</option>
                  <option value="Both Kids|2">Both Kids (Wolf &amp; 3yo — 2/day)</option>
                  <option value="Wolf|1">Wolf Only (1/day)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  4. Cook Session
                </label>
                <select
                  value={cookSession}
                  onChange={(e) => setCookSession(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs sm:text-sm text-white"
                >
                  <option value="Sunday Prep">Sunday Afternoon Big Prep</option>
                  <option value="Monday Night">Monday Night Slow-Cooker</option>
                  <option value="Wednesday Night">Wednesday Night Mini-Prep</option>
                  <option value="Sunday Prep & Wednesday Night">Sun + Wed Split Prep</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  5. Tap Days Covered by This Batch
                </span>
                <span className="text-xs font-bold text-amber-400">
                  {selectedDays.length} days × {dinersPerDay} diner{dinersPerDay > 1 ? 's' : ''} ={' '}
                  {totalAssignedServings} Total Servings to Prep
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {ALL_DAYS.map((d) => {
                  const active = selectedDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                        active
                          ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="text-xs text-slate-300">
                {selectedRecipe && (
                  <>
                    <strong>{selectedRecipe.title}:</strong> Scales from {selectedRecipe.servings} base servings →{' '}
                    <span className="text-amber-400 font-bold">{totalAssignedServings} servings</span> (
                    {Math.round(selectedRecipe.macros_per_serving.calories)} kcal |{' '}
                    {selectedRecipe.macros_per_serving.protein_g}g P per serving)
                  </>
                )}
              </div>
              <button
                type="button"
                disabled={savingBlock || selectedDays.length === 0}
                onClick={handleCreateBatchBlock}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 transition"
              >
                <Plus className="w-4 h-4" />
                {savingBlock ? 'Adding Batch...' : `Assign ${totalAssignedServings}-Serving Batch`}
              </button>
            </div>
          </div>

          {/* Active Weekly Batch Cards with Live Checkoff Steps */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Active Weekly Prep Batches ({blocks.length})
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {blocks.map((block) => {
                const rec = recipeMap.get(block.recipe_id);
                if (!rec) return null;
                const batchServings = block.assigned_days.length * block.diners_per_day;
                const scaleFactor = rec.servings > 0 ? batchServings / rec.servings : 1;
                const fridgeServings = Math.min(batchServings, block.diners_per_day * 2);
                const freezeServings = Math.max(0, batchServings - fridgeServings);

                return (
                  <div
                    key={block.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-xs font-bold">
                              {block.cook_session}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs font-semibold">
                              {block.meal_slot} • {block.target_group}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-bold">
                              {batchServings} Servings ({block.assigned_days.join(', ')})
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-white mt-2">{rec.title}</h4>
                        </div>

                        <button
                          onClick={() => onDeleteBlock(block.id)}
                          title="Remove batch from schedule"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Macros & Equipment */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                        <span className="font-bold text-amber-400">
                          {rec.macros_per_serving.calories} kcal
                        </span>
                        <span>•</span>
                        <span className="font-bold text-emerald-400">
                          {rec.macros_per_serving.protein_g}g P
                        </span>
                        <span>•</span>
                        <span>{rec.macros_per_serving.carbs_g}g C</span>
                        <span>•</span>
                        <span>{rec.macros_per_serving.fat_g}g F</span>
                        {rec.equipment_used?.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-sky-400 flex items-center gap-1">
                              <Flame className="w-3.5 h-3.5" />
                              {rec.equipment_used.join(' + ')}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Freeze Split / Moisture Guardrail Badge */}
                      {block.meal_slot === 'Breakfast' && freezeServings > 0 && (
                        <div className="flex items-center gap-2 text-xs text-sky-300 bg-sky-500/10 border border-sky-500/20 rounded-xl px-3 py-2">
                          <Snowflake className="w-4 h-4 shrink-0 text-sky-400" />
                          <span>
                            <strong>3/2 Freeze Split:</strong> Keep {fridgeServings} wraps in Fridge (first 2 days) &amp; Freeze {freezeServings} wraps in foil. Cheese barrier directly on tortilla first!
                          </span>
                        </div>
                      )}

                      {/* Scaled Ingredients List */}
                      <details className="group bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                        <summary className="text-xs font-bold uppercase tracking-wider text-slate-300 cursor-pointer flex items-center justify-between">
                          <span>
                            🛒 Coles Ingredients ({rec.ingredients.length} items • Scaled to {batchServings} servings)
                          </span>
                          <span className="text-amber-400 group-open:rotate-180 transition">▼</span>
                        </summary>
                        <ul className="mt-2.5 space-y-1.5 text-xs text-slate-300 border-t border-slate-800 pt-2.5">
                          {rec.ingredients.map((ing, i) => {
                            const m = ing.macros_per_serving;
                            const scaledPacks = ing.shop_packs
                              ? Math.ceil(Number((ing.shop_packs * scaleFactor).toFixed(2)))
                              : null;
                            return (
                              <li key={i} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                <span>
                                  <strong className="text-white">{ing.quantity}</strong>{' '}
                                  {scaleFactor !== 1 && (
                                    <span className="text-amber-400 font-semibold">
                                      (×{scaleFactor.toFixed(1)} batch)
                                    </span>
                                  )}{' '}
                                  {ing.name}
                                  {scaledPacks && (
                                    <span className="text-slate-400">
                                      {' '}
                                      — {scaledPacks}x Coles pack
                                    </span>
                                  )}
                                </span>
                                {m && (
                                  <span className="text-slate-400 font-mono shrink-0">
                                    [{m.calories} kcal | {m.protein_g}g P]
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </details>

                      {/* Interactive Step-by-Step Cooking Checkboxes */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                          <span>👨‍🍳 Live Prep Steps (Tap to check off with Meg)</span>
                          <span>
                            {block.checked_steps.length} / {rec.instructions.length} done
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {rec.instructions.map((step, idx) => {
                            const checked = block.checked_steps.includes(idx);
                            return (
                              <label
                                key={idx}
                                onClick={() => handleToggleStep(block, idx)}
                                className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition ${
                                  checked
                                    ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-400 line-through'
                                    : 'bg-slate-950/50 border-slate-800/70 text-slate-200 hover:border-slate-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {}}
                                  className="mt-0.5 rounded accent-emerald-500"
                                />
                                <span>
                                  <strong className="text-white">Step {idx + 1}:</strong> {step}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        /* Full Recipe Vault View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipes.map((rec) => (
            <div
              key={rec.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase text-amber-400">
                    {rec.category} • {rec.rotation_group}
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5">{rec.title}</h3>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 shrink-0">
                  Base: {rec.servings} servings
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 font-bold">
                  {rec.macros_per_serving.calories} kcal
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 font-bold">
                  {rec.macros_per_serving.protein_g}g Protein
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                  {rec.macros_per_serving.carbs_g}g C • {rec.macros_per_serving.fat_g}g F
                </span>
              </div>

              {rec.notes && (
                <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  {rec.notes}
                </p>
              )}

              <div className="text-xs text-slate-300 space-y-1">
                <div className="font-semibold text-slate-400 uppercase">
                  Equipment Calibration:
                </div>
                <div>{rec.equipment_used?.join(' • ') || 'Standard Kitchen'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Native <dialog closedby="any"> for Pristine Google Keep Export */}
      <dialog
        ref={keepDialogRef}
        closedby="any"
        className="w-full max-w-2xl rounded-2xl bg-slate-900 text-slate-100 border border-slate-700 p-5 sm:p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-emerald-400" />
              Google Keep Native Checklist Export
            </h3>
            <p className="text-xs text-slate-400">
              Zero Markdown brackets, zero bullets, zero blank lines — paste straight into Google Keep with checkboxes enabled.
            </p>
          </div>
          <button
            onClick={() => keepDialogRef.current?.close()}
            className="px-3 py-1 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
          >
            Esc / Close
          </button>
        </div>

        <div className="py-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-xl bg-slate-950 border border-slate-800 p-1">
              <button
                onClick={() => setKeepMode('shopping')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  keepMode === 'shopping'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🛒 Weekly Coles Shopping List
              </button>
              <button
                onClick={() => setKeepMode('recipes')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  keepMode === 'recipes'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                👨‍🍳 Full Recipe Cards for Keep
              </button>
            </div>

            <button
              onClick={handleCopyKeep}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition"
            >
              {copiedKeep ? (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copy All for Google Keep
                </>
              )}
            </button>
          </div>

          <pre className="text-xs bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto max-h-96 leading-relaxed text-slate-200 select-all">
            {googleKeepText}
          </pre>
        </div>
      </dialog>
    </div>
  );
};
