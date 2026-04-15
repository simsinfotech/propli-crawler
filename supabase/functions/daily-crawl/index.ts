import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { CRAWL_SOURCES } from "../_shared/sources.ts";
import { crawlUrl } from "../_shared/crawler.ts";
import { extractWithClaude } from "../_shared/extractor.ts";
import { compareWithDatabase } from "../_shared/comparator.ts";
import { generateReport } from "../_shared/reporter.ts";
import { insertCrawledProperties, saveCrawlLog, promoteNewProperties, updateExistingProperties } from "../_shared/db.ts";
import { sendTelegramNotification } from "../_shared/notifiers/telegram.ts";
import {
  CrawlReport,
  CrawlResult,
  ExtractedProperty,
  SourceDetail,
} from "../_shared/types.ts";

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000; // 1s delay — minimal to stay within timeout

serve(async (_req: Request) => {
  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();

  console.log(`[${runId}] Starting crawl at ${startedAt}`);

  try {
    // Step 1: Crawl all sources in batches
    const crawlResults = await crawlInBatches(CRAWL_SOURCES, BATCH_SIZE);

    // Step 2: Collect and deduplicate properties
    const allProperties = deduplicateProperties(crawlResults);
    console.log(`[${runId}] Total unique properties: ${allProperties.length}`);

    // Step 3: Save all crawled properties to staging
    const sourceDetails: SourceDetail[] = crawlResults.map((r) => ({
      url: r.source.url,
      label: r.source.label,
      status: r.error ? ("failed" as const) : ("success" as const),
      properties_found: r.properties.length,
      error: r.error,
      duration_ms: r.duration_ms,
    }));

    // Step 4: Compare with database
    const comparison = await compareWithDatabase(allProperties);
    console.log(
      `[${runId}] Comparison: ${comparison.new_properties.length} new, ${comparison.updated_properties.length} updated, ${comparison.matched_properties.length} matched`
    );

    // Step 5: Save to staging table with match status
    await saveCrawledToStaging(
      runId,
      comparison,
      crawlResults
    );

    // Step 5b: Promote new properties to master table & apply updates
    await promoteNewProperties(comparison.new_properties);
    await updateExistingProperties(comparison.updated_properties);

    // Step 6: Build report
    const finishedAt = new Date().toISOString();
    const durationMs =
      new Date(finishedAt).getTime() - new Date(startedAt).getTime();

    const report: CrawlReport = {
      run_id: runId,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: durationMs,
      total_sources: CRAWL_SOURCES.length,
      successful_sources: crawlResults.filter((r) => !r.error).length,
      failed_sources: crawlResults.filter((r) => r.error).length,
      total_properties_found: allProperties.length,
      new_properties: comparison.new_properties,
      updated_properties: comparison.updated_properties,
      matched_count: comparison.matched_properties.length,
      source_details: sourceDetails,
    };

    const reportText = generateReport(report);
    console.log(`[${runId}] Report:\n${reportText}`);

    // Step 7: Send Telegram notification
    const telegramResult = await sendTelegramNotification(report).catch(() => false);

    const notificationsSent = {
      telegram: telegramResult,
    };

    // Step 8: Save crawl log
    await saveCrawlLog({
      id: runId,
      started_at: startedAt,
      finished_at: finishedAt,
      duration_ms: durationMs,
      total_sources: CRAWL_SOURCES.length,
      successful_sources: report.successful_sources,
      failed_sources: report.failed_sources,
      total_properties_found: allProperties.length,
      new_properties: comparison.new_properties.length,
      updated_properties: comparison.updated_properties.length,
      matched_properties: comparison.matched_properties.length,
      source_details: sourceDetails,
      notifications_sent: notificationsSent,
    });

    console.log(`[${runId}] Crawl completed in ${durationMs}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        duration_ms: durationMs,
        properties_found: allProperties.length,
        new: comparison.new_properties.length,
        updated: comparison.updated_properties.length,
        matched: comparison.matched_properties.length,
        notifications: notificationsSent,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error(`[${runId}] Crawl failed:`, errorMsg);

    // Try to save error log
    try {
      const finishedAt = new Date().toISOString();
      await saveCrawlLog({
        id: runId,
        started_at: startedAt,
        finished_at: finishedAt,
        duration_ms:
          new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
        total_sources: CRAWL_SOURCES.length,
        successful_sources: 0,
        failed_sources: CRAWL_SOURCES.length,
        total_properties_found: 0,
        new_properties: 0,
        updated_properties: 0,
        matched_properties: 0,
        source_details: [],
        notifications_sent: { telegram: false },
        error: errorMsg,
      });
    } catch {
      // Best effort logging
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

async function crawlInBatches(
  sources: typeof CRAWL_SOURCES,
  batchSize: number
): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];

  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    console.log(
      `Crawling batch ${Math.floor(i / batchSize) + 1}: ${batch.map((s) => s.label).join(", ")}`
    );

    const batchResults = await Promise.all(
      batch.map(async (source) => {
        const start = Date.now();
        try {
          const { html, error } = await crawlUrl(source);
          if (error || !html) {
            return {
              source,
              properties: [],
              error: error || "Empty response",
              duration_ms: Date.now() - start,
            };
          }

          const properties = await extractWithClaude(html, source);
          console.log(
            `  ${source.label}: ${properties.length} properties extracted`
          );

          return {
            source,
            properties,
            duration_ms: Date.now() - start,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          console.error(`  ${source.label}: FAILED - ${msg}`);
          return {
            source,
            properties: [],
            error: msg,
            duration_ms: Date.now() - start,
          };
        }
      })
    );

    results.push(...batchResults);

    // Delay between batches to avoid rate limits
    if (i + batchSize < sources.length) {
      console.log(`  Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`);
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return results;
}

function deduplicateProperties(
  results: CrawlResult[]
): ExtractedProperty[] {
  const seen = new Map<string, ExtractedProperty>();

  for (const result of results) {
    for (const prop of result.properties) {
      const key = `${prop.name.toLowerCase().trim()}|${(prop.builder_name || "").toLowerCase()}|${(prop.locality || "").toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, prop);
      }
    }
  }

  return Array.from(seen.values());
}

