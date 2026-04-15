// Property Enrichment — Fetch detail pages to fill missing area, possession, RERA

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { getSupabaseClient } from "../_shared/db.ts";

const BATCH_LIMIT = 5;
const CRAWL_TIMEOUT_MS = 15_000;
const MAX_HTML_LENGTH = 40_000; // Detail pages need more content than listing pages

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

const DETAIL_EXTRACTION_PROMPT = `You are a real estate data extractor. Extract property details from this page. Return a JSON object with:
- price_min: Minimum price in INR (number, e.g. 5000000 for 50 Lakhs, 10000000 for 1 Cr). Convert Lakhs/Cr to raw number.
- price_max: Maximum price in INR (number). Convert Lakhs/Cr to raw number.
- price_display: Price as displayed on page (string, e.g. "₹50L - 1.2Cr", "₹85 Lakhs onwards")
- area_min: Minimum area in sqft (number)
- area_max: Maximum area in sqft (number)
- area_unit: Unit of area (default "sqft")
- possession_date: Expected possession date (string, e.g. "Dec 2025", "Ready to Move")
- rera_id: RERA registration number
- rera_status: registered, not_registered, or unknown
- amenities: List of amenities (array of strings)
- bedrooms: BHK configuration (e.g. "2,3 BHK")
- nearby_schools: Array of nearby schools/educational institutions mentioned, each as {"name": "...", "distance_km": number}. Distance in km if mentioned, else estimate or omit.
- nearby_hospitals: Array of nearby hospitals/healthcare facilities, each as {"name": "...", "distance_km": number}
- nearby_metro: Array of nearby metro stations, each as {"name": "...", "distance_km": number}
- nearby_malls: Array of nearby shopping malls/commercial centers, each as {"name": "...", "distance_km": number}
- location_highlights: Array of strings describing location advantages (e.g. "Close to IT parks", "Near international airport")

Only include fields you can find. Return valid JSON only.`;

