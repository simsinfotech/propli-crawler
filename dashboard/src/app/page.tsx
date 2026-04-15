"use client";

import { useEffect, useState } from "react";
import { Building2, Calendar, ClipboardCheck, Sparkles } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import {
  getPropertyCount,
  getScrapeLogs,
  getPendingReviewCount,
  getNewThisWeekCount,
  getPropertyTypeDistribution,
} from "@/lib/queries";
import { formatDateTime, formatDuration } from "@/lib/formatters";
import type { ScrapeLog } from "@/lib/types";

const PIE_COLORS = ["#8b5cf6", "#06b6d4", "#10b981"];

export default function OverviewPage() {
  const [totalProperties, setTotalProperties] = useState(0);
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [pendingReview, setPendingReview] = useState(0);
  const [newThisWeek, setNewThisWeek] = useState(0);
  const [typeDistribution, setTypeDistribution] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getPropertyCount(),
      getScrapeLogs(10),
      getPendingReviewCount(),
      getNewThisWeekCount(),
      getPropertyTypeDistribution(),
    ]).then(([count, scrapeLogs, pending, newCount, types]) => {
      setTotalProperties(count);
      setLogs(scrapeLogs);
      setPendingReview(pending);
      setNewThisWeek(newCount);
      setTypeDistribution(types);
      setLoading(false);
    });
  }, []);

  const lastCrawl = logs[0];

  const crawlTrends = logs
    .slice(0, 8)
    .reverse()
    .map((log) => ({
      date: new Date(log.started_at).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
      }),
      new: log.new_properties ?? 0,
      updated: log.updated_properties ?? 0,
      matched: log.matched_properties ?? 0,
    }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pt-4 lg:pt-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Propli Crawler Dashboard</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total Properties" value={totalProperties} icon={Building2} />
        <StatCard
          title="Last Crawl"
          value={lastCrawl ? formatDateTime(lastCrawl.started_at) : "Never"}
          icon={Calendar}
          color="text-teal-600"
        />
        <StatCard title="Pending Review" value={pendingReview} icon={ClipboardCheck} color="text-amber-600" />
        <StatCard title="New This Week" value={newThisWeek} icon={Sparkles} color="text-emerald-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 card p-4 sm:p-5">
          <h2 className="text-sm font-medium text-slate-500 mb-4">Crawl Trends</h2>
          {crawlTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={crawlTrends}>
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} width={30} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    color: "#1e293b",
                    fontSize: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                />
                <Bar dataKey="new" name="New" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="updated" name="Updated" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="matched" name="Matched" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400 text-sm">No crawl data yet</p>
          )}
        </div>

        <div className="card p-4 sm:p-5">
          <h2 className="text-sm font-medium text-slate-500 mb-4">Property Types</h2>
          {typeDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={typeDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                  >
                    {typeDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      color: "#1e293b",
                      fontSize: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {typeDistribution.map((t, i) => (
                  <div key={t.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-slate-600 capitalize">{t.name}</span>
                    </div>
                    <span className="text-slate-900 font-medium">{t.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm">No data yet</p>
          )}
        </div>
      </div>

      {/* Recent Runs */}
      <div className="card p-4 sm:p-5">
        <h2 className="text-sm font-medium text-slate-500 mb-4">Recent Crawl Runs</h2>

        {/* Mobile: card layout */}
        <div className="space-y-3 sm:hidden">
          {logs.map((log) => (
            <div key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">{formatDateTime(log.started_at)}</span>
                <Badge
                  label={log.error ? "Failed" : "Success"}
                  variant={log.error ? "failed" : "success"}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Sources: {log.successful_sources}/{log.total_sources}</span>
                <span>Props: {log.total_properties_found}</span>
                <span>{log.duration_ms ? formatDuration(log.duration_ms) : "—"}</span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-violet-600">{log.new_properties ?? 0} new</span>
                <span className="text-amber-600">{log.updated_properties ?? 0} updated</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table layout */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Sources</th>
                <th className="pb-2 pr-4">Properties</th>
                <th className="pb-2 pr-4">New</th>
                <th className="pb-2 pr-4">Updated</th>
                <th className="pb-2 pr-4">Duration</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 pr-4 text-slate-700">{formatDateTime(log.started_at)}</td>
                  <td className="py-2.5 pr-4 text-slate-500">
                    {log.successful_sources}/{log.total_sources}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-500">{log.total_properties_found}</td>
                  <td className="py-2.5 pr-4">
                    <span className="text-violet-600">{log.new_properties ?? 0}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="text-amber-600">{log.updated_properties ?? 0}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-500">
                    {log.duration_ms ? formatDuration(log.duration_ms) : "—"}
                  </td>
                  <td className="py-2.5">
                    <Badge
                      label={log.error ? "Failed" : "Success"}
                      variant={log.error ? "failed" : "success"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
