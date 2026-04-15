export interface CrawlSource {
  url: string;
  label: string;
  category: "portal" | "builder";
}

export interface ExtractedProperty {
  name: string;
  builder_name?: string;
  locality?: string;
  city?: string;
  price_min?: number;
  price_max?: number;
  price_display?: string;
  property_type?: string;
  bedrooms?: string;
  area_min?: number;
  area_max?: number;
  area_unit?: string;
  rera_id?: string;
  rera_status?: string;
  status?: string;
  possession_date?: string;
  amenities?: string[];
  detail_url?: string;
}

export interface PropertyRecord extends ExtractedProperty {
  id: string;
  name_lower: string;
  source_url?: string;
  raw_data?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CrawlResult {
  source: CrawlSource;
  properties: ExtractedProperty[];
  error?: string;
  duration_ms: number;
}

export interface ComparisonResult {
  new_properties: ExtractedProperty[];
  updated_properties: {
    property: ExtractedProperty;
    matched_id: string;
    changes: Record<string, { old: unknown; new: unknown }>;
  }[];
  matched_properties: ExtractedProperty[];
}

export interface CrawlReport {
  run_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  total_sources: number;
  successful_sources: number;
  failed_sources: number;
  total_properties_found: number;
  new_properties: ExtractedProperty[];
  updated_properties: {
    property: ExtractedProperty;
    changes: Record<string, { old: unknown; new: unknown }>;
  }[];
  matched_count: number;
  source_details: SourceDetail[];
}

export interface SourceDetail {
  url: string;
  label: string;
  status: "success" | "failed";
  properties_found: number;
  error?: string;
  duration_ms: number;
}
