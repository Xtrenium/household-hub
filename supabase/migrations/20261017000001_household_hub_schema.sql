-- ============================================================================
-- HOUSEHOLD HUB (BRANDON & MEG) — MASTER SUPABASE SCHEMA & RLS MIGRATION
-- Region: ap-southeast-2 (Sydney) | Project Ref: anqaecdyipycajapmiev
-- Pillars:
--   1. Meals & Prep (MacroFactor-verified recipes, Coles products, Multi-day batch blocks)
--   2. Espresso Bar (Profitec Drive E61 + DF54 + Flojet/BWT 2,700L + Australian Roasters)
--   3. Cellar & Vault (Wine Cellar, Whiskey/Spirits Vault & Barolo Watchlist)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. PRODUCTS (Coles-Grounded Ingredient & Macro Database)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Uncategorized',
  package_size_g numeric NOT NULL DEFAULT 100.0,
  calories_per_100g numeric NOT NULL DEFAULT 0.0,
  protein_per_100g numeric NOT NULL DEFAULT 0.0,
  carbs_per_100g numeric NOT NULL DEFAULT 0.0,
  fat_per_100g numeric NOT NULL DEFAULT 0.0,
  expected_brand text,
  min_grade text,
  queries jsonb NOT NULL DEFAULT '[]'::jsonb,
  required jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_pantry_staple boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. RECIPES (MacroFactor-Verified Family Recipe Vault)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipes (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  rotation_group text NOT NULL DEFAULT 'Rotation A (Classic)',
  active boolean NOT NULL DEFAULT true,
  servings integer NOT NULL DEFAULT 10,
  prep_time_mins integer NOT NULL DEFAULT 15,
  cook_time_mins integer NOT NULL DEFAULT 20,
  equipment_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  macros_per_serving jsonb NOT NULL DEFAULT '{"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0}'::jsonb,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  instructions jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. MEAL_PLAN_BLOCKS (Multi-Day / Slot Batch Assigner & Live Step Checkoffs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meal_plan_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id text NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  meal_slot text NOT NULL DEFAULT 'Dinner', -- 'Breakfast', 'Lunch', 'Dinner', 'Kid Dinner', 'Wolf Lunchbox'
  target_group text NOT NULL DEFAULT 'Both Adults', -- 'Both Adults', 'Brandon', 'Meg', 'Both Kids', 'Wolf'
  diners_per_day integer NOT NULL DEFAULT 2,
  assigned_days jsonb NOT NULL DEFAULT '["Mon","Tue","Wed","Thu","Fri"]'::jsonb,
  cook_session text NOT NULL DEFAULT 'Sunday Prep', -- 'Sunday Prep', 'Monday Night', 'Wednesday Night', 'Custom'
  checked_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. COFFEE_MACHINE_STATE (Profitec Drive + DF54 + Flojet/BWT Bestmax Premium)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coffee_machine_state (
  id text PRIMARY KEY DEFAULT 'profitec_drive_primary',
  system_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  water_engine jsonb NOT NULL DEFAULT '{}'::jsonb,
  maintenance_engine jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_preference_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. COFFEE_BAGS (Active Hopper Bag, Past Bags & Australian Roaster Catalog)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coffee_bags (
  id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'CATALOG', -- 'ACTIVE', 'ARCHIVED', 'WISHLIST', 'CATALOG'
  roaster text NOT NULL,
  city text,
  name text NOT NULL,
  roast_level text NOT NULL DEFAULT 'Medium-Light',
  process text NOT NULL DEFAULT 'Washed',
  origins jsonb NOT NULL DEFAULT '[]'::jsonb,
  flavor_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  roast_date text,
  open_date text,
  initial_weight_g numeric NOT NULL DEFAULT 250.0,
  remaining_weight_g numeric NOT NULL DEFAULT 250.0,
  recommended_ratio numeric NOT NULL DEFAULT 2.0,
  current_grind_setting numeric NOT NULL DEFAULT 14.5,
  current_dose_g numeric NOT NULL DEFAULT 18.0,
  current_yield_g numeric NOT NULL DEFAULT 38.0,
  current_time_s numeric NOT NULL DEFAULT 28.0,
  roaster_dial_notes text,
  price_aud numeric,
  typical_radar jsonb NOT NULL DEFAULT '{"acidity":3.8,"sweetness":4.3,"body":4.0,"clarity":4.0,"balance":4.4}'::jsonb,
  drink_suitability text NOT NULL DEFAULT 'All-Rounder',
  rating_overall numeric,
  rating_black numeric,
  rating_milk numeric,
  user_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  user_notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 6. COFFEE_SHOTS (Dual-Mode: 1-Tap Quick Logs & Detail Sensory Dial-In Logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coffee_shots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bag_id text REFERENCES public.coffee_bags(id) ON DELETE SET NULL,
  bean_name text NOT NULL,
  roaster text,
  log_mode text NOT NULL DEFAULT 'QUICK', -- 'QUICK' or 'DETAIL'
  logged_by text NOT NULL DEFAULT 'Brandon', -- 'Brandon' or 'Meg'
  shots_pulled integer NOT NULL DEFAULT 1,
  grind_setting numeric NOT NULL DEFAULT 14.5,
  dose_g numeric NOT NULL DEFAULT 18.0,
  yield_g numeric NOT NULL DEFAULT 38.0,
  time_s numeric NOT NULL DEFAULT 28.0,
  brew_ratio numeric,
  flow_rate_gps numeric,
  drink_type text NOT NULL DEFAULT 'espresso',
  flow_profile text NOT NULL DEFAULT 'standard_9bar',
  acidity numeric,
  sweetness numeric,
  body numeric,
  clarity numeric,
  balance numeric,
  straight_score numeric,
  milk_score numeric,
  straight_tier text,
  milk_tier text,
  troubleshooting jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 7. CELLAR_BOTTLES (Wine Cellar, Whiskey/Spirits Vault & Barolo Watchlist)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cellar_bottles (
  id text PRIMARY KEY,
  category text NOT NULL DEFAULT 'wine', -- 'wine', 'whiskey', 'spirit'
  collection_status text NOT NULL DEFAULT 'WATCHLIST', -- 'OWNED', 'WATCHLIST', 'DEPLETED'
  producer text NOT NULL,
  name text NOT NULL,
  vintage text,
  region_or_cru text,
  country text NOT NULL DEFAULT 'Italy',
  varietal_or_style text NOT NULL DEFAULT 'Nebbiolo (Barolo DOCG)',
  format text NOT NULL DEFAULT '750ml',
  abv numeric DEFAULT 14.5,
  quantity integer NOT NULL DEFAULT 0,
  fill_level_percent integer NOT NULL DEFAULT 100,
  price_aud numeric,
  any_6_price_aud numeric,
  case_price_aud numeric,
  stock_notes text,
  direct_url text,
  storage_orientation text NOT NULL DEFAULT 'Horizontal (Natural Cork)',
  drinking_window text,
  decant_protocol text,
  service_temp_c text,
  glassware text DEFAULT 'Burgundy / Nebbiolo Balloon',
  bbq_pairing_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  rating_100 integer,
  blic_scores jsonb NOT NULL DEFAULT '{"balance":4,"length":4,"intensity":4,"complexity":4}'::jsonb,
  buy_again_verdict text DEFAULT 'TRY_NEXT', -- 'BUY_AGAIN', 'TRY_NEXT', 'AVOID'
  tasting_notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. CELLAR_TASTINGS (Sommelier SAT & BLIC Tasting Logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cellar_tastings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bottle_id text NOT NULL REFERENCES public.cellar_bottles(id) ON DELETE CASCADE,
  logged_by text NOT NULL DEFAULT 'Brandon',
  tasted_at timestamptz NOT NULL DEFAULT now(),
  score_100 integer NOT NULL DEFAULT 92,
  blic jsonb NOT NULL DEFAULT '{"balance":4,"length":4,"intensity":4,"complexity":4}'::jsonb,
  nose_notes text,
  palate_notes text,
  finish_notes text,
  paired_meal text
);

-- ============================================================================
-- STRICT ROW LEVEL SECURITY (AUTHENTICATED HOUSEHOLD USERS ONLY)
-- ============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_machine_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_bags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coffee_shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cellar_bottles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cellar_tastings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'products',
    'recipes',
    'meal_plan_blocks',
    'coffee_machine_state',
    'coffee_bags',
    'coffee_shots',
    'cellar_bottles',
    'cellar_tastings'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS household_auth_all ON public.%I;', tbl);
    EXECUTE format(
      'CREATE POLICY household_auth_all ON public.%I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);',
      tbl
    );
  END LOOP;
END $$;
