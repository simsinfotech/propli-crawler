import { CrawlReport } from "../types.ts";

const TELEGRAM_CHAR_LIMIT = 4096;

export async function sendTelegramNotification(report: CrawlReport): Promise<boolean> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!botToken || !chatId) {
    console.log("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping Telegram notification");
    return false;
  }

  const fullMessage = buildTelegramMessage(report);
  const chunks = splitMessage(fullMessage, TELEGRAM_CHAR_LIMIT);

  for (let i = 0; i < chunks.length; i++) {
    const success = await sendMessage(botToken, chatId, chunks[i]);
    if (!success) {
      console.error(`Failed to send Telegram chunk ${i + 1}/${chunks.length}`);
      return false;
    }

    // Small delay between chunks
    if (i < chunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return true;
}

async function sendMessage(
  botToken: string,
  chatId: string,
  text: string
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    console.error("Telegram error:", await response.text());
    return false;
  }

  return true;
}

function buildTelegramMessage(report: CrawlReport): string {
  const lines: string[] = [];
  const dateStr = new Date(report.started_at).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  lines.push("🏠 <b>PROPLI CRAWLER REPORT</b>");
  lines.push(`📅 ${dateStr}`);
  lines.push("");
  lines.push(`✅ Sources: ${report.successful_sources}/${report.total_sources}`);
  lines.push(`🏗️ Properties: ${report.total_properties_found}`);
  lines.push(`🆕 New: ${report.new_properties.length}`);
  lines.push(`🔄 Updated: ${report.updated_properties.length}`);
  lines.push(`✔️ Matched: ${report.matched_count}`);

  if (report.new_properties.length > 0) {
    lines.push("");
    lines.push("<b>🆕 NEW PROPERTIES:</b>");
    for (const prop of report.new_properties.slice(0, 15)) {
      let line = `• <b>${escapeHtml(prop.name)}</b>`;
      if (prop.builder_name) line += ` — ${escapeHtml(prop.builder_name)}`;
      if (prop.locality) line += ` (${escapeHtml(prop.locality)})`;
      if (prop.price_display) line += ` | 💰 ${escapeHtml(prop.price_display)}`;
      if (prop.bedrooms) line += ` | 🛏️ ${escapeHtml(prop.bedrooms)}`;
      if (prop.rera_id) line += `\n  ✅ RERA: ${escapeHtml(prop.rera_id)}`;
      lines.push(line);
    }
    if (report.new_properties.length > 15) {
      lines.push(`<i>...+${report.new_properties.length - 15} more</i>`);
    }
  }

  if (report.updated_properties.length > 0) {
    lines.push("");
    lines.push("<b>🔄 UPDATED PROPERTIES:</b>");
    for (const update of report.updated_properties.slice(0, 10)) {
      const changes = Object.entries(update.changes)
        .map(([f, c]) => `${f}: ${c.old} → ${c.new}`)
        .join(", ");
      lines.push(`• <b>${escapeHtml(update.property.name)}</b>: ${escapeHtml(changes)}`);
    }
  }

  // Failed sources
  const failed = report.source_details.filter((s) => s.status === "failed");
  if (failed.length > 0) {
    lines.push("");
    lines.push(`⚠️ <b>Failed:</b> ${failed.length} sources`);
  }

  lines.push("");
  lines.push(`⏱️ Completed in ${(report.duration_ms / 1000).toFixed(1)}s`);

  return lines.join("\n");
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  const lines = text.split("\n");
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > maxLength) {
      if (current) chunks.push(current.trim());
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
