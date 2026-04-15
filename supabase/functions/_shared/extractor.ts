import { CrawlSource, ExtractedProperty } from "./types.ts";

const EXTRACTION_PROMPT = `You are a real estate data extractor. Analyze the HTML content from a Bangalore property listing website and extract ALL property projects mentioned.

For each property, extract:
- name: Project name (required)
- builder_name: Developer/builder name
- locality: Area/locality in Bangalore
- city: City (default "Bangalore")
- price_min: Minimum price in INR (number, e.g. 5000000 for 50 Lakhs)
- price_max: Maximum price in INR (number)
- price_display: Price as displayed (e.g. "₹50L - 1.2Cr")
- property_type: apartment, villa, plot, or commercial
- bedrooms: BHK configuration (e.g. "2,3 BHK")
- area_min: Minimum area (number)
- area_max: Maximum area (number)
- area_unit: sqft (default)
- rera_id: RERA registration number if found
- rera_status: registered, not_registered, or unknown
- status: active, upcoming, or completed
- possession_date: Expected possession date
- amenities: List of amenities
- detail_url: URL/href link to this property's detail page (if visible in the HTML)

IMPORTANT:
- Extract EVERY distinct property/project you can find
- ONLY include properties located in Bangalore/Bengaluru. Skip properties in other cities (Chennai, Jaipur, Panipat, Mumbai, Pune, Hyderabad, Kolkata, etc.)
- Convert all prices to INR numbers (1 Cr = 10000000, 1 Lakh = 100000)
- If a field is not available, omit it
- Return valid JSON only

Respond with a JSON array:
[{"name": "...", "builder_name": "...", ...}]

If no properties found, return: []`;

export async function extractWithClaude(
  html: string,
  source: CrawlSource
): Promise<ExtractedProperty[]> {
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
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Source: ${source.label} (${source.url})\n\nHTML Content:\n${html}`,
        },
      ],
      system: EXTRACTION_PROMPT,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || "[]";

  const properties = parseExtractedJson(text, source);
  return filterBangaloreOnly(properties);
}

const NON_BANGALORE_KEYWORDS = [
  "chennai", "jaipur", "panipat", "mumbai", "pune", "hyderabad", "kolkata",
  "noida", "gurgaon", "delhi", "panvel", "bhogapuram", "sabarmati",
  "parnasree", "korlaparthi", "chikkaballapur", "thane", "navi mumbai",
  "worli", "pimpri", "undri", "palghar", "naigaon", "titagarh", "barrackpore",
  "uttarpara", "moti nagar", "sector 85", "lbs marg", "kanjur",
];

function filterBangaloreOnly(properties: ExtractedProperty[]): ExtractedProperty[] {
  return properties.filter((p) => {
    const text = `${p.name || ""} ${p.locality || ""} ${p.city || ""}`.toLowerCase();
    for (const kw of NON_BANGALORE_KEYWORDS) {
      if (text.includes(kw)) {
        console.log(`  Filtered out non-Bangalore property: ${p.name} (matched: ${kw})`);
        return false;
      }
    }
    return true;
  });
}

function parseExtractedJson(
  text: string,
  source: CrawlSource
): ExtractedProperty[] {
  try {
    // Try direct parse
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter((p: ExtractedProperty) => p.name);
    }
    return [];
  } catch {
    // Try extracting JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) {
          return parsed.filter((p: ExtractedProperty) => p.name);
        }
      } catch {
        // fall through
      }
    }

    // Try finding array in text
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.filter((p: ExtractedProperty) => p.name);
        }
      } catch {
        // fall through
      }
    }

    console.error(
      `Failed to parse extraction for ${source.label}:`,
      text.slice(0, 200)
    );
    return [];
  }
}
