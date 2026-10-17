import React, { useEffect, useState } from 'react';
import {
  Coffee,
  Flame,
  LogOut,
  ShieldCheck,
  User,
  Utensils,
  Wine,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { CellarPillar } from './components/CellarPillar';
import { EspressoPillar } from './components/EspressoPillar';
import { MealsPillar } from './components/MealsPillar';
import { supabase } from './lib/supabase';
import {
  HouseholdProfile,
  MealPlanBlock,
  PillarTab,
  Product,
  Recipe,
} from './types/household';

export const App: React.FC = () => {
  const [session, setSession] = useState<unknown | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Household Profile Switcher: Brandon vs Meg (persisted per device in localStorage)
  const [profile, setProfile] = useState<HouseholdProfile>(() => {
    const saved = localStorage.getItem('household_hub_profile');
    return saved === 'Meg' ? 'Meg' : 'Brandon';
  });

  // Active Pillar Tab
  const [activeTab, setActiveTab] = useState<PillarTab>('meals');

  // Meals Data State
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [blocks, setBlocks] = useState<MealPlanBlock[]>([]);
  const [loadingMealsData, setLoadingMealsData] = useState(false);

  // 1. Manage Supabase Authentication
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch Meals & Prep Data whenever authenticated
  useEffect(() => {
    if (!session) return;

    const fetchMealsData = async () => {
      try {
        setLoadingMealsData(true);
        const [recipesRes, productsRes, blocksRes] = await Promise.all([
          supabase.from('recipes').select('*').order('title'),
          supabase.from('products').select('*').order('name'),
          supabase.from('meal_plan_blocks').select('*').order('sort_order'),
        ]);

        if (recipesRes.data) setRecipes(recipesRes.data as Recipe[]);
        if (productsRes.data) setProducts(productsRes.data as Product[]);
        if (blocksRes.data) setBlocks(blocksRes.data as MealPlanBlock[]);
      } catch (err) {
        console.error('Error fetching meals data:', err);
      } finally {
        setLoadingMealsData(false);
      }
    };

    fetchMealsData();
  }, [session]);

  // Handle Profile Switch
  const toggleProfile = () => {
    const nextProfile: HouseholdProfile = profile === 'Brandon' ? 'Meg' : 'Brandon';
    setProfile(nextProfile);
    localStorage.setItem('household_hub_profile', nextProfile);
  };

  // Sign Out Handler
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // MealsPillar Callbacks
  const handleAddBlock = async (newBlock: Omit<MealPlanBlock, 'id'>) => {
    const { data, error } = await supabase
      .from('meal_plan_blocks')
      .insert([newBlock])
      .select()
      .single();
    if (error) {
      console.error('Error adding meal block:', error);
      throw error;
    }
    if (data) {
      setBlocks((prev) => [...prev, data as MealPlanBlock]);
    }
  };

  const handleUpdateBlock = async (id: string, updates: Partial<MealPlanBlock>) => {
    const { error } = await supabase
      .from('meal_plan_blocks')
      .update(updates)
      .eq('id', id);
    if (error) {
      console.error('Error updating meal block:', error);
      throw error;
    }
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b))
    );
  };

  const handleDeleteBlock = async (id: string) => {
    const { error } = await supabase
      .from('meal_plan_blocks')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error deleting meal block:', error);
      throw error;
    }
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
            Loading Household Hub...
          </p>
        </div>
      </div>
    );
  }

  // If unauthenticated, show AuthGate
  if (!session) {
    return <AuthGate />;
  }

  // Profile target descriptions
  const isBrandon = profile === 'Brandon';
  const targetKcal = isBrandon ? '1,500' : '1,400';
  const targetProtein = isBrandon ? '160g' : '142g';
  const supplementNote = isBrandon ? '+100 kcal / 18g P YoPRO Yoghurt' : '3 Core Meals';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-slate-950">
      {/* Sticky Top App Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand & Sydney Badge */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-md shadow-amber-500/10 shrink-0">
              H
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-sm sm:text-base tracking-tight">
                  Household Hub
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-1.5 py-0.2 rounded-full">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Sydney
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Brandon &amp; Meg • Meals, Espresso &amp; Cellar
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('meals')}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'meals'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Meals &amp; Prep</span>
            </button>
            <button
              onClick={() => setActiveTab('espresso')}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'espresso'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Espresso Bar</span>
            </button>
            <button
              onClick={() => setActiveTab('cellar')}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'cellar'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wine className="w-3.5 h-3.5" />
              <span>Cellar &amp; Vault</span>
            </button>
          </nav>

          {/* Right Header: Profile Switcher & Sign Out */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 1-Tap Brandon/Meg Profile Switcher Button */}
            <button
              onClick={toggleProfile}
              title={`Active Profile: ${profile}. Tap to switch to ${isBrandon ? 'Meg' : 'Brandon'}.`}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition shadow-sm ${
                isBrandon
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <div className="text-left">
                <div className="text-xs font-bold leading-none flex items-center gap-1">
                  <span>{profile}</span>
                  <span className="text-[10px] opacity-70">({targetKcal} kcal)</span>
                </div>
                <div className="text-[9px] text-slate-400 hidden xs:block">
                  {targetProtein} P • {supplementNote}
                </div>
              </div>
            </button>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 pb-28 md:pb-8">
        {activeTab === 'meals' && (
          <>
            {loadingMealsData && blocks.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <Utensils className="w-8 h-8 animate-spin mx-auto text-amber-500" />
                <p className="text-sm font-medium">Loading weekly meal plan &amp; recipes...</p>
              </div>
            ) : (
              <MealsPillar
                profile={profile}
                recipes={recipes}
                products={products}
                blocks={blocks}
                onAddBlock={handleAddBlock}
                onUpdateBlock={handleUpdateBlock}
                onDeleteBlock={handleDeleteBlock}
              />
            )}
          </>
        )}

        {activeTab === 'espresso' && <EspressoPillar profile={profile} />}

        {activeTab === 'cellar' && <CellarPillar profile={profile} />}
      </main>

      {/* Mobile Ergonomic Bottom Navigation Bar (Fixed) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/90 md:hidden flex justify-around items-center px-2 py-2">
        <button
          onClick={() => setActiveTab('meals')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === 'meals'
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px]">Meals</span>
        </button>

        <button
          onClick={() => setActiveTab('espresso')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === 'espresso'
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Coffee className="w-5 h-5" />
          <span className="text-[10px]">Espresso</span>
        </button>

        <button
          onClick={() => setActiveTab('cellar')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === 'cellar'
              ? 'text-rose-400 font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wine className="w-5 h-5" />
          <span className="text-[10px]">Cellar</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
