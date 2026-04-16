import { supabase } from "./supabase";
import type { Property, CrawledProperty, ScrapeLog } from "./types";

// --- Properties ---

export async function getProperties(opts: {
  search?: string;
  propertyType?: string;
  status?: string;
  rera?: string;
  locality?: string;
  builder?: string;
  grade?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ data: Property[]; count: number }> {
  const { search, propertyType, status, rera, locality, grade, page = 1, pageSize = 25 } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("properties")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`name.ilike.%${search}%,builder_name.ilike.%${search}%,locality.ilike.%${search}%`);
  }
  if (propertyType) query = query.eq("property_type", propertyType);
  if (status) {
    // Match both "new launch" and "new_launch" variants
    const variants = [status, status.replace(/_/g, " "), status.replace(/ /g, "_")];
    query = query.in("status", Array.from(new Set(variants)));
  }
  if (rera === "registered") query = query.eq("rera_status", "registered");
  if (rera === "not_registered") query = query.neq("rera_status", "registered");
  if (locality) query = query.eq("locality", locality);
  if (opts.builder) query = query.eq("builder_name", opts.builder);
  if (grade) query = query.eq("builder_grade", grade);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data as Property[], count: count ?? 0 };
}

export async function getPropertyCount(): Promise<number> {
  const { count, error } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Property;
}

// --- Scrape Logs ---

export async function getScrapeLogs(limit = 20): Promise<ScrapeLog[]> {
  const { data, error } = await supabase
    .from("scrape_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ScrapeLog[];
}

export async function getScrapeLog(runId: string): Promise<ScrapeLog | null> {
  const { data, error } = await supabase
    .from("scrape_logs")
    .select("*")
    .eq("id", runId)
    .single();
  if (error) return null;
  return data as ScrapeLog;
}

// --- Crawled Properties ---

export async function getCrawledPropertiesByRun(runId: string): Promise<CrawledProperty[]> {
  const { data, error } = await supabase
    .from("crawled_properties")
    .select("*")
    .eq("crawl_run_id", runId)
    .order("match_status", { ascending: true });
  if (error) throw error;
  return data as CrawledProperty[];
}

export async function getUnreviewedProperties(): Promise<CrawledProperty[]> {
  const { data, error } = await supabase
    .from("crawled_properties")
    .select("*")
    .eq("reviewed", false)
    .in("match_status", ["new", "updated"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as CrawledProperty[];
}

export async function getPendingReviewCount(): Promise<number> {
  const { count, error } = await supabase
    .from("crawled_properties")
    .select("*", { count: "exact", head: true })
    .eq("reviewed", false)
    .in("match_status", ["new", "updated"]);
  if (error) throw error;
  return count ?? 0;
}

// --- Stats ---

export async function getNewThisWeekCount(): Promise<number> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count, error } = await supabase
    .from("crawled_properties")
    .select("*", { count: "exact", head: true })
    .eq("match_status", "new")
    .gte("created_at", weekAgo.toISOString());
  if (error) throw error;
  return count ?? 0;
}

const NON_BANGALORE_LOCALITIES = new Set([
  "LBS Marg, Kanjur",
  "Moti Nagar",
  "Palghar Naigaon East",
  "Pimpri",
  "Sector 85",
  "Titagarh, Barrackpore",
  "Undri",
  "Uttarpara",
  "Worli",
]);

export async function getDistinctBuilders(): Promise<string[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("builder_name");
  if (error) throw error;

  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.builder_name) set.add(row.builder_name);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function getDistinctStatuses(): Promise<string[]> {
  const { data, error } = await supabase.from("properties").select("status");
  if (error) throw error;

  const set = new Set<string>();
  for (const row of data ?? []) {
    if (!row.status) continue;
    // Normalize "new_launch" → "new launch" so duplicates collapse
    set.add(row.status.replace(/_/g, " "));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function getDistinctPropertyTypes(): Promise<string[]> {
  const { data, error } = await supabase.from("properties").select("property_type");
  if (error) throw error;

  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.property_type) set.add(row.property_type);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export async function getDistinctLocalities(): Promise<string[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("locality");
  if (error) throw error;

  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.locality && !NON_BANGALORE_LOCALITIES.has(row.locality)) set.add(row.locality);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

const ALLOWED_PROPERTY_TYPES = new Set(["apartment", "villa", "plot"]);

export async function getPropertyTypeDistribution(): Promise<{ name: string; value: number }[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("property_type");
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const type = (row.property_type || "").toLowerCase();
    if (ALLOWED_PROPERTY_TYPES.has(type)) {
      counts[type] = (counts[type] || 0) + 1;
    }
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}
