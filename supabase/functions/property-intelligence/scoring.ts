// v2: Combined analysis + scoring in one Claude call

const ANALYSIS_PROMPT = `You are a Bangalore real estate analyst. You will receive comprehensive data about a property including:
- Property details (name, builder, locality, price, BHK)
- Nearby places from OpenStreetMap (schools, hospitals, metro, malls, restaurants, parks, etc.)
- Commute times to major tech parks and landmarks
- Google search results about the project

Analyze ALL data and return a comprehensive JSON report. Be HONEST — if builder has delays, say so. If price is high, say so. Don't fabricate data — if not found, use null.

Return ONLY JSON, no markdown:

{
  "location_score": {
    "overall": 0-100,
    "breakdown": {
      "connectivity": { "score": 0-25, "note": "brief reason" },
      "amenities": { "score": 0-25, "note": "brief reason" },
      "infrastructure": { "score": 0-25, "note": "brief reason" },
      "value": { "score": 0-25, "note": "brief reason" }
    }
  },
  "commute_summary": {
    "best_for_commute_to": "Hub name — X min drive",
    "worst_commute": "Hub name — X min peak",
    "airport": "X min normal, Y min peak",
    "city_center": "X min normal",
    "peak_traffic_note": "traffic note for this area"
  },
  "project_research": {
    "builder_reputation": "Tier 1|Tier 2|Tier 3|Unknown",
    "delivery_track_record": "Excellent|Good|Average|Poor|Unknown",
    "known_issues": "any issues found or null",
    "construction_status": "Not Started|Foundation|Superstructure|Finishing|Ready|Unknown",
    "buyer_sentiment": "Positive|Mixed|Negative|No data"
  },
  "buying_analysis": {
    "overall_rating": "Excellent|Very Good|Good|Average|Below Average",
    "why_buy": ["4-5 specific reasons based on actual data"],
    "watch_out": ["2-4 honest concerns with specifics"],
    "best_for": "One line buyer persona",
    "not_suitable_for": ["reasons this might not fit"],
    "price_verdict": "Great value|Fairly priced|Slightly overpriced|Overpriced|Insufficient data",
    "appreciation_outlook": "X-Y% based on infrastructure pipeline",
    "rental_yield_estimate": "X-Y%",
    "invest_or_live": "Better for end-use|Better for investment|Good for both",
    "recommendation": "2-3 sentence honest recommendation"
  },
  "buyer_scorecard": {
    "investment": { "score": 1-10, "reason": "brief reason" },
    "self_use": { "score": 1-10, "reason": "brief reason" },
    "value_for_money": { "score": 1-10, "reason": "brief reason" },
    "appreciation": { "score": 1-10, "reason": "brief reason" },
    "growth_factor": { "score": 1-10, "reason": "brief reason" }
  },
  "one_liner": "One compelling line that captures the essence of this property for a buyer"
}

Bangalore-specific context:
- Manyata Tech Park, ITPL, ORR, Electronic City are major IT hubs
- Namma Metro Phase 1 (Purple + Green) operational
- Phase 2 (ORR line) under construction — expected 2027
- Phase 3 (Airport line) planned
- North Bangalore = fastest appreciating (airport corridor)
- East Bangalore = IT hub (Whitefield, Sarjapur)
- South Bangalore = established but traffic issues
- Tier 1 builders: Godrej, Prestige, Sobha, Brigade, Embassy, Tata
- Tier 2 builders: Puravankara, Salarpuria, Shriram, Provident, Assetz
- Current avg price: ₹8,000-10,000/sqft citywide`;

interface SearchResult {
  query: string;
  snippets: string[];
}

export async function generateAnalysis(
  property: {
    name: string;
    builder_name?: string | null;
    locality?: string | null;
    price_display?: string | null;
    bedrooms?: string | null;
    possession_date?: string | null;
    rera_id?: string | null;
    amenities?: string[] | null;
  },
  nearbyPlaces: Record<string, unknown[]>,
  commutes: Record<string, { distance_km: number; drive_time_min: number; traffic_time_min: number }>,
  googleResults: SearchResult[],
  builderHtml: string | null
): Promise<{
  location_score: { overall: number; breakdown?: Record<string, unknown> };
  buying_analysis: Record<string, unknown>;
  project_research: Record<string, unknown>;
  commute_summary: Record<string, unknown>;
  buyer_scorecard: Record<string, { score: number; reason: string }> | null;
  one_liner: string;
} | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  // Trim nearby places to avoid token overflow — keep only name + distance
  const trimmedPlaces: Record<string, unknown[]> = {};
  for (const [key, places] of Object.entries(nearbyPlaces)) {
    trimmedPlaces[key] = (places as Array<{ name?: string; distance_km?: number }>).map((p) => ({
      name: p.name,
      distance_km: p.distance_km,
    }));
  }

  const userContent = `Analyze this Bangalore property:

PROPERTY:
${JSON.stringify({
    name: property.name,
    builder: property.builder_name,
    locality: property.locality,
    price: property.price_display,
    bedrooms: property.bedrooms,
    possession: property.possession_date,
    rera: property.rera_id,
    amenities: property.amenities,
  })}

NEARBY PLACES:
${JSON.stringify(trimmedPlaces)}

COMMUTE TIMES:
${JSON.stringify(commutes)}

GOOGLE SEARCH RESULTS:
${JSON.stringify(googleResults)}

BUILDER WEBSITE CONTENT:
${builderHtml ? builderHtml.substring(0, 10000) : "Not available"}`;

  try {
    console.log(`  [analysis] Calling Claude API for ${property.name}... (key prefix: ${apiKey.substring(0, 10)})`);
    console.log(`  [analysis] Input sizes: places=${JSON.stringify(trimmedPlaces).length}, commutes=${JSON.stringify(commutes).length}, google=${JSON.stringify(googleResults).length}`);

    const requestBody = {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: ANALYSIS_PROMPT,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Claude API HTTP ${response.status}: ${errorBody.substring(0, 300)}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Claude API error: ${JSON.stringify(data.error)}`);
    }

    const text = data.content?.[0]?.text;
    if (!text) {
      throw new Error(`No text in Claude response: ${JSON.stringify(data).substring(0, 300)}`);
    }

    console.log(`  [analysis] Got response (${text.length} chars), parsing JSON...`);

    // Remove markdown fences
    let cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();

    // Extract just the JSON object — find the outermost { ... }
    const firstBrace = cleaned.indexOf("{");
    if (firstBrace >= 0) {
      let depth = 0;
      let lastBrace = -1;
      for (let i = firstBrace; i < cleaned.length; i++) {
        if (cleaned[i] === "{") depth++;
        else if (cleaned[i] === "}") {
          depth--;
          if (depth === 0) {
            lastBrace = i;
            break;
          }
        }
      }
      if (lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
    }

    const analysis = JSON.parse(cleaned);

    console.log(`  [analysis] Score for ${property.name}: ${analysis.location_score?.overall ?? "N/A"}`);

    return {
      location_score: analysis.location_score || { overall: 0 },
      buying_analysis: analysis.buying_analysis || {},
      project_research: analysis.project_research || {},
      commute_summary: analysis.commute_summary || {},
      buyer_scorecard: analysis.buyer_scorecard || null,
      one_liner: analysis.one_liner || "",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    console.error(`  [analysis] Failed for ${property.name}:`, msg);
    throw new Error(`Analysis failed: ${msg}`);
  }
}
