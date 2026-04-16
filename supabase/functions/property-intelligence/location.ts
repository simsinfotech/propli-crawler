// v2: Free APIs only — Nominatim, Overpass, OSRM

const OVERPASS_CATEGORIES = [
  { key: "schools", osm_tags: ['"amenity"="school"', '"amenity"="kindergarten"'], radius: 5000, max: 10 },
  { key: "colleges", osm_tags: ['"amenity"="university"', '"amenity"="college"'], radius: 5000, max: 5 },
  { key: "hospitals", osm_tags: ['"amenity"="hospital"', '"amenity"="clinic"'], radius: 5000, max: 10 },
  { key: "pharmacies", osm_tags: ['"amenity"="pharmacy"'], radius: 2000, max: 3 },
  { key: "metro_stations", osm_tags: ['"railway"="station"'], radius: 5000, max: 5 },
  { key: "bus_stops", osm_tags: ['"highway"="bus_stop"'], radius: 2000, max: 5 },
  { key: "shopping_malls", osm_tags: ['"shop"="mall"'], radius: 5000, max: 5 },
  { key: "supermarkets", osm_tags: ['"shop"="supermarket"'], radius: 2000, max: 5 },
  { key: "restaurants", osm_tags: ['"amenity"="restaurant"'], radius: 2000, max: 10 },
  { key: "cafes", osm_tags: ['"amenity"="cafe"'], radius: 2000, max: 5 },
  { key: "cinema", osm_tags: ['"amenity"="cinema"'], radius: 5000, max: 3 },
  { key: "parks", osm_tags: ['"leisure"="park"'], radius: 3000, max: 5 },
  { key: "gyms", osm_tags: ['"leisure"="fitness_centre"'], radius: 2000, max: 5 },
  { key: "banks", osm_tags: ['"amenity"="bank"'], radius: 1000, max: 5 },
  { key: "atms", osm_tags: ['"amenity"="atm"'], radius: 1000, max: 3 },
];

const COMMUTE_DESTINATIONS = [
  { name: "Manyata Tech Park", lat: 13.0474, lng: 77.6219 },
  { name: "Outer Ring Road (Marathahalli)", lat: 12.9568, lng: 77.7009 },
  { name: "Electronic City", lat: 12.8456, lng: 77.6603 },
  { name: "Whitefield IT Hub", lat: 12.9698, lng: 77.75 },
  { name: "KR Puram / ITPL", lat: 13.0068, lng: 77.6968 },
  { name: "Kempegowda Airport", lat: 13.1979, lng: 77.7063 },
  { name: "Majestic / City Center", lat: 12.9767, lng: 77.5713 },
  { name: "Koramangala", lat: 12.9352, lng: 77.6245 },
  { name: "Indiranagar", lat: 12.9784, lng: 77.6408 },
  { name: "Bangalore City Railway", lat: 12.9783, lng: 77.5714 },
];

export function haversineDistance(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

// --- Geocoding via Nominatim (FREE) ---
export async function geocodeProperty(
  locality: string,
  city = "Bangalore",
  propertyName?: string
): Promise<{ lat: number; lng: number } | null> {
  // Try multiple query variants for better hit rate
  const queries = [
    `${locality}, ${city}, India`,
    `${propertyName || locality}, ${city}, India`,
    `${city}, India`,
  ];

  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
      const response = await fetch(url, {
        headers: { "User-Agent": "Propli/1.0 (property-intelligence)" },
      });
      const data = await response.json();

      if (data[0]) {
        console.log(`  [geocode] Found via query: "${q}"`);
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
      // Nominatim rate limit: 1 req/sec
      await new Promise((r) => setTimeout(r, 1100));
    } catch (e) {
      console.error(`  [geocode] Nominatim failed for "${q}":`, (e as Error).message);
    }
  }
  return null;
}

