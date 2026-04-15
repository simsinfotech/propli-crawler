export interface Property {
  id: string;
  name: string;
  name_lower: string;
  builder_name: string | null;
  locality: string | null;
  city: string | null;
  price_min: number | null;
  price_max: number | null;
  price_display: string | null;
  property_type: string | null;
  bedrooms: string | null;
  area_min: number | null;
  area_max: number | null;
  area_unit: string | null;
  rera_id: string | null;
  rera_status: string | null;
  status: string | null;
  possession_date: string | null;
  amenities: string[] | null;
  raw_data: Record<string, unknown> | null;
  source_url: string | null;
  latitude: number | null;
  longitude: number | null;
  images_scraped: ScrapedImage[] | null;
  ai_project_research: ProjectResearch | null;
  location_intelligence: Record<string, PlaceResult[]> | null;
  location_score: number | null;
  commute_data: Record<string, CommuteResult> | null;
  nearby_schools: PlaceResult[] | null;
  nearby_hospitals: PlaceResult[] | null;
  nearby_metro: PlaceResult[] | null;
  nearby_entertainment: Record<string, PlaceResult[]> | null;
  ai_buying_analysis: BuyingAnalysis | null;
  builder_grade: string | null;
  intelligence_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScrapedImage {
  url: string;
  original_url: string;
  type: string;
  description: string;
}

export interface PlaceResult {
  name: string;
  rating: number | null;
  total_reviews?: number;
  distance_km: number;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface CommuteResult {
  distance_km: number;
  drive_time_min: number;
  traffic_time_min: number;
}

export interface LocationSummary {
  overall: number;
  breakdown?: {
    connectivity: { score: number; note: string };
    amenities: { score: number; note: string };
    infrastructure: { score: number; note: string };
    value: { score: number; note: string };
  };
}

export interface ProjectResearch {
  builder_reputation?: string;
  delivery_track_record?: string;
  known_issues?: string | null;
  construction_status?: string;
  buyer_sentiment?: string;
  // Fallback: array of Google search results when Claude analysis fails
  [key: string]: unknown;
}

export interface BuyingAnalysis {
  overall_rating?: string;
  score_breakdown?: Record<string, { score: number; note: string }>;
  why_buy?: string[];
  watch_out?: string[];
  best_for?: string;
  not_suitable_for?: string[];
  price_verdict?: string;
  appreciation_outlook?: string;
  rental_yield_estimate?: string;
  invest_or_live?: string;
  commute_summary?: {
    best_for_commute_to?: string;
    worst_commute?: string;
    airport?: string;
    city_center?: string;
    peak_traffic_note?: string;
  };
  recommendation?: string;
  one_liner?: string;
  buyer_scorecard?: {
    investment?: { score: number; reason: string };
    self_use?: { score: number; reason: string };
    value_for_money?: { score: number; reason: string };
    appreciation?: { score: number; reason: string };
    growth_factor?: { score: number; reason: string };
  };
}

export interface CrawledProperty {
  id: string;
  crawl_run_id: string;
  source_url: string | null;
  source_label: string | null;
  name: string;
  builder_name: string | null;
  locality: string | null;
  city: string | null;
  price_min: number | null;
  price_max: number | null;
  price_display: string | null;
  property_type: string | null;
  bedrooms: string | null;
  area_min: number | null;
  area_max: number | null;
  area_unit: string | null;
  rera_id: string | null;
  rera_status: string | null;
  status: string | null;
  possession_date: string | null;
  amenities: string[] | null;
  raw_extracted: Record<string, unknown> | null;
  match_status: "pending" | "new" | "matched" | "updated" | "rejected";
  matched_property_id: string | null;
  changes_detected: Record<string, { old: unknown; new: unknown }> | null;
  reviewed: boolean;
  created_at: string;
}

export interface ScrapeLog {
  id: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  total_sources: number | null;
  successful_sources: number | null;
  failed_sources: number | null;
  total_properties_found: number | null;
  new_properties: number | null;
  updated_properties: number | null;
  matched_properties: number | null;
  source_details: SourceDetail[] | null;
  notifications_sent: Record<string, boolean> | null;
  error: string | null;
  created_at: string;
}

export interface SourceDetail {
  url: string;
  label: string;
  status: "success" | "failed";
  properties_found: number;
  error?: string;
  duration_ms: number;
}
