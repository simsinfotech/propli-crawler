import { CrawlSource } from "./types.ts";

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

const CRAWL_TIMEOUT_MS = 15_000;
const MAX_HTML_LENGTH = 20_000;

function cleanHtml(html: string): string {
  let cleaned = html;
  // Remove script tags and content
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, "");
  // Remove style tags and content
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  // Remove SVG tags and content
  cleaned = cleaned.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  // Remove noscript tags
  cleaned = cleaned.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  // Remove nav, footer, header, form elements
  cleaned = cleaned.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  cleaned = cleaned.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  cleaned = cleaned.replace(/<header[\s\S]*?<\/header>/gi, "");
  cleaned = cleaned.replace(/<form[\s\S]*?<\/form>/gi, "");
  cleaned = cleaned.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  // Remove all HTML attributes except href, src, alt, title
  cleaned = cleaned.replace(/<(\w+)\s+[^>]*>/g, (_match, tag) => `<${tag}>`);
  // Remove empty tags
  cleaned = cleaned.replace(/<(\w+)>\s*<\/\1>/g, "");
  // Collapse whitespace
  cleaned = cleaned.replace(/\s+/g, " ");
  // Trim to max length
  return cleaned.slice(0, MAX_HTML_LENGTH);
}

export async function crawlUrl(
  source: CrawlSource
): Promise<{ html: string; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT_MS);

  try {
    const response = await fetch(source.url, {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        html: "",
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    return { html: cleanHtml(html) };
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "AbortError"
        ? `Timeout after ${CRAWL_TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : "Unknown error";
    return { html: "", error: message };
  } finally {
    clearTimeout(timeout);
  }
}