async function saveCrawledToStaging(
  runId: string,
  comparison: Awaited<ReturnType<typeof compareWithDatabase>>,
  crawlResults: CrawlResult[]
): Promise<void> {
  // Save new properties
  if (comparison.new_properties.length > 0) {
    const sourceUrl = findSourceUrl(comparison.new_properties[0], crawlResults);
    const sourceLabel = findSourceLabel(comparison.new_properties[0], crawlResults);
    await insertCrawledProperties(
      comparison.new_properties,
      runId,
      sourceUrl,
      sourceLabel,
      "new"
    );
  }

  // Save updated properties
  for (const update of comparison.updated_properties) {
    const sourceUrl = findSourceUrl(update.property, crawlResults);
    const sourceLabel = findSourceLabel(update.property, crawlResults);
    await insertCrawledProperties(
      [update.property],
      runId,
      sourceUrl,
      sourceLabel,
      "updated",
      update.matched_id,
      update.changes
    );
  }

  // Save matched properties
  if (comparison.matched_properties.length > 0) {
    const sourceUrl = findSourceUrl(comparison.matched_properties[0], crawlResults);
    const sourceLabel = findSourceLabel(comparison.matched_properties[0], crawlResults);
    await insertCrawledProperties(
      comparison.matched_properties,
      runId,
      sourceUrl,
      sourceLabel,
      "matched"
    );
  }
}

function findSourceUrl(
  prop: ExtractedProperty,
  results: CrawlResult[]
): string {
  for (const result of results) {
    if (result.properties.some((p) => p.name === prop.name)) {
      return result.source.url;
    }
  }
  return "";
}

function findSourceLabel(
  prop: ExtractedProperty,
  results: CrawlResult[]
): string {
  for (const result of results) {
    if (result.properties.some((p) => p.name === prop.name)) {
      return result.source.label;
    }
  }
  return "";
}
