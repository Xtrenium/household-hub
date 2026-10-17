export type HouseholdProfile = 'Brandon' | 'Meg';
export type PillarTab = 'meals' | 'espresso' | 'cellar';
export type DayCode = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export const ALL_DAYS: DayCode[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface MacroBreakdown {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  package_size_g: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  expected_brand?: string;
  min_grade?: string;
  queries: string[];
  required: string[];
  excluded: string[];
  preferred: string[];
  is_pantry_staple: boolean;
}

export interface RecipeIngredient {
  name: string;
  product_id?: string;
  shop_packs?: number;
  package_note?: string;
  quantity: string;
  macros_per_serving?: MacroBreakdown;
  macros_batch?: MacroBreakdown;
}

export interface Recipe {
  id: string;
  title: string;
  category: string;
  rotation_group: string;
  active: boolean;
  servings: number;
  prep_time_mins: number;
  cook_time_mins: number;
  equipment_used: string[];
  macros_per_serving: MacroBreakdown;
  ingredients: RecipeIngredient[];
  instructions: string[];
  notes?: string;
}

export interface MealPlanBlock {
  id: string;
  recipe_id: string;
  meal_slot: 'Breakfast' | 'Lunch' | 'Dinner' | 'Kid Dinner' | 'Wolf Lunchbox' | string;
  target_group: 'Both Adults' | 'Brandon' | 'Meg' | 'Both Kids' | 'Wolf' | string;
  diners_per_day: number;
  assigned_days: DayCode[];
  cook_session: string;
  checked_steps: number[];
  sort_order: number;
  active: boolean;
}

export interface WaterEngineState {
  filter_model: string;
  bypass_setting: number;
  rated_capacity_liters: number;
  installed_date: string;
  expiry_date: string;
  jug_volume_liters: number;
  total_jugs_swapped: number;
  total_consumed_liters: number;
  total_remaining_liters: number;
  flojet_sanitization: {
    interval_days: number;
    last_sanitized_date: string;
    protocol: string;
  };
}

export interface MaintenanceEngineState {
  chemical_backflush: {
    target_shots: number;
    warning_shots: number;
    shots_since_last_clean: number;
    last_cleaned_date: string;
    detergent: string;
    status?: string;
  };
  water_backflush: { interval_days: number; last_performed_date: string };
  e61_cam_grease: { interval_days: number; last_performed_date: string; lubricant?: string };
  steam_boiler_flush: { interval_days: number; last_performed_date: string };
  shower_screen_gasket: { interval_days: number; last_performed_date: string; cleaner?: string };
  steam_wand_soak: { interval_days: number; last_performed_date: string; cleaner?: string };
  df54_burr_clean: { interval_days: number; last_performed_date: string; notes?: string };
}

export interface CoffeeMachineState {
  id: string;
  system_meta: {
    machine_commission_date: string;
    machine_model: string;
    grinder_model: string;
    water_system: string;
  };
  water_engine: WaterEngineState;
  maintenance_engine: MaintenanceEngineState;
  user_preference_profile: Record<string, unknown>;
  audit_log: Array<{
    id: string;
    timestamp: string;
    category: string;
    action: string;
    details: Record<string, unknown>;
  }>;
  updated_at?: string;
}

export interface SensoryRadar {
  acidity: number;
  sweetness: number;
  body: number;
  clarity: number;
  balance: number;
}

export interface CoffeeBag {
  id: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'WISHLIST' | 'CATALOG';
  roaster: string;
  city?: string;
  name: string;
  roast_level: string;
  process: string;
  origins: string[];
  flavor_notes: string[];
  roast_date?: string | null;
  open_date?: string | null;
  initial_weight_g: number;
  remaining_weight_g: number;
  recommended_ratio: number;
  current_grind_setting: number;
  current_dose_g: number;
  current_yield_g: number;
  current_time_s: number;
  roaster_dial_notes?: string;
  price_aud?: number;
  typical_radar: SensoryRadar;
  drink_suitability: string;
  rating_overall?: number | null;
  rating_black?: number | null;
  rating_milk?: number | null;
  user_tags: string[];
  user_notes?: string | null;
}

export interface CoffeeShot {
  id: string;
  bag_id?: string | null;
  bean_name: string;
  roaster?: string;
  log_mode: 'QUICK' | 'DETAIL';
  logged_by: HouseholdProfile;
  shots_pulled: number;
  grind_setting: number;
  dose_g: number;
  yield_g: number;
  time_s: number;
  brew_ratio: number;
  flow_rate_gps: number;
  drink_type: string;
  flow_profile: string;
  acidity?: number | null;
  sweetness?: number | null;
  body?: number | null;
  clarity?: number | null;
  balance?: number | null;
  straight_score?: number | null;
  milk_score?: number | null;
  straight_tier?: string | null;
  milk_tier?: string | null;
  troubleshooting?: {
    is_sweet_spot?: boolean;
    summary?: string;
    issues?: string[];
    prescriptions?: string[];
  };
  notes?: string;
  created_at: string;
}

export interface BlicScores {
  balance: number;    // 0-4
  length: number;     // 0-4
  intensity: number;  // 0-4
  complexity: number; // 0-4
}

export interface CellarBottle {
  id: string;
  category: 'wine' | 'whiskey' | 'spirit';
  collection_status: 'OWNED' | 'WATCHLIST' | 'DEPLETED';
  producer: string;
  name: string;
  vintage?: string;
  region_or_cru?: string;
  country: string;
  varietal_or_style: string;
  format: string;
  abv?: number;
  quantity: number;
  fill_level_percent: number;
  price_aud?: number | null;
  any_6_price_aud?: number | null;
  case_price_aud?: number | null;
  stock_notes?: string;
  direct_url?: string;
  storage_orientation: string;
  drinking_window?: string;
  decant_protocol?: string;
  service_temp_c?: string;
  glassware?: string;
  bbq_pairing_tags: string[];
  rating_100?: number | null;
  blic_scores: BlicScores;
  buy_again_verdict?: 'BUY_AGAIN' | 'TRY_NEXT' | 'AVOID';
  tasting_notes?: string;
}

export interface CellarTasting {
  id: string;
  bottle_id: string;
  logged_by: HouseholdProfile;
  tasted_at: string;
  score_100: number;
  blic: BlicScores;
  nose_notes?: string;
  palate_notes?: string;
  finish_notes?: string;
  paired_meal?: string;
}
