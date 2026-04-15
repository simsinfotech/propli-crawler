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

// --- Nearby Places via Overpass API (FREE) ---
export async function fetchNearbyPlaces(
  lat: number, lng: number
): Promise<Record<string, unknown[]>> {
  const results: Record<string, unknown[]> = {};

  for (const cat of OVERPASS_CATEGORIES) {
    try {
      const tagQueries = cat.osm_tags.map(tag =>
        `node[${tag}](around:${cat.radius},${lat},${lng});way[${tag}](around:${cat.radius},${lat},${lng});`
      ).join("\n");
      const query = `[out:json][timeout:10];(${tagQueries});out center body ${cat.max * 2};`;

      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        console.error(`  [location] Overpass ${cat.key}: HTTP ${response.status}`);
        results[cat.key] = [];
        continue;
      }

      const data = await response.json();

      const places = (data.elements || [])
        .map((el: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }) => {
          const elLat = el.lat || el.center?.lat;
          const elLng = el.lon || el.center?.lon;
          if (!elLat || !elLng) return null;
          return {
            name: el.tags?.name || el.tags?.["name:en"] || null,
            distance_km: haversineDistance(lat, lng, elLat, elLng),
            lat: elLat,
            lng: elLng,
            operator: el.tags?.operator || null,
            website: el.tags?.website || null,
          };
        })
        .filter((p: { name: string | null } | null) => p !== null)
        .sort((a: { distance_km: number }, b: { distance_km: number }) => a.distance_km - b.distance_km)
        .slice(0, cat.max);

      results[cat.key] = places;
    } catch (e) {
      console.error(`  [location] Overpass failed for ${cat.key}:`, (e as Error).message);
      results[cat.key] = [];
    }

    // Respect rate limit (reduced for speed)
    await new Promise((r) => setTimeout(r, 400));
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
