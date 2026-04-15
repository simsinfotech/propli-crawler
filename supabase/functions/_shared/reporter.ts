import { CrawlReport, ExtractedProperty } from "./types.ts";

export function generateReport(report: CrawlReport): string {
  const lines: string[] = [];

  lines.push("=== PROPLI PROPERTY CRAWLER REPORT ===");
  lines.push(`Date: ${new Date(report.started_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`);
  lines.push(`Duration: ${(report.duration_ms / 1000).toFixed(1)}s`);
  lines.push("");

  // Stats
  lines.push("--- CRAWL STATS ---");
  lines.push(`Sources: ${report.successful_sources}/${report.total_sources} successful`);
  lines.push(`Properties found: ${report.total_properties_found}`);
  lines.push(`New: ${report.new_properties.length}`);
  lines.push(`Updated: ${report.updated_properties.length}`);
  lines.push(`Matched: ${report.matched_count}`);
  lines.push("");

  // New properties
  if (report.new_properties.length > 0) {
    lines.push("--- NEW PROPERTIES ---");
    for (const prop of report.new_properties) {
      lines.push(formatProperty(prop));
    }
    lines.push("");
  }

  // Updated properties
  if (report.updated_properties.length > 0) {
    lines.push("--- UPDATED PROPERTIES ---");
    for (const update of report.updated_properties) {
      lines.push(formatProperty(update.property));
      for (const [field, change] of Object.entries(update.changes)) {
        lines.push(`  ${field}: ${change.old} → ${change.new}`);
      }
    }
    lines.push("");
  }

  // Failed sources
  const failed = report.source_details.filter((s) => s.status === "failed");
  if (failed.length > 0) {
    lines.push("--- FAILED SOURCES ---");
    for (const src of failed) {
      lines.push(`${src.label}: ${src.error}`);
    }
    lines.push("");
  }

  lines.push("=== END REPORT ===");
  return lines.join("\n");
}

function formatProperty(prop: ExtractedProperty): string {
  const parts = [
    `• ${prop.name}`,
    prop.builder_name ? `by ${prop.builder_name}` : null,
    prop.locality ? `@ ${prop.locality}` : null,
  ].filter(Boolean);

  const details = [
    prop.price_display,
    prop.bedrooms,
    prop.property_type,
    prop.rera_id ? `RERA: ${prop.rera_id}` : null,
  ].filter(Boolean);

  let line = parts.join(" ");
  if (details.length > 0) {
    line += `\n  ${details.join(" | ")}`;
  }
  return line;
}
