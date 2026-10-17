import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  Compass,
  Filter,
  Flame,
  GlassWater,
  Info,
  Layers,
  Minus,
  Plus,
  Search,
  Sparkles,
  Thermometer,
  Wine,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  BlicScores,
  CellarBottle,
  CellarTasting,
  HouseholdProfile,
} from '../types/household';

interface CellarPillarProps {
  profile: HouseholdProfile;
}

export const CellarPillar: React.FC<CellarPillarProps> = ({ profile }) => {
  const [bottles, setBottles] = useState<CellarBottle[]>([]);
  const [tastings, setTastings] = useState<CellarTasting[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OWNED' | 'WATCHLIST'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'WINE' | 'SPIRITS'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const addBottleDialogRef = useRef<HTMLDialogElement>(null);
  const tastingDialogRef = useRef<HTMLDialogElement>(null);

  // Add Bottle Form State
  const [newProducer, setNewProducer] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'wine' | 'whiskey' | 'spirit'>('wine');
  const [newVintage, setNewVintage] = useState('2021');
  const [newCru, setNewCru] = useState('');
  const [newCountry, setNewCountry] = useState('Italy');
  const [newVarietal, setNewVarietal] = useState('Nebbiolo (Barolo DOCG)');
  const [newFormat, setNewFormat] = useState('750ml');
  const [newStatus, setNewStatus] = useState<'OWNED' | 'WATCHLIST'>('OWNED');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newPrice, setNewPrice] = useState<number | ''>(85.0);
  const [newWindow, setNewWindow] = useState('2026 – 2038');
  const [newDecant, setNewDecant] = useState('2–2.5 hours wide-base splash decant');
  const [newTemp, setNewTemp] = useState('16–18°C');
  const [newBbqTags, setNewBbqTags] = useState('Kamado Joe Reverse-Seared Ribeye, Aged Parmigiano');

  // Log Tasting Form State
  const [selectedBottleForTasting, setSelectedBottleForTasting] = useState<CellarBottle | null>(null);
  const [tastingReviewer, setTastingReviewer] = useState<HouseholdProfile>(profile);
  const [tastingScore100, setTastingScore100] = useState<number>(93);
  const [blicBalance, setBlicBalance] = useState<number>(4);
  const [blicLength, setBlicLength] = useState<number>(4);
  const [blicIntensity, setBlicIntensity] = useState<number>(4);
  const [blicComplexity, setBlicComplexity] = useState<number>(4);
  const [noseNotes, setNoseNotes] = useState('');
  const [palateNotes, setPalateNotes] = useState('');
  const [finishNotes, setFinishNotes] = useState('');
  const [pairedMeal, setPairedMeal] = useState('');

  // Fetch all live cellar data from Supabase
  const fetchCellarData = async () => {
    try {
      setLoading(true);
      const [bottlesRes, tastingsRes] = await Promise.all([
        supabase.from('cellar_bottles').select('*').order('name'),
        supabase.from('cellar_tastings').select('*').order('tasted_at', { ascending: false }),
      ]);

      if (bottlesRes.data) {
        setBottles(bottlesRes.data as CellarBottle[]);
      }
      if (tastingsRes.data) {
        setTastings(tastingsRes.data as CellarTasting[]);
      }
    } catch (err) {
      console.error('Error fetching cellar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCellarData();
  }, []);

  // Sync reviewer with incoming profile
  useEffect(() => {
    setTastingReviewer(profile);
  }, [profile]);

  // Filtered Bottles List
  const filteredBottles = useMemo(() => {
    return bottles.filter((b) => {
      // Status Filter
      if (statusFilter === 'OWNED' && b.collection_status !== 'OWNED') return false;
      if (statusFilter === 'WATCHLIST' && b.collection_status !== 'WATCHLIST') return false;

      // Category Filter
      if (categoryFilter === 'WINE' && b.category !== 'wine') return false;
      if (categoryFilter === 'SPIRITS' && b.category !== 'whiskey' && b.category !== 'spirit')
        return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesProducer = b.producer.toLowerCase().includes(q);
        const matchesName = b.name.toLowerCase().includes(q);
        const matchesVintage = b.vintage?.toLowerCase().includes(q);
        const matchesCru = b.region_or_cru?.toLowerCase().includes(q);
        const matchesVarietal = b.varietal_or_style.toLowerCase().includes(q);
        const matchesPairing = b.bbq_pairing_tags?.some((tag) => tag.toLowerCase().includes(q));
        if (!matchesProducer && !matchesName && !matchesVintage && !matchesCru && !matchesVarietal && !matchesPairing) {
          return false;
        }
      }

      return true;
    });
  }, [bottles, statusFilter, categoryFilter, searchQuery]);

  // Aggregate Counts
  const counts = useMemo(() => {
    const owned = bottles.filter((b) => b.collection_status === 'OWNED').length;
    const watchlist = bottles.filter((b) => b.collection_status === 'WATCHLIST').length;
    const totalBottlesInCellar = bottles
      .filter((b) => b.collection_status === 'OWNED')
      .reduce((sum, b) => sum + (b.quantity || 0), 0);
    return {
      all: bottles.length,
      owned,
      watchlist,
      totalBottlesInCellar,
    };
  }, [bottles]);

  // 1-Tap Stock Quantity Adjustments (+ / -)
  const handleUpdateQuantity = async (bottle: CellarBottle, delta: number) => {
    try {
      setActionLoading(true);
      const newQty = Math.max(0, (bottle.quantity || 0) + delta);
      let newStatus = bottle.collection_status;

      // Auto-transition to OWNED if incrementing from 0 in WATCHLIST
      if (bottle.collection_status === 'WATCHLIST' && newQty > 0) {
        newStatus = 'OWNED';
      } else if (newQty === 0 && bottle.collection_status === 'OWNED') {
        newStatus = 'DEPLETED';
      } else if (newQty > 0 && bottle.collection_status === 'DEPLETED') {
        newStatus = 'OWNED';
      }

      const updates: Partial<CellarBottle> = {
        quantity: newQty,
        collection_status: newStatus,
      };

      const { error } = await supabase.from('cellar_bottles').update(updates).eq('id', bottle.id);
      if (error) throw error;

      setBottles((prev) =>
        prev.map((b) => (b.id === bottle.id ? { ...b, ...updates } : b))
      );

      setFeedbackMsg({
        type: 'ok',
        text: `Stock updated: ${bottle.name} now has ${newQty} bottle(s) (${newStatus}).`,
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update quantity';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Tap Fill Level % Buttons (Spirits)
  const handleUpdateFillLevel = async (bottle: CellarBottle, fillPercent: number) => {
    try {
      setActionLoading(true);
      const updates = {
        fill_level_percent: fillPercent,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('cellar_bottles').update(updates).eq('id', bottle.id);
      if (error) throw error;

      setBottles((prev) =>
        prev.map((b) => (b.id === bottle.id ? { ...b, ...updates } : b))
      );

      setFeedbackMsg({
        type: 'ok',
        text: `Fill level updated to ${fillPercent}% for ${bottle.name}.`,
      });
      setTimeout(() => setFeedbackMsg(null), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update fill level';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Tap Verdict Toggles (BUY_AGAIN | TRY_NEXT | AVOID)
  const handleUpdateVerdict = async (
    bottle: CellarBottle,
    verdict: 'BUY_AGAIN' | 'TRY_NEXT' | 'AVOID'
  ) => {
    try {
      setActionLoading(true);
      const updates = {
        buy_again_verdict: verdict,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('cellar_bottles').update(updates).eq('id', bottle.id);
      if (error) throw error;

      setBottles((prev) =>
        prev.map((b) => (b.id === bottle.id ? { ...b, ...updates } : b))
      );

      setFeedbackMsg({
        type: 'ok',
        text: `Verdict set to ${verdict} for ${bottle.name}.`,
      });
      setTimeout(() => setFeedbackMsg(null), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update verdict';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Move Depleted back to Watchlist
  const handleRestoreToWatchlist = async (bottle: CellarBottle) => {
    try {
      setActionLoading(true);
      const updates: Partial<CellarBottle> = {
        collection_status: 'WATCHLIST',
        quantity: 0,
      };

      const { error } = await supabase.from('cellar_bottles').update(updates).eq('id', bottle.id);
      if (error) throw error;

      setBottles((prev) =>
        prev.map((b) => (b.id === bottle.id ? { ...b, ...updates } : b))
      );

      setFeedbackMsg({
        type: 'ok',
        text: `${bottle.name} restored to Watchlist!`,
      });
      setTimeout(() => setFeedbackMsg(null), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Tasting Modal
  const openTastingModal = (bottle: CellarBottle) => {
    setSelectedBottleForTasting(bottle);
    setTastingScore100(bottle.rating_100 || 93);
    setBlicBalance(bottle.blic_scores?.balance || 4);
    setBlicLength(bottle.blic_scores?.length || 4);
    setBlicIntensity(bottle.blic_scores?.intensity || 4);
    setBlicComplexity(bottle.blic_scores?.complexity || 4);
    setNoseNotes('');
    setPalateNotes('');
    setFinishNotes('');
    setPairedMeal(bottle.bbq_pairing_tags?.[0] || '');
    tastingDialogRef.current?.showModal();
  };

  // Save Tasting Record
  const handleSaveTasting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBottleForTasting) return;

    try {
      setActionLoading(true);
      const blic: BlicScores = {
        balance: blicBalance,
        length: blicLength,
        intensity: blicIntensity,
        complexity: blicComplexity,
      };

      // 1. Insert row into cellar_tastings
      const tastingData = {
        bottle_id: selectedBottleForTasting.id,
        logged_by: tastingReviewer,
        tasted_at: new Date().toISOString(),
        score_100: tastingScore100,
        blic,
        nose_notes: noseNotes.trim() || undefined,
        palate_notes: palateNotes.trim() || undefined,
        finish_notes: finishNotes.trim() || undefined,
        paired_meal: pairedMeal.trim() || undefined,
      };

      const { data: insertedTasting, error: tastingErr } = await supabase
        .from('cellar_tastings')
        .insert([tastingData])
        .select()
        .single();

      if (tastingErr) throw tastingErr;

      // 2. Update bottle summary in cellar_bottles
      const compositeNotes = [noseNotes, palateNotes, finishNotes].filter(Boolean).join(' • ');
      const bottleUpdates: Partial<CellarBottle> = {
        rating_100: tastingScore100,
        blic_scores: blic,
        tasting_notes: compositeNotes || selectedBottleForTasting.tasting_notes,
      };

      await supabase.from('cellar_bottles').update(bottleUpdates).eq('id', selectedBottleForTasting.id);

      // 3. Update local states
      if (insertedTasting) {
        setTastings((prev) => [insertedTasting as CellarTasting, ...prev]);
      }
      setBottles((prev) =>
        prev.map((b) =>
          b.id === selectedBottleForTasting.id ? { ...b, ...bottleUpdates } : b
        )
      );

      tastingDialogRef.current?.close();
      setFeedbackMsg({
        type: 'ok',
        text: `Sommelier tasting recorded for ${selectedBottleForTasting.name}: ${tastingScore100} pts (BLIC ${blicBalance}/${blicLength}/${blicIntensity}/${blicComplexity}).`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save tasting';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  // Add New Bottle to Database
  const handleAddBottle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const tagsArray = newBbqTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const orientation =
        newCategory === 'wine'
          ? 'Horizontal (Natural Cork)'
          : 'Strictly Vertical';

      const id = `${newProducer.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')}_${newVintage || 'nv'}`.slice(0, 48);

      const bottleData = {
        id,
        producer: newProducer.trim(),
        name: newName.trim(),
        category: newCategory,
        vintage: newVintage.trim() || undefined,
        region_or_cru: newCru.trim() || undefined,
        country: newCountry.trim(),
        varietal_or_style: newVarietal.trim(),
        format: newFormat,
        collection_status: newStatus,
        quantity: newQuantity,
        fill_level_percent: 100,
        price_aud: typeof newPrice === 'number' ? newPrice : null,
        storage_orientation: orientation,
        drinking_window: newWindow.trim() || undefined,
        decant_protocol: newDecant.trim() || undefined,
        service_temp_c: newTemp.trim() || undefined,
        bbq_pairing_tags: tagsArray,
        blic_scores: { balance: 4, length: 4, intensity: 4, complexity: 4 },
        buy_again_verdict: 'TRY_NEXT' as const,
      };

      const { data: inserted, error } = await supabase
        .from('cellar_bottles')
        .insert([bottleData])
        .select()
        .single();

      if (error) throw error;

      if (inserted) {
        setBottles((prev) => [inserted as CellarBottle, ...prev]);
      }

      addBottleDialogRef.current?.close();
      setFeedbackMsg({
        type: 'ok',
        text: `New bottle added: ${newProducer} ${newName}!`,
      });
      setTimeout(() => setFeedbackMsg(null), 3000);

      // Reset form
      setNewProducer('');
      setNewName('');
      setNewCru('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add bottle';
      setFeedbackMsg({ type: 'err', text: msg });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4 text-slate-400">
        <Wine className="w-8 h-8 animate-spin text-rose-500" />
        <p className="text-sm font-medium">Connecting to Cellar &amp; Barolo Watchlist...</p>
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

      {/* Header Banner & Add Bottle Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-black shadow-inner">
            <Wine className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Cellar &amp; Vault</h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Barolo &amp; Spirits
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {counts.totalBottlesInCellar} Bottles in Cellar • {counts.watchlist} Barolo Watchlist Items • Storage Physics Enforced
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => addBottleDialogRef.current?.showModal()}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bottle</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Filter Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Bottles ({counts.all})
            </button>
            <button
              onClick={() => setStatusFilter('OWNED')}
              className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap ${
                statusFilter === 'OWNED'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              In Cellar ({counts.owned})
            </button>
            <button
              onClick={() => setStatusFilter('WATCHLIST')}
              className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap ${
                statusFilter === 'WATCHLIST'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Watchlist ({counts.watchlist})
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium self-start md:self-auto">
            <button
              onClick={() => setCategoryFilter('ALL')}
              className={`px-3 py-1 rounded-lg transition ${
                categoryFilter === 'ALL'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setCategoryFilter('WINE')}
              className={`px-3 py-1 rounded-lg transition ${
                categoryFilter === 'WINE'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Wine Only
            </button>
            <button
              onClick={() => setCategoryFilter('SPIRITS')}
              className={`px-3 py-1 rounded-lg transition ${
                categoryFilter === 'SPIRITS'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Whiskey &amp; Spirits
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by producer, name, cru (e.g. Cannubi, Rocche, Cerretta), vintage, or BBQ pairing..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Bottles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBottles.map((bottle) => {
          const isOwned = bottle.collection_status === 'OWNED';
          const isWatchlist = bottle.collection_status === 'WATCHLIST';
          const isSpirits = bottle.category === 'whiskey' || bottle.category === 'spirit';

          return (
            <div
              key={bottle.id}
              className={`p-5 rounded-2xl border transition flex flex-col justify-between space-y-4 shadow-xl ${
                isOwned
                  ? 'bg-slate-900 border-slate-700/80 hover:border-slate-600'
                  : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Top Row: Producer, Category, Status Badge */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-rose-400">
                    {bottle.producer}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        isOwned
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : isWatchlist
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {bottle.collection_status === 'OWNED'
                        ? 'In Cellar'
                        : bottle.collection_status === 'WATCHLIST'
                        ? 'Watchlist'
                        : 'Depleted'}
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {bottle.format}
                    </span>
                  </div>
                </div>

                {/* Wine Name & Cru */}
                <div>
                  <h3 className="font-bold text-white text-base leading-snug">
                    {bottle.vintage ? `${bottle.vintage} ` : ''}
                    {bottle.name}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {bottle.region_or_cru || bottle.varietal_or_style} • {bottle.country}
                  </p>
                </div>

                {/* Storage Orientation Physics Badge */}
                <div
                  className={`p-2 rounded-xl text-[11px] flex items-center gap-2 ${
                    isSpirits
                      ? 'bg-amber-950/30 text-amber-300 border border-amber-800/40'
                      : 'bg-indigo-950/30 text-indigo-300 border border-indigo-800/40'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Storage: <strong>{bottle.storage_orientation}</strong>
                    {isSpirits
                      ? ' (Ethanol dissolves natural cork — store strictly upright)'
                      : ' (Maintains natural cork hydration at 13°C / 70% RH)'}
                  </span>
                </div>

                {/* Enological Parameters (Window, Decant, Temp) */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold block">Window</span>
                    <span className="font-bold text-white text-[11px]">
                      {bottle.drinking_window || 'Drink Now'}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold block">Decant</span>
                    <span className="font-bold text-slate-300 text-[11px] truncate block" title={bottle.decant_protocol}>
                      {bottle.decant_protocol || 'None'}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold block">Temp</span>
                    <span className="font-bold text-amber-400 text-[11px]">
                      {bottle.service_temp_c || '16–18°C'}
                    </span>
                  </div>
                </div>

                {/* BBQ & Meal Pairing Tags */}
                {bottle.bbq_pairing_tags && bottle.bbq_pairing_tags.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Flame className="w-3 h-3 text-amber-500" />
                      <span>Kamado Joe / Ninja Woodfire BBQ Pairings:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {bottle.bbq_pairing_tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fill Level % Gauge (for Spirits) */}
                {isSpirits && isOwned && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Spirit Fill Level</span>
                      <span className="font-bold text-amber-400">{bottle.fill_level_percent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-300"
                        style={{ width: `${bottle.fill_level_percent}%` }}
                      />
                    </div>
                    <div className="flex gap-1 pt-0.5">
                      {[100, 75, 50, 25, 0].map((pct) => (
                        <button
                          key={pct}
                          onClick={() => handleUpdateFillLevel(bottle, pct)}
                          className={`flex-1 py-1 rounded text-[10px] font-bold transition ${
                            bottle.fill_level_percent === pct
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Actions Row: Stock +/- & Verdict & Tasting Button */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  {/* Stock Controls */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">In Cellar:</span>
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                      <button
                        onClick={() => handleUpdateQuantity(bottle, -1)}
                        disabled={actionLoading || bottle.quantity <= 0}
                        className="px-2.5 py-1 text-slate-400 hover:text-white disabled:opacity-30 transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2.5 py-1 text-xs font-bold text-white min-w-[28px] text-center">
                        {bottle.quantity || 0}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(bottle, 1)}
                        disabled={actionLoading}
                        className="px-2.5 py-1 text-slate-400 hover:text-white transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {bottle.quantity === 0 && bottle.collection_status === 'DEPLETED' && (
                      <button
                        onClick={() => handleRestoreToWatchlist(bottle)}
                        className="text-[10px] text-sky-400 hover:underline"
                      >
                        To Watchlist
                      </button>
                    )}
                  </div>

                  {/* Pricing Display */}
                  {bottle.price_aud && (
                    <div className="text-right">
                      <div className="text-xs font-bold text-white">
                        ${bottle.price_aud.toFixed(2)} AUD
                      </div>
                      {bottle.any_6_price_aud && (
                        <div className="text-[10px] text-slate-500">
                          Any 6: ${bottle.any_6_price_aud.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Verdict & Log Tasting Row */}
                <div className="flex items-center justify-between gap-2">
                  {/* Verdict Pills */}
                  <div className="flex items-center gap-1">
                    {(['BUY_AGAIN', 'TRY_NEXT', 'AVOID'] as const).map((verdict) => {
                      const isSelected = bottle.buy_again_verdict === verdict;
                      return (
                        <button
                          key={verdict}
                          onClick={() => handleUpdateVerdict(bottle, verdict)}
                          disabled={actionLoading}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                            isSelected
                              ? verdict === 'BUY_AGAIN'
                                ? 'bg-emerald-500 text-slate-950'
                                : verdict === 'TRY_NEXT'
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-rose-500 text-white'
                              : 'bg-slate-950 text-slate-500 hover:text-slate-300 border border-slate-800'
                          }`}
                        >
                          {verdict === 'BUY_AGAIN'
                            ? 'Buy Again'
                            : verdict === 'TRY_NEXT'
                            ? 'Try Next'
                            : 'Avoid'}
                        </button>
                      );
                    })}
                  </div>

                  {/* Log Sommelier Tasting Button */}
                  <button
                    onClick={() => openTastingModal(bottle)}
                    className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-rose-300 flex items-center gap-1 transition"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>{bottle.rating_100 ? `${bottle.rating_100} pts` : 'Log Tasting'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredBottles.length === 0 && (
        <div className="p-12 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-2">
          <Wine className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-sm font-medium">No bottles found matching your search or filters.</p>
        </div>
      )}

      {/* Add Bottle Modal (Native <dialog closedby="any">) */}
      <dialog
        ref={addBottleDialogRef}
        closedby="any"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="w-full max-w-xl bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-rose-400" />
            <h3 className="font-bold text-white text-base">Add Bottle to Cellar or Watchlist</h3>
          </div>
          <button
            onClick={() => addBottleDialogRef.current?.close()}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleAddBottle} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Producer *
              </label>
              <input
                type="text"
                required
                value={newProducer}
                onChange={(e) => setNewProducer(e.target.value)}
                placeholder="e.g. Vietti, Paolo Scavino, GlenDronach"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Wine / Spirit Name *
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Barolo Castiglione, 18 Year Revival"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as 'wine' | 'whiskey' | 'spirit')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              >
                <option value="wine">Wine</option>
                <option value="whiskey">Whiskey</option>
                <option value="spirit">Spirit</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Vintage
              </label>
              <input
                type="text"
                value={newVintage}
                onChange={(e) => setNewVintage(e.target.value)}
                placeholder="2020 or NV"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Format
              </label>
              <select
                value={newFormat}
                onChange={(e) => setNewFormat(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              >
                <option value="750ml">750ml Standard</option>
                <option value="375ml Half">375ml Half Bottle</option>
                <option value="1500ml Mag">1500ml Magnum</option>
                <option value="700ml">700ml Spirit</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Region / Cru
              </label>
              <input
                type="text"
                value={newCru}
                onChange={(e) => setNewCru(e.target.value)}
                placeholder="e.g. Castiglione Falletto, Barolo DOCG"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Varietal / Mashbill
              </label>
              <input
                type="text"
                value={newVarietal}
                onChange={(e) => setNewVarietal(e.target.value)}
                placeholder="e.g. Nebbiolo, Single Malt Scotch"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as 'OWNED' | 'WATCHLIST')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              >
                <option value="OWNED">In Cellar (Owned)</option>
                <option value="WATCHLIST">Watchlist</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Price (AUD)
              </label>
              <input
                type="number"
                step="0.1"
                value={newPrice}
                onChange={(e) => setNewPrice(parseFloat(e.target.value) || '')}
                placeholder="85.00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Drinking Window
              </label>
              <input
                type="text"
                value={newWindow}
                onChange={(e) => setNewWindow(e.target.value)}
                placeholder="2026 – 2038"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Decant Protocol
              </label>
              <input
                type="text"
                value={newDecant}
                onChange={(e) => setNewDecant(e.target.value)}
                placeholder="2 hours splash"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Service Temp
              </label>
              <input
                type="text"
                value={newTemp}
                onChange={(e) => setNewTemp(e.target.value)}
                placeholder="16–18°C"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Kamado Joe / Ninja BBQ Pairing Tags (comma separated)
            </label>
            <input
              type="text"
              value={newBbqTags}
              onChange={(e) => setNewBbqTags(e.target.value)}
              placeholder="Kamado Joe Reverse-Seared Ribeye, Texas Pepper Brisket"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => addBottleDialogRef.current?.close()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-white shadow-lg shadow-rose-600/20"
            >
              Add Bottle
            </button>
          </div>
        </form>
      </dialog>

      {/* Sommelier SAT & BLIC Tasting Modal (Native <dialog closedby="any">) */}
      <dialog
        ref={tastingDialogRef}
        closedby="any"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="w-full max-w-xl bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="font-bold text-white text-base">
                Sommelier SAT &amp; BLIC Tasting Note
              </h3>
              <p className="text-xs text-slate-400">
                {selectedBottleForTasting?.producer} {selectedBottleForTasting?.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => tastingDialogRef.current?.close()}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveTasting} className="space-y-4 text-xs">
          {/* Reviewer Attribution & 100-Point Score */}
          <div className="grid grid-cols-2 gap-3 items-center p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Tasted By
              </label>
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setTastingReviewer('Brandon')}
                  className={`flex-1 py-1 rounded text-xs font-bold transition ${
                    tastingReviewer === 'Brandon'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Brandon
                </button>
                <button
                  type="button"
                  onClick={() => setTastingReviewer('Meg')}
                  className={`flex-1 py-1 rounded text-xs font-bold transition ${
                    tastingReviewer === 'Meg'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Meg
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-semibold text-slate-400">100-Point Rating</label>
                <strong className="text-rose-400 text-sm">{tastingScore100} pts</strong>
              </div>
              <input
                type="range"
                min="70"
                max="100"
                step="1"
                value={tastingScore100}
                onChange={(e) => setTastingScore100(parseInt(e.target.value) || 92)}
                className="w-full accent-rose-500"
              />
            </div>
          </div>

          {/* BLIC Quality Assessment (1–4) */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                BLIC Quality Assessment (1–4)
              </h4>
              <span className="text-[10px] text-amber-400 font-semibold">
                BLIC Score: {blicBalance + blicLength + blicIntensity + blicComplexity} / 16 (
                {blicBalance + blicLength + blicIntensity + blicComplexity >= 15
                  ? 'Outstanding'
                  : blicBalance + blicLength + blicIntensity + blicComplexity >= 12
                  ? 'Good'
                  : 'Acceptable'}
                )
              </span>
            </div>

            {/* Balance */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Balance (Acid, Tannin, Fruit, Alcohol):</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBlicBalance(n)}
                    className={`w-7 h-7 rounded text-xs font-bold transition ${
                      blicBalance === n
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Length */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Length (Resonant Finish Duration):</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBlicLength(n)}
                    className={`w-7 h-7 rounded text-xs font-bold transition ${
                      blicLength === n
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Intensity (Aromatic Focus &amp; Clarity):</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBlicIntensity(n)}
                    className={`w-7 h-7 rounded text-xs font-bold transition ${
                      blicIntensity === n
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Complexity */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Complexity (Primary / Secondary / Tertiary Tiers):</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBlicComplexity(n)}
                    className={`w-7 h-7 rounded text-xs font-bold transition ${
                      blicComplexity === n
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Systematic Approach to Tasting (Nose, Palate, Finish) */}
          <div className="space-y-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">
                Nose / Aroma (Primary Fruit, Oak, Tertiary Tar &amp; Truffle)
              </label>
              <input
                type="text"
                value={noseNotes}
                onChange={(e) => setNoseNotes(e.target.value)}
                placeholder="e.g. Red cherry, dried rose petals, crushed tar, white truffle..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">
                Palate (Tannin Texture, Acidity, Weight)
              </label>
              <input
                type="text"
                value={palateNotes}
                onChange={(e) => setPalateNotes(e.target.value)}
                placeholder="e.g. Vibrant Nebbiolo acidity, firm chalky tannins, dried orange peel..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-0.5">
                Finish Notes
              </label>
              <input
                type="text"
                value={finishNotes}
                onChange={(e) => setFinishNotes(e.target.value)}
                placeholder="e.g. Persistent 35s mineral finish with cleansing acidity..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Paired Meal with Quick Suggestions */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Paired Meal
            </label>
            <input
              type="text"
              value={pairedMeal}
              onChange={(e) => setPairedMeal(e.target.value)}
              placeholder="e.g. Kamado Joe Reverse-Seared Ribeye with truffle butter"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-rose-500 focus:outline-none mb-1.5"
            />
            {selectedBottleForTasting?.bbq_pairing_tags && (
              <div className="flex flex-wrap gap-1">
                {selectedBottleForTasting.bbq_pairing_tags.map((tag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPairedMeal(tag)}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-rose-300 border border-slate-800 transition"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => tastingDialogRef.current?.close()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-white shadow-lg shadow-rose-600/20"
            >
              Save Tasting Note
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
};
