import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ExtractedProperty, SourceDetail } from "./types.ts";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }

  _client = createClient(url, key);
  return _client;
}

export async function insertCrawledProperties(
  properties: ExtractedProperty[],
  crawlRunId: string,
  sourceUrl: string,
  sourceLabel: string,
  matchStatus: string,
  matchedPropertyId?: string,
  changesDetected?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseClient();

  const rows = properties.map((p) => ({
    crawl_run_id: crawlRunId,
    source_url: sourceUrl,
    source_label: sourceLabel,
    name: p.name,
    builder_name: p.builder_name || null,
    locality: p.locality || null,
    city: p.city || "Bangalore",
    price_min: p.price_min || null,
    price_max: p.price_max || null,
    price_display: p.price_display || null,
    property_type: p.property_type || null,
    bedrooms: p.bedrooms || null,
    area_min: p.area_min || null,
    area_max: p.area_max || null,
    area_unit: p.area_unit || "sqft",
    rera_id: p.rera_id || null,
    rera_status: p.rera_status || null,
    status: p.status || null,
    possession_date: p.possession_date || null,
    amenities: p.amenities || null,
    detail_url: p.detail_url || null,
    raw_extracted: p as unknown as Record<string, unknown>,
    match_status: matchStatus,
    matched_property_id: matchedPropertyId || null,
    changes_detected: changesDetected || null,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("crawled_properties").insert(rows);

  if (error) {
    console.error("Error inserting crawled properties:", error);
    throw error;
  }
}

export async function promoteNewProperties(
  properties: ExtractedProperty[]
): Promise<void> {
  if (properties.length === 0) return;
  const supabase = getSupabaseClient();

  const rows = properties.map((p) => ({
    name: p.name,
    builder_name: p.builder_name || null,
    locality: p.locality || null,
    city: p.city || "Bangalore",
    price_min: p.price_min || null,
    price_max: p.price_max || null,
    price_display: p.price_display || null,
    property_type: p.property_type || null,
    bedrooms: p.bedrooms || null,
    area_min: p.area_min || null,
    area_max: p.area_max || null,
    area_unit: p.area_unit || "sqft",
    rera_id: p.rera_id || null,
    rera_status: p.rera_status || null,
    status: p.status || null,
    possession_date: p.possession_date || null,
    amenities: p.amenities || null,
    detail_url: p.detail_url || null,
    raw_data: p as unknown as Record<string, unknown>,
  }));

  // Insert one by one to handle COALESCE-based unique index
  let promoted = 0;
  for (const row of rows) {
    const { error } = await supabase
      .from("properties")
      .insert(row);

    if (error) {
      if (error.code === "23505") {
        // Duplicate — already exists, skip
        console.log(`  Skipped duplicate: ${row.name}`);
      } else {
        console.error(`Error inserting property ${row.name}:`, error);
      }
    } else {
      promoted++;
    }
  }

  console.log(`Promoted ${promoted} new properties to master table (${rows.length - promoted} duplicates skipped)`);
}

export async function updateExistingProperties(
  updates: { matched_id: string; property: ExtractedProperty; changes: Record<string, { old: unknown; new: unknown }> }[]
): Promise<void> {
  if (updates.length === 0) return;
  const supabase = getSupabaseClient();

  for (const update of updates) {
    const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const [field, change] of Object.entries(update.changes)) {
      fields[field] = change.new;
    }

    // Also update price_display if price changed
    if (update.property.price_display && (fields.price_min || fields.price_max)) {
      fields.price_display = update.property.price_display;
    }

    const { error } = await supabase
      .from("properties")
      .update(fields)
      .eq("id", update.matched_id);

    if (error) {
      console.error(`Error updating property ${update.matched_id}:`, error);
    }
  }

  console.log(`Updated ${updates.length} existing properties in master table`);
}

export async function saveCrawlLog(log: {
  id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  total_sources: number;
  successful_sources: number;
  failed_sources: number;
  total_properties_found: number;
  new_properties: number;
  updated_properties: number;
  matched_properties: number;
  source_details: SourceDetail[];
  notifications_sent: Record<string, boolean>;
  error?: string;
}): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from("scrape_logs").insert({
    id: log.id,
    started_at: log.started_at,
    finished_at: log.finished_at,
    duration_ms: log.duration_ms,
    total_sources: log.total_sources,
    successful_sources: log.successful_sources,
    failed_sources: log.failed_sources,
    total_properties_found: log.total_properties_found,
    new_properties: log.new_properties,
    updated_properties: log.updated_properties,
    matched_properties: log.matched_properties,
    source_details: log.source_details,
    notifications_sent: log.notifications_sent,
    error: log.error || null,
  });

  if (error) {
    console.error("Error saving crawl log:", error);
    throw error;
  }
}
