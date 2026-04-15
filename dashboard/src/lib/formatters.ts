import type { ScrapeLog, CrawledProperty } from "./types";

export function formatPrice(min: number | null, max: number | null): string {
  if (!min && !max) return "N/A";
  const fmt = (v: number) => {
    if (v >= 10_000_000) {
      const cr = v / 10_000_000;
      return `${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
    }
    if (v >= 100_000) {
      const l = v / 100_000;
      return `${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`;
    }
    return v.toLocaleString("en-IN");
  };
  if (min && max && min !== max) return `₹${fmt(min)} - ${fmt(max)}`;
  return `₹${fmt(min || max!)}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Reconstruct the same Telegram message from a scrape_log + its crawled_properties
export function buildTelegramPreview(
  log: ScrapeLog,
  crawledProperties: CrawledProperty[]
): string {
  const lines: string[] = [];
  const dateStr = new Date(log.started_at).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  const newProps = crawledProperties.filter((p) => p.match_status === "new");
  const updatedProps = crawledProperties.filter((p) => p.match_status === "updated");

  lines.push("\u{1F3E0} PROPLI CRAWLER REPORT");
  lines.push(`\u{1F4C5} ${dateStr}`);
  lines.push("");
  lines.push(`\u2705 Sources: ${log.successful_sources}/${log.total_sources}`);
  lines.push(`\u{1F3D7}\uFE0F Properties: ${log.total_properties_found}`);
  lines.push(`\u{1F195} New: ${newProps.length}`);
  lines.push(`\u{1F504} Updated: ${updatedProps.length}`);
  lines.push(`\u2714\uFE0F Matched: ${log.matched_properties}`);

  if (newProps.length > 0) {
    lines.push("");
    lines.push("\u{1F195} NEW PROPERTIES:");
    for (const prop of newProps.slice(0, 15)) {
      let line = `\u2022 ${prop.name}`;
      if (prop.builder_name) line += ` \u2014 ${prop.builder_name}`;
      if (prop.locality) line += ` (${prop.locality})`;
      if (prop.price_display) line += ` | \u{1F4B0} ${prop.price_display}`;
      if (prop.bedrooms) line += ` | \u{1F6CF}\uFE0F ${prop.bedrooms}`;
      if (prop.rera_id) line += `\n  \u2705 RERA: ${prop.rera_id}`;
      lines.push(line);
    }
    if (newProps.length > 15) {
      lines.push(`...+${newProps.length - 15} more`);
    }
  }

  if (updatedProps.length > 0) {
    lines.push("");
    lines.push("\u{1F504} UPDATED PROPERTIES:");
    for (const update of updatedProps.slice(0, 10)) {
      const changes = update.changes_detected
        ? Object.entries(update.changes_detected)
            .map(([f, c]) => `${f}: ${String(c.old)} \u2192 ${String(c.new)}`)
            .join(", ")
        : "";
      lines.push(`\u2022 ${update.name}: ${changes}`);
    }
  }

  const failed = log.source_details?.filter((s) => s.status === "failed") ?? [];
  if (failed.length > 0) {
    lines.push("");
    lines.push(`\u26A0\uFE0F Failed: ${failed.length} sources`);
  }

  lines.push("");
  lines.push(`\u23F1\uFE0F Completed in ${((log.duration_ms ?? 0) / 1000).toFixed(1)}s`);

  return lines.join("\n");
}