// --- Overpass mirror endpoints — failover on rate limits ---
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function overpassFetch(query: string, attempt = 0): Promise<{ elements: unknown[] } | null> {
  // Rotate through mirrors to dodge rate limits
  const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (response.status === 429 || response.status === 504 || response.status >= 500) {
      if (attempt < 5) {
        const backoff = 800 + 400 * attempt;
        console.log(`  [overpass] ${endpoint.split("/")[2]} HTTP ${response.status}, retrying in ${backoff}ms (attempt ${attempt + 1})`);
        await new Promise((r) => setTimeout(r, backoff));
        return overpassFetch(query, attempt + 1);
      }
      console.error(`  [overpass] All retries exhausted: HTTP ${response.status}`);
      return null;
    }

    if (!response.ok) {
      console.error(`  [overpass] ${endpoint.split("/")[2]} HTTP ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (e) {
    if (attempt < 5) {
      console.log(`  [overpass] Network error on ${endpoint.split("/")[2]}, retrying:`, (e as Error).message);
      await new Promise((r) => setTimeout(r, 800 + 400 * attempt));
      return overpassFetch(query, attempt + 1);
    }
    console.error(`  [overpass] Final failure:`, (e as Error).message);
    return null;
  }
}

// Tag matchers — given an OSM element's tags, return which category it belongs to (or null)
function categorize(tags: Record<string, string>): string | null {
  const a = tags.amenity;
  const r = tags.railway;
  const h = tags.highway;
  const s = tags.shop;
  const l = tags.leisure;

  if (a === "school" || a === "kindergarten") return "schools";
  if (a === "university" || a === "college") return "colleges";
  if (a === "hospital" || a === "clinic") return "hospitals";
  if (a === "pharmacy") return "pharmacies";
  if (r === "station") return "metro_stations";
  if (h === "bus_stop") return "bus_stops";
  if (s === "mall") return "shopping_malls";
  if (s === "supermarket") return "supermarkets";
  if (a === "restaurant") return "restaurants";
  if (a === "cafe") return "cafes";
  if (a === "cinema") return "cinema";
  if (l === "park") return "parks";
  if (l === "fitness_centre") return "gyms";
  if (a === "bank") return "banks";
  if (a === "atm") return "atms";
  return null;
}

// --- Nearby Places via Overpass API (FREE) ---
// Single combined query returns all categories at once — much faster, fewer rate-limit hits.
export async function fetchNearbyPlaces(
  lat: number, lng: number
): Promise<Record<string, unknown[]>> {
  const results: Record<string, unknown[]> = {};
  // Initialize all categories so consumers can rely on keys existing
  for (const cat of OVERPASS_CATEGORIES) results[cat.key] = [];

  // Build a single union query — use the largest radius (5km) to capture everything.
  // We'll filter per-category by their own radius client-side.
  const r = 5000;
  const queries = [
    `node["amenity"~"^(school|kindergarten|university|college|hospital|clinic|pharmacy|restaurant|cafe|cinema|bank|atm)$"](around:${r},${lat},${lng});`,
    `way["amenity"~"^(school|kindergarten|university|college|hospital|clinic|restaurant|cinema|bank)$"](around:${r},${lat},${lng});`,
    `node["railway"="station"](around:${r},${lat},${lng});`,
    `way["railway"="station"](around:${r},${lat},${lng});`,
    `node["highway"="bus_stop"](around:2000,${lat},${lng});`,
    `node["shop"~"^(mall|supermarket)$"](around:${r},${lat},${lng});`,
    `way["shop"~"^(mall|supermarket)$"](around:${r},${lat},${lng});`,
    `node["leisure"~"^(park|fitness_centre)$"](around:3000,${lat},${lng});`,
    `way["leisure"~"^(park|fitness_centre)$"](around:3000,${lat},${lng});`,
  ];

  const query = `[out:json][timeout:25];(${queries.join("\n")});out center tags;`;

  const data = await overpassFetch(query);
  if (!data) {
    console.log(`  [overpass] No data returned, all categories empty`);
    return results;
  }

  // Group by category
  const buckets: Record<string, Array<{ name: string | null; distance_km: number; lat: number; lng: number; operator: string | null; website: string | null }>> = {};

  for (const el of (data.elements || [])) {
    const e = el as { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
    const tags = e.tags || {};
    const cat = categorize(tags);
    if (!cat) continue;

    const elLat = e.lat || e.center?.lat;
    const elLng = e.lon || e.center?.lon;
    if (!elLat || !elLng) continue;

    const dist = haversineDistance(lat, lng, elLat, elLng);
    // Apply per-category radius filter
    const catCfg = OVERPASS_CATEGORIES.find((c) => c.key === cat);
    if (catCfg && dist * 1000 > catCfg.radius) continue;

    if (!buckets[cat]) buckets[cat] = [];
    buckets[cat].push({
      name: tags.name || tags["name:en"] || null,
      distance_km: dist,
      lat: elLat,
      lng: elLng,
      operator: tags.operator || null,
      website: tags.website || null,
    });
  }

  // Sort by distance and apply max per category
  for (const cat of OVERPASS_CATEGORIES) {
    const items = buckets[cat.key] || [];
    items.sort((a, b) => a.distance_km - b.distance_km);
    results[cat.key] = items.slice(0, cat.max);
  }

  // Airport distance (fixed point — no API needed)
  results["airport"] = [
    {
      name: "Kempegowda International Airport",
      distance_km: haversineDistance(lat, lng, 13.1979, 77.7063),
      lat: 13.1979,
      lng: 77.7063,
    },
  ];

  return results;
}

// --- Commute Times via OSRM (FREE) ---
export async function calculateCommutes(
  lat: number, lng: number
): Promise<Record<string, { distance_km: number; drive_time_min: number; traffic_time_min: number }>> {
  const commutes: Record<string, { distance_km: number; drive_time_min: number; traffic_time_min: number }> = {};

  for (const dest of COMMUTE_DESTINATIONS) {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${dest.lng},${dest.lat}?overview=false`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes?.[0]) {
        const route = data.routes[0];
        const driveMin = Math.round(route.duration / 60);
        commutes[dest.name] = {
          distance_km: Math.round(route.distance / 100) / 10,
          drive_time_min: driveMin,
          traffic_time_min: Math.round(driveMin * 1.6), // 1.6x multiplier for peak traffic estimate
        };
      }
    } catch (e) {
      console.error(`  [commute] OSRM failed for ${dest.name}:`, (e as Error).message);
      // Fallback to haversine
      commutes[dest.name] = {
        distance_km: haversineDistance(lat, lng, dest.lat, dest.lng),
        drive_time_min: 0,
        traffic_time_min: 0,
      };
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return commutes;
}
