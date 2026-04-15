// v2: Builder website scraping + Google Images fallback (no paid API)

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUILDER_URLS: Record<string, string> = {
  "Godrej Properties": "https://www.godrejproperties.com",
  "Prestige Group": "https://www.prestigeconstructions.com",
  "Sobha Limited": "https://www.sobha.com",
  "Sobha": "https://www.sobha.com",
  "Brigade Group": "https://www.brigadegroup.com",
  "Brigade": "https://www.brigadegroup.com",
  "Puravankara": "https://www.puravankara.com",
  "Salarpuria Sattva": "https://www.salarpuriasattva.com",
  "Shriram Properties": "https://www.shriramproperties.com",
  "Provident Housing": "https://www.providenthousing.com",
  "Assetz Property": "https://www.assetzproperty.com",
  "Birla Estates": "https://www.birlaestates.com",
  "Birla": "https://www.birlaestates.com",
  "Tata Housing": "https://www.tatahousing.in",
  "Mahindra Lifespaces": "https://www.mahindralifespaces.com",
  "Embassy Group": "https://www.embassygroup.com",
  "Total Environment": "https://www.totalenvironment.com",
  "Rohan Builders": "https://www.rohanbuilders.com",
  "Vajram Group": "https://www.vajramgroup.com",
  "Century Real Estate": "https://www.centuryrealestate.in",
  "Sumadhura Group": "https://www.sumadhuragroup.com",
  "DS Max": "https://www.dsmaxproperties.com",
};

const IMAGE_EXTRACTION_PROMPT = `You are an image extraction assistant for real estate websites. Extract ALL property-related image URLs from the HTML.

IMPORTANT: Real estate websites lazy-load images. Look in ALL of these attributes:
- src, data-src, data-lazy-src, data-lazy, data-original, data-image
- data-bg, data-srcset, srcset (extract the largest resolution URL)
- content attribute in <meta property="og:image"> tags
- style="background-image: url(...)"
- <script type="application/ld+json"> blocks with image arrays
- Any JSON inside <script> tags that contains image URLs
- Slider/carousel container elements

For each image return a JSON object:
{
  "url": "full absolute URL (prepend domain if relative)",
  "type": "exterior|interior|floor_plan|amenity|aerial|render|location_map|elevation",
  "description": "brief description"
}

SKIP these images:
- URLs containing: logo, icon, sprite, pixel, tracking, analytics, favicon, social, share, arrow, button, placeholder, loading, transparent, 1x1, blank, badge, star, rating, whatsapp, facebook, twitter, linkedin, youtube, play-store, app-store
- Images smaller than 200px (if width/height detectable)
- Duplicate URLs

PRIORITIZE in this order:
1. Exterior building renders/photos
2. Floor plan images
3. Amenity photos (pool, gym, clubhouse, garden)
4. Interior renders
5. Aerial/drone views
6. Location/site maps

Return ONLY a JSON array. No markdown. No explanation. Maximum 15 images.`;

interface ScrapedImage {
  url: string;
  original_url: string;
  type: string;
  description: string;
}

