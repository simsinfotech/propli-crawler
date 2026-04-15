"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import Badge from "@/components/ui/Badge";
import TelegramPreview from "@/components/ui/TelegramPreview";
import { getScrapeLog, getCrawledPropertiesByRun } from "@/lib/queries";
import { formatDateTime, formatDuration, buildTelegramPreview } from "@/lib/formatters";
import type { ScrapeLog, CrawledProperty, SourceDetail } from "@/lib/types";

export default function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const [log, setLog] = useState<ScrapeLog | null>(null);
  const [crawled, setCrawled] = useState<CrawledProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getScrapeLog(runId), getCrawledPropertiesByRun(runId)]).then(
      ([scrapeLog, properties]) => {
        setLog(scrapeLog);
        setCrawled(properties);
        setLoading(false);
      }
    );
  }, [runId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Loading report...</div>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="space-y-4 pt-4 lg:pt-0">
        <Link href="/reports" className="flex items-center gap-1 text-sm text-slate-500 hover:text-violet-600 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </Link>
        <p className="text-slate-400">Run not found.</p>
      </div>
    );
  }

  const telegramMessage = buildTelegramPreview(log, crawled);
  const newProps = crawled.filter((p) => p.match_status === "new");

  return (
    <div className="space-y-4 sm:space-y-6 pt-4 lg:pt-0">
      <Link href="/reports" className="flex items-center gap-1 text-sm text-slate-500 hover:text-violet-600 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Reports
      </Link>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <h1 className="text-lg sm:text-2xl font-bold text-slate-900">
          Crawl Run — {formatDateTime(log.started_at)}
        </h1>
        <Badge
          label={log.error ? "Failed" : "Success"}
          variant={log.error ? "failed" : "success"}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-slate-500">Sources</p>
          <p className="text-base sm:text-lg font-semibold text-slate-900">
            {log.successful_sources}/{log.total_sources}
          </p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-slate-500">Duration</p>
          <p className="text-base sm:text-lg font-semibold text-slate-900">
            {log.duration_ms ? formatDuration(log.duration_ms) : "—"}
          </p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-slate-500">Properties Found</p>
          <p className="text-base sm:text-lg font-semibold text-slate-900">{log.total_properties_found}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs text-violet-500">New</p>
          <p className="text-base sm:text-lg font-semibold text-violet-600">{newProps.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div>
          <h2 className="text-sm font-medium text-slate-500 mb-3">Telegram Message Preview</h2>
          <TelegramPreview message={telegramMessage} />
        </div>

        <div>
          <h2 className="text-sm font-medium text-slate-500 mb-3">Source Details</h2>
          <div className="card divide-y divide-slate-100 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
            {(log.source_details ?? []).map((src: SourceDetail, i: number) => (
              <div key={i} className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 gap-2 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  {src.status === "success" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-slate-700 truncate">{src.label}</p>
                    {src.error && (
                      <p className="text-xs text-red-500 truncate">{src.error}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-xs text-slate-400">
                  <span>{src.properties_found} props</span>
                  <span className="hidden sm:inline">{formatDuration(src.duration_ms)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {log.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 sm:p-4">
          <p className="text-sm font-medium text-red-700">Error</p>
          <p className="text-xs sm:text-sm text-red-600 mt-1">{log.error}</p>
        </div>
      )}
    </div>
  );
}