serve(async (_req: Request) => {
  const startTime = Date.now();
  console.log(`[enrichment] Starting at ${new Date().toISOString()}`);

  try {
    const supabase = getSupabaseClient();

    // Claim properties using row locking to prevent duplicate processing
    const { data: properties, error: fetchError } = await supabase
      .rpc("claim_properties_for_enrichment", { batch_size: BATCH_LIMIT });

    if (fetchError) throw new Error(`DB fetch failed: ${fetchError.message || JSON.stringify(fetchError)}`);

    if (!properties || properties.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No properties need enrichment" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, unknown>[] = [];

    for (const property of properties) {
      try {
        console.log(`\n[enrichment] Processing: ${property.name}`);

        // Step 1: Find the detail URL
        let detailUrl = property.detail_url;

        if (!detailUrl) {
          console.log("  No detail_url stored, searching Google...");
          detailUrl = await findDetailUrl(property.name, property.builder_name);
        }

        if (!detailUrl) {
          console.log("  Could not find detail URL, marking as attempted");
          await supabase
            .from("properties")
            .update({ enrichment_updated_at: new Date().toISOString() })
            .eq("id", property.id);
          results.push({ property: property.name, status: "skipped", reason: "no_detail_url" });
          continue;
        }

        console.log(`  Detail URL: ${detailUrl}`);

        // Step 2: Fetch the detail page
        const html = await fetchDetailPage(detailUrl);
        if (!html) {
          console.log("  Failed to fetch detail page");
          await supabase
            .from("properties")
            .update({ enrichment_updated_at: new Date().toISOString() })
            .eq("id", property.id);
          results.push({ property: property.name, status: "error", error: "fetch_failed" });
          continue;
        }

        console.log(`  Fetched ${html.length} chars, extracting with Claude...`);

        // Step 3: Extract details with Claude
        const extracted = await extractDetailsWithClaude(html, property.name);
        if (!extracted) {
          console.log("  Extraction failed");
          await supabase
            .from("properties")
            .update({ enrichment_updated_at: new Date().toISOString() })
            .eq("id", property.id);
          results.push({ property: property.name, status: "error", error: "extraction_failed" });
          continue;
        }

        console.log(`  Extracted: area=${extracted.area_min}-${extracted.area_max}, possession=${extracted.possession_date}, rera=${extracted.rera_id}`);

        // Step 4: Merge into DB (only overwrite nulls)
        const updateFields: Record<string, unknown> = {
          enrichment_updated_at: new Date().toISOString(),
        };

        // Only set detail_url if we didn't already have one
        if (!property.detail_url && detailUrl) {
          updateFields.detail_url = detailUrl;
        }

        // Only overwrite null fields
        if (property.price_min == null && extracted.price_min != null) {
          updateFields.price_min = extracted.price_min;
        }
        if (property.price_max == null && extracted.price_max != null) {
          updateFields.price_max = extracted.price_max;
        }
        if (property.price_display == null && extracted.price_display != null) {
          updateFields.price_display = extracted.price_display;
        }
        if (property.area_min == null && extracted.area_min != null) {
          updateFields.area_min = extracted.area_min;
        }
        if (property.area_max == null && extracted.area_max != null) {
          updateFields.area_max = extracted.area_max;
        }
        if (property.area_unit == null && extracted.area_unit != null) {
          updateFields.area_unit = extracted.area_unit;
        }
        if (property.possession_date == null && extracted.possession_date != null) {
          updateFields.possession_date = extracted.possession_date;
        }
        if (property.rera_id == null && extracted.rera_id != null) {
          updateFields.rera_id = extracted.rera_id;
        }
        if (property.rera_status == null && extracted.rera_status != null) {
          updateFields.rera_status = extracted.rera_status;
        }
        if (property.amenities == null && extracted.amenities != null && extracted.amenities.length > 0) {
          updateFields.amenities = extracted.amenities;
        }
        if (property.bedrooms == null && extracted.bedrooms != null) {
          updateFields.bedrooms = extracted.bedrooms;
        }

        // Fill in nearby places if location intelligence is empty
        const schools = extracted.nearby_schools as { name: string; distance_km?: number }[] | undefined;
        const hospitals = extracted.nearby_hospitals as { name: string; distance_km?: number }[] | undefined;
        const metro = extracted.nearby_metro as { name: string; distance_km?: number }[] | undefined;
        const malls = extracted.nearby_malls as { name: string; distance_km?: number }[] | undefined;
        const locationHighlights = extracted.location_highlights as string[] | undefined;

        const existingSchools = property.nearby_schools as unknown[] | null;
        const existingHospitals = property.nearby_hospitals as unknown[] | null;
        const existingMetro = property.nearby_metro as unknown[] | null;
        const existingEntertainment = property.nearby_entertainment as Record<string, unknown[]> | null;

        if ((!existingSchools || existingSchools.length === 0) && schools && schools.length > 0) {
          updateFields.nearby_schools = schools.map(s => ({
            name: s.name,
            distance_km: s.distance_km || null,
            source: "portal",
          }));
        }
        if ((!existingHospitals || existingHospitals.length === 0) && hospitals && hospitals.length > 0) {
          updateFields.nearby_hospitals = hospitals.map(h => ({
            name: h.name,
            distance_km: h.distance_km || null,
            source: "portal",
          }));
        }
        if ((!existingMetro || existingMetro.length === 0) && metro && metro.length > 0) {
          updateFields.nearby_metro = metro.map(m => ({
            name: m.name,
            distance_km: m.distance_km || null,
            source: "portal",
          }));
        }
        if ((!existingEntertainment || !(existingEntertainment.malls as unknown[])?.length) && malls && malls.length > 0) {
          updateFields.nearby_entertainment = {
            ...(existingEntertainment || {}),
            malls: malls.map(m => ({
              name: m.name,
              distance_km: m.distance_km || null,
              source: "portal",
            })),
          };
        }
        if (locationHighlights && locationHighlights.length > 0) {
          updateFields.location_highlights = locationHighlights;
        }

        const { error: updateError } = await supabase
          .from("properties")
          .update(updateFields)
          .eq("id", property.id);

        if (updateError) {
          console.error(`  Update failed:`, updateError.message);
          results.push({ property: property.name, status: "error", error: updateError.message });
        } else {
          const fieldsUpdated = Object.keys(updateFields).filter(k => k !== "enrichment_updated_at");
          console.log(`  Done: updated ${fieldsUpdated.length} fields: ${fieldsUpdated.join(", ")}`);
          results.push({ property: property.name, status: "success", fields_updated: fieldsUpdated });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        console.error(`  Failed ${property.name}:`, msg);
        results.push({ property: property.name, status: "error", error: msg });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const summary = {
      success: true,
      processed: results.length,
      successful: results.filter(r => r.status === "success").length,
      skipped: results.filter(r => r.status === "skipped").length,
      errors: results.filter(r => r.status === "error").length,
      duration_seconds: duration,
      details: results,
    };

    console.log(`[enrichment] Complete: ${summary.successful} success, ${summary.skipped} skipped, ${summary.errors} errors in ${duration}s`);

    return new Response(JSON.stringify(summary), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`[enrichment] Pipeline failed:`, errorMsg);

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

// --- Find detail URL via MagicBricks search (known to work from daily crawler) ---
async function findDetailUrl(propertyName: string, _builderName: string | null): Promise<string | null> {
  // MagicBricks search pages work reliably from server-side (proven by daily crawler)
  // and return property-specific data when searching by project name
  const searchUrl = `https://www.magicbricks.com/property-for-sale/residential-real-estate?bedroom=&proptype=Multistorey-Apartment,Builder-Floor-Apartment,Penthouse,Studio-Apartment,Villa&cityName=Bangalore&keyword=${encodeURIComponent(propertyName)}`;

  try {
    const response = await fetch(searchUrl, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });

    if (response.ok) {
      const html = await response.text();
      // Check if the page actually has content about this property
      const firstName = propertyName.split(" ")[0].toLowerCase();
      if (html.toLowerCase().includes(firstName)) {
        console.log(`  Found via MagicBricks search: ${searchUrl}`);
        return searchUrl;
      }
    }
  } catch (e) {
    console.error(`  [search] MagicBricks search failed:`, (e as Error).message);
  }

  return null;
}

// --- Fetch and clean a detail page ---
async function fetchDetailPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      console.error(`  Fetch failed: HTTP ${response.status}`);
      return null;
    }

    const html = await response.text();
    return cleanDetailHtml(html);
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? `Timeout after ${CRAWL_TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : "Unknown error";
    console.error(`  Fetch error: ${message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanDetailHtml(html: string): string {
  let cleaned = html;
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  cleaned = cleaned.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  cleaned = cleaned.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  cleaned = cleaned.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  cleaned = cleaned.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  cleaned = cleaned.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  // Keep more attributes than the listing crawler since we need data attributes for detail pages
  cleaned = cleaned.replace(/<(\w+)\s+[^>]*>/g, (_match, tag) => `<${tag}>`);
  cleaned = cleaned.replace(/<(\w+)>\s*<\/\1>/g, "");
  cleaned = cleaned.replace(/\s+/g, " ");
  return cleaned.slice(0, MAX_HTML_LENGTH);
}

// --- Extract details using Claude Haiku ---
async function extractDetailsWithClaude(
  html: string,
  propertyName: string
): Promise<Record<string, unknown> | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Property: ${propertyName}\n\nHTML Content:\n${html}`,
        },
      ],
      system: DETAIL_EXTRACTION_PROMPT,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`  Claude API error ${response.status}: ${errorText.slice(0, 200)}`);
    return null;
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "{}";

  return parseExtractedJson(text);
}

function parseExtractedJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return null;
  } catch {
    // Try extracting JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (typeof parsed === "object" && parsed !== null) return parsed;
      } catch {
        // fall through
      }
    }

    // Try finding JSON object by matching braces
    const start = text.indexOf("{");
    if (start !== -1) {
      let depth = 0;
      for (let i = start; i < text.length; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(text.slice(start, i + 1));
            if (typeof parsed === "object" && parsed !== null) return parsed;
          } catch {
            // fall through
          }
          break;
        }
      }
    }

    console.error(`  Failed to parse extraction:`, text.slice(0, 200));
    return null;
  }
}
