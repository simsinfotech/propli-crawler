"use client";

import { useEffect, useState } from "react";
import { getUnreviewedProperties } from "@/lib/queries";
import ReviewCard from "@/components/review/ReviewCard";
import type { CrawledProperty } from "@/lib/types";

export default function ReviewPage() {
  const [properties, setProperties] = useState<CrawledProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "new" | "updated">("all");

  useEffect(() => {
    getUnreviewedProperties().then((data) => {
      setProperties(data);
      setLoading(false);
    });
  }, []);

  const filtered =
    filter === "all"
      ? properties
      : properties.filter((p) => p.match_status === filter);

  const newCount = properties.filter((p) => p.match_status === "new").length;
  const updatedCount = properties.filter((p) => p.match_status === "updated").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Loading review queue...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pt-4 lg:pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Review Queue</h1>
        <p className="text-xs sm:text-sm text-slate-500">{properties.length} pending</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: "all" as const, label: "All", count: properties.length },
          { key: "new" as const, label: "New", count: newCount },
          { key: "updated" as const, label: "Updated", count: updatedCount },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${
              filter === key
                ? "bg-violet-50 text-violet-700 border border-violet-200"
                : "text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 sm:p-12 text-center">
          <p className="text-slate-400">No properties pending review</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((prop) => (
            <ReviewCard key={prop.id} property={prop} />
          ))}
        </div>
      )}
    </div>
  );
}
