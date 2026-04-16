// v2: Property Intelligence — Zero Paid APIs (except Claude Haiku)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { getSupabaseClient } from "../_shared/db.ts";
import { scrapeImages } from "./scrape-images.ts";
import { scrapeGoogleSearch } from "./research.ts";
import { geocodeProperty, fetchNearbyPlaces, calculateCommutes } from "./location.ts";
import { generateAnalysis } from "./scoring.ts";

const BATCH_LIMIT = 1; // Process 1 property per invocation to stay within timeout

serve(async (req: Request) => {
  const startTime = Date.now();
  console.log(`[intelligence] Starting pipeline at ${new Date().toISOString()}`);

  // Optional: ?property_id=<uuid> to target a specific property (skips claim queue)
  // Optional: ?mode=location_refresh to ONLY refresh nearby places (no images, no Google, no Claude)
  const url = new URL(req.url);
  const targetId = url.searchParams.get("property_id");
  const mode = url.searchParams.get("mode") || "full";
  const isLocationOnly = mode === "location_refresh";

  try {
    const supabase = getSupabaseClient();

    let properties: Record<string, unknown>[] | null = null;
    let fetchError: { message?: string } | null = null;

    if (targetId) {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", targetId)
        .limit(1);
      properties = data;
      fetchError = error;
    } else if (isLocationOnly) {
      const { data, error } = await supabase.rpc("claim_property_for_location_refresh");
      properties = data;
      fetchError = error;
    } else {
      const { data, error } = await supabase.rpc("claim_property_for_intelligence");
      properties = data;
      fetchError = error;
    }

    if (fetchError) throw new Error(`DB fetch failed: ${fetchError.message || JSON.stringify(fetchError)}`);

    if (!properties || properties.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No properties need updates" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[intelligence] Processing ${properties.length} properties`);
    const results: Record<string, unknown>[] = [];

    for (const property of properties) {
      try {
        console.log(`\n[intelligence] Processing: ${property.name} (mode=${mode})`);

        // Step 1: Geocode if needed (Nominatim — FREE)
        let lat = property.latitude;
        let lng = property.longitude;
        if (!lat || !lng) {
          console.log("  Geocoding via Nominatim...");
          const locality = property.locality || property.city || "Bangalore";
          const city = property.city || "Bangalore";
          const coords = await geocodeProperty(locality, city, property.name).catch(() => null);
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
            await supabase
              .from("properties")
              .update({ latitude: lat, longitude: lng })
              .eq("id", property.id);
            console.log(`  Geocoded: ${lat}, ${lng}`);
          } else {
            console.log(`  Geocoding failed, skipping ${property.name}`);
            results.push({ property: property.name, status: "error", error: "Geocoding failed" });
            continue;
          }
        }

        // ===== LOCATION-ONLY MODE: refresh nearby places, preserve everything else =====
        if (isLocationOnly) {
          console.log("  [location_refresh] Fetching Overpass + commutes only...");
          const [nearbyPlaces, commutes] = await Promise.all([
            fetchNearbyPlaces(lat, lng).catch((e) => {
              console.error(`  [location] Error:`, (e as Error).message);
              return {} as Record<string, unknown[]>;
            }),
            calculateCommutes(lat, lng).catch((e) => {
              console.error(`  [commutes] Error:`, (e as Error).message);
              return {} as Record<string, { distance_km: number; drive_time_min: number; traffic_time_min: number }>;
            }),
          ]);

          const schoolsCount = (nearbyPlaces.schools as unknown[])?.length || 0;
          const hospitalsCount = (nearbyPlaces.hospitals as unknown[])?.length || 0;
          const metroCount = (nearbyPlaces.metro_stations as unknown[])?.length || 0;

          // Detect Overpass total failure: if ALL major categories empty, treat as failed and
          // do NOT mark refresh complete — leave location_refresh_at NULL so it gets retried.
          const totalCategories = Object.keys(nearbyPlaces).filter((k) => k !== "airport").length;
          const totalItems = Object.entries(nearbyPlaces)
            .filter(([k]) => k !== "airport")
            .reduce((sum, [, v]) => sum + ((v as unknown[])?.length || 0), 0);
          const overpassFailed = totalCategories === 0 || totalItems === 0;

          if (overpassFailed) {
            console.log(`  [location_refresh] Overpass returned 0 items across all categories — treating as transient failure, will retry`);
            results.push({
              property: property.name,
              status: "error",
              mode: "location_refresh",
              error: "Overpass returned no data (transient — will retry)",
            });
            continue;
          }

          // Only update location fields — DO NOT touch ai_buying_analysis, location_score,
          // builder_grade, images_scraped, ai_project_research
          const { error: updateError } = await supabase
            .from("properties")
            .update({
              location_intelligence: nearbyPlaces,
              commute_data: commutes,
              nearby_schools: nearbyPlaces.schools || [],
              nearby_hospitals: nearbyPlaces.hospitals || [],
              nearby_metro: nearbyPlaces.metro_stations || [],
              nearby_entertainment: {
                malls: nearbyPlaces.shopping_malls || [],
                restaurants: nearbyPlaces.restaurants || [],
                cafes: nearbyPlaces.cafes || [],
                cinema: nearbyPlaces.cinema || [],
                parks: nearbyPlaces.parks || [],
              },
              location_refresh_at: new Date().toISOString(),
            })
            .eq("id", property.id);

          if (updateError) {
            results.push({ property: property.name, status: "error", error: updateError.message });
          } else {
            results.push({
              property: property.name,
              status: "success",
              mode: "location_refresh",
              schools: schoolsCount,
              hospitals: hospitalsCount,
              metro: metroCount,
            });
          }
          continue; // Skip the full-pipeline path
        }

        // Steps 2-5: Run ALL data collection in PARALLEL to save time
        console.log("  Running data collection in parallel (images + places + commutes + research)...");

        const [storedImages, nearbyPlaces, commutes, googleResults] = await Promise.all([
          // Step 2: Scrape images
          scrapeImages(
            {
              id: property.id,
              name: property.name,
              builder_name: property.builder_name,
              source_url: property.source_url,
            },
            supabase
          ).catch((e) => {
            console.error(`  [images] Error:`, (e as Error).message);
            return [] as unknown[];
          }),

          // Step 3: Nearby places (Overpass API)
          fetchNearbyPlaces(lat, lng).catch((e) => {
            console.error(`  [location] Error:`, (e as Error).message);
            return {} as Record<string, unknown[]>;
          }),

          // Step 4: Commute times (OSRM)
          calculateCommutes(lat, lng).catch((e) => {
            console.error(`  [commutes] Error:`, (e as Error).message);
            return {} as Record<string, { distance_km: number; drive_time_min: number; traffic_time_min: number }>;
          }),

          // Step 5: Google research
          scrapeGoogleSearch(
            property.name,
            property.builder_name || ""
          ).catch((e) => {
            console.error(`  [research] Error:`, (e as Error).message);
            return [] as { query: string; snippets: string[] }[];
          }),
        ]);

        const dataTime = Math.round((Date.now() - startTime) / 1000);
        console.log(`  Data collection done in ${dataTime}s. Running AI analysis...`);

        // Step 6: AI analysis (Claude Haiku — only paid service)
        let analysisError: string | null = null;
        const analysis = await generateAnalysis(
          {
            name: property.name,
            builder_name: property.builder_name,
            locality: property.locality,
            price_display: property.price_display,
            bedrooms: property.bedrooms,
            possession_date: property.possession_date,
            rera_id: property.rera_id,
            amenities: property.amenities,
          },
          nearbyPlaces,
          commutes,
          googleResults as { query: string; snippets: string[] }[],
          null
        ).catch((e) => {
          analysisError = (e as Error).message;
          console.error(`  [analysis] Error:`, analysisError);
          return null;
        });

        console.log(`  Analysis result: ${analysis ? `score=${analysis.location_score?.overall}` : "NULL (failed)"}`);

        // Step 7: Save everything
        console.log("  Saving to database...");
        const updateData: Record<string, unknown> = {
          images_scraped: storedImages,
          location_intelligence: nearbyPlaces,
          commute_data: commutes,
          nearby_schools: nearbyPlaces.schools || [],
          nearby_hospitals: nearbyPlaces.hospitals || [],
          nearby_metro: nearbyPlaces.metro_stations || [],
          nearby_entertainment: {
            malls: nearbyPlaces.shopping_malls || [],
            restaurants: nearbyPlaces.restaurants || [],
            cafes: nearbyPlaces.cafes || [],
            cinema: nearbyPlaces.cinema || [],
            parks: nearbyPlaces.parks || [],
          },
          ai_project_research: analysis?.project_research || googleResults,
          intelligence_updated_at: new Date().toISOString(),
        };

        // Determine builder grade
        const builderGrade = determineBuilderGrade(
          property.builder_name,
          (analysis?.project_research as Record<string, unknown>)?.builder_reputation as string | undefined
        );
        updateData.builder_grade = builderGrade;

        if (analysis) {
          updateData.location_score = analysis.location_score?.overall ?? null;
          updateData.ai_buying_analysis = {
            ...analysis.buying_analysis,
            commute_summary: analysis.commute_summary,
            one_liner: analysis.one_liner,
            overall_rating: (analysis.buying_analysis as Record<string, unknown>)?.overall_rating,
            score_breakdown: analysis.location_score?.breakdown,
            buyer_scorecard: analysis.buyer_scorecard,
          };
        }

        const { error: updateError } = await supabase
          .from("properties")
          .update(updateData)
          .eq("id", property.id);

        if (updateError) {
          console.error(`  Save failed:`, updateError.message);
          results.push({ property: property.name, status: "error", error: updateError.message });
        } else {
          console.log(`  Done: ${property.name} (score: ${analysis?.location_score?.overall ?? "N/A"}, images: ${(storedImages as unknown[]).length})`);
          results.push({
            property: property.name,
            status: "success",
            images: (storedImages as unknown[]).length,
            location_score: analysis?.location_score?.overall,
            schools_found: (nearbyPlaces.schools as unknown[])?.length || 0,
            hospitals_found: (nearbyPlaces.hospitals as unknown[])?.length || 0,
            analysis_error: analysisError,
            has_scorecard: !!analysis?.buyer_scorecard,
          });
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
      successful: results.filter((r) => r.status === "success").length,
      errors: results.filter((r) => r.status === "error").length,
      duration_seconds: duration,
      details: results,
    };

    console.log(`[intelligence] Complete: ${summary.successful} success, ${summary.errors} errors in ${duration}s`);

    return new Response(JSON.stringify(summary), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`[intelligence] Pipeline failed:`, errorMsg);

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

const GRADE_A_BUILDERS = [
  "godrej", "prestige", "sobha", "brigade", "embassy", "tata", "birla",
  "dlf", "lodha", "mahindra", "l&t", "l and t", "larsen", "shapoorji", "pallonji",
];
const GRADE_B_BUILDERS = [
  "puravankara", "salarpuria", "shriram", "provident", "assetz", "bhartiya",
  "rohan", "tvs", "kolte", "patil", "mantri", "sumadhura", "total environment",
];

function determineBuilderGrade(
  builderName: string | null,
  aiReputation?: string
): string {
  // AI override takes priority
  if (aiReputation) {
    const rep = aiReputation.toLowerCase();
    if (rep.includes("tier 1") || rep.includes("tier-1")) return "A";
    if (rep.includes("tier 2") || rep.includes("tier-2")) return "B";
    if (rep.includes("tier 3") || rep.includes("tier-3")) return "C";
  }

  // Hardcoded builder map
  if (builderName) {
    const name = builderName.toLowerCase();
    if (GRADE_A_BUILDERS.some((b) => name.includes(b))) return "A";
    if (GRADE_B_BUILDERS.some((b) => name.includes(b))) return "B";
  }

  return "C";
}