// --- Fetch builder's project page ---
async function fetchBuilderPage(property: {
  name: string;
  builder_name?: string | null;
  source_url?: string | null;
}): Promise<string | null> {
  const baseUrl = property.builder_name
    ? BUILDER_URLS[property.builder_name] || null
    : null;
  const slug = property.name?.toLowerCase().replace(/\s+/g, "-");

  const urlsToTry = [
    property.source_url,
    baseUrl ? `${baseUrl}/${slug}` : null,
    baseUrl ? `${baseUrl}/projects/${slug}` : null,
    baseUrl ? `${baseUrl}/bangalore/${slug}` : null,
    baseUrl || null,
  ].filter(Boolean) as string[];

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const html = await response.text();
        if (html.length > 5000) return html;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// --- Extract images using Claude Haiku ---
async function extractImagesWithClaude(
  propertyName: string,
  html: string
): Promise<{ url: string; type: string; description: string }[]> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return [];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: IMAGE_EXTRACTION_PROMPT,
        messages: [
          {
            role: "user",
            content: `Extract images for property: ${propertyName}\n\n${html.substring(0, 40000)}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "[]";
    const cleaned = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error(`  [images] Claude extraction failed:`, (e as Error).message);
    return [];
  }
}

// --- Google Images fallback (no API key needed) ---
async function fetchImagesFromGoogle(
  propertyName: string,
  builderName: string
): Promise<string[]> {
  const queries = [
    `${propertyName} ${builderName} Bangalore exterior`,
    `${propertyName} ${builderName} floor plan`,
  ];

  const allImages: string[] = [];

  for (const q of queries) {
    try {
      const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=isch&ijn=0`;
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const html = await response.text();

      // Extract image URLs from Google Images HTML
      const regex1 = /\["(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)","?\d+,"?\d+\]/g;
      let match;
      while ((match = regex1.exec(html)) !== null) {
        const imgUrl = match[1];
        if (
          !imgUrl.includes("google") &&
          !imgUrl.includes("gstatic") &&
          !imgUrl.includes("youtube")
        ) {
          allImages.push(imgUrl);
        }
        if (allImages.length >= 10) break;
      }

      // Fallback: extract from "ou" field
      const regex2 = /"ou":"(https?:\/\/[^"]+)"/g;
      while ((match = regex2.exec(html)) !== null) {
        const imgUrl = match[1];
        if (!imgUrl.includes("google") && !imgUrl.includes("gstatic")) {
          allImages.push(imgUrl);
        }
        if (allImages.length >= 10) break;
      }
    } catch (e) {
      console.error(`  [images] Google image search failed:`, (e as Error).message);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  return [...new Set(allImages)].slice(0, 10);
}

// --- Download and store images in Supabase Storage ---
async function downloadAndStoreImages(
  propertyId: string,
  imageUrls: { url: string; type?: string; description?: string }[],
  supabase: SupabaseClient
): Promise<ScrapedImage[]> {
  const stored: ScrapedImage[] = [];

  for (let i = 0; i < Math.min(imageUrls.length, 15); i++) {
    const imgData = imageUrls[i];
    try {
      const response = await fetch(imgData.url, {
        headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("image")) continue;

      const blob = await response.arrayBuffer();
      if (blob.byteLength < 10000) continue; // skip tiny placeholders
      if (blob.byteLength > 5 * 1024 * 1024) continue; // skip > 5MB

      const ext = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
        ? "webp"
        : "jpg";

      const fileName = `properties/${propertyId}/${i}_${imgData.type || "photo"}.${ext}`;

      const { error } = await supabase.storage
        .from("property-images")
        .upload(fileName, blob, { contentType: `image/${ext}`, upsert: true });

      if (error) continue;

      const {
        data: { publicUrl },
      } = supabase.storage.from("property-images").getPublicUrl(fileName);

      stored.push({
        url: publicUrl,
        original_url: imgData.url,
        type: imgData.type || "exterior",
        description: imgData.description || "",
      });
    } catch (e) {
      console.error(`  [images] Download failed for image ${i}:`, (e as Error).message);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return stored;
}

// --- Main entry point ---
export async function scrapeImages(
  property: { id: string; name: string; builder_name?: string | null; source_url?: string | null },
  supabase: SupabaseClient
): Promise<ScrapedImage[]> {
  // Method 1: Try builder website
  console.log(`  [images] Trying builder website for ${property.name}...`);
  const builderHtml = await fetchBuilderPage(property);

  let images: { url: string; type: string; description: string }[] = [];
  if (builderHtml) {
    images = await extractImagesWithClaude(property.name, builderHtml);
    console.log(`  [images] Claude extracted ${images.length} images from builder site`);
  }

  // Method 2: Google Images fallback
  if (images.length === 0) {
    console.log(`  [images] Falling back to Google Images...`);
    const googleUrls = await fetchImagesFromGoogle(
      property.name,
      property.builder_name || ""
    );
    images = googleUrls.map((url) => ({ url, type: "exterior", description: "" }));
    console.log(`  [images] Google Images found ${images.length} images`);
  }

  if (images.length === 0) return [];

  // Method 3: Download and store
  const stored = await downloadAndStoreImages(property.id, images, supabase);
  console.log(`  [images] Stored ${stored.length} images for ${property.name}`);
  return stored;
}
