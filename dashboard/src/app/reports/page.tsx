"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, CheckCircle2, ArrowRight } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { getScrapeLogs } from "@/lib/queries";
import { formatDateTime, formatDuration } from "@/lib/formatters";
import type { ScrapeLog } from "@/lib/types";

export default function ReportsPage() {
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getScrapeLogs(50).then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pt-4 lg:pt-0">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Crawl Reports</h1>

      {logs.length === 0 ? (
        <p className="text-slate-400">No crawl runs found.</p>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {logs.map((log) => {
            const successRate = log.total_sources
              ? Math.round(((log.successful_sources ?? 0) / log.total_sources) * 100)
              : 0;

            return (
              <Link
                key={log.id}
                href={`/reports/${log.id}`}
                className="group card p-4 sm:p-5 hover:border-violet-300 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <p className="font-medium text-slate-900 text-sm sm:text-base">
                        {formatDateTime(log.started_at)}
                      </p>
                      <Badge
                        label={log.error ? "Failed" : "Success"}
                        variant={log.error ? "failed" : "success"}
                      />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        {log.successful_sources}/{log.total_sources} sources ({successRate}%)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-teal-500" />
                        {log.duration_ms ? formatDuration(log.duration_ms) : "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm">
                      <span className="text-violet-600">
                        {log.new_properties ?? 0} new
                      </span>
                      <span className="text-amber-600">
                        {log.updated_properties ?? 0} updated
                      </span>
                      <span className="text-blue-600">
                        {log.matched_properties ?? 0} matched
                      </span>
                      <span className="text-slate-400">
                        {log.total_properties_found ?? 0} total
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-violet-500 transition-colors mt-1 shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
