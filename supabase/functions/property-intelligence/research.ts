// v2: Google scraping (no API key needed)

interface SearchResult {
  query: string;
  snippets: string[];
}

// --- Scrape Google Search results (FREE, no API) ---
export async function scrapeGoogleSearch(
  propertyName: string,
  builderName: string
): Promise<SearchResult[]> {
  const queries = [
    `${propertyName} ${builderName} Bangalore review 2025 2026`,
    `${propertyName} RERA Karnataka possession update`,
    `${builderName} delivery track record delays Bangalore`,
  ];

  const allResults: SearchResult[] = [];

  for (const query of queries) {
    try {
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=5`;
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      const html = await response.text();

      // Extract search result snippets from Google's HTML
      // Google wraps results in div structures with BNeawe class
      const snippetRegex =
        /<div[^>]*class="[^"]*BNeawe[^"]*"[^>]*>(.*?)<\/div>/gs;
      let match;
      const snippets: string[] = [];
      while ((match = snippetRegex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]+>/g, "").trim();
        if (text.length > 30 && text.length < 500) {
          snippets.push(text);
        }
      }

      // Also try extracting from other patterns
      const altRegex = /<span[^>]*class="[^"]*st[^"]*"[^>]*>(.*?)<\/span>/gs;
      while ((match = altRegex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]+>/g, "").trim();
        if (text.length > 30 && text.length < 500 && !snippets.includes(text)) {
          snippets.push(text);
        }
      }

      allResults.push({
        query,
        snippets: snippets.slice(0, 5),
      });
    } catch (e) {
      console.error(`  [research] Google search failed for: ${query}`, (e as Error).message);
      allResults.push({ query, snippets: [] });
    }

    // 2s delay between searches to avoid rate limiting
    await new Promise((r) => setTimeout(r, 2000));
  }

  return allResults;
}
