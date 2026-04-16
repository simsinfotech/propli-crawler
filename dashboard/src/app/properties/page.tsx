"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import DataTable, { type Column } from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import { getProperties, getDistinctLocalities, getDistinctBuilders, getDistinctStatuses, getDistinctPropertyTypes } from "@/lib/queries";
import { formatPrice, formatDate } from "@/lib/formatters";
import type { Property } from "@/lib/types";

const PAGE_SIZE = 25;

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export default function PropertiesPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-32"><div className="animate-pulse text-slate-400">Loading properties...</div></div>}>
      <PropertiesPage />
    </Suspense>
  );
}

function PropertiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // All state derived from URL params
  const page = Number(searchParams.get("page")) || 1;
  const search = searchParams.get("q") || "";
  const propertyType = searchParams.get("type") || "";
  const status = searchParams.get("status") || "";
  const rera = searchParams.get("rera") || "";
  const locality = searchParams.get("locality") || "";
  const builder = searchParams.get("builder") || "";
  const grade = searchParams.get("grade") || "";

  const [data, setData] = useState<Property[]>([]);
  const [count, setCount] = useState(0);
  const [localities, setLocalities] = useState<string[]>([]);
  const [builders, setBuilders] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);

  // Keep search input in sync when URL changes (back/forward)
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Debounce search input to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        updateParams({ q: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper to update URL params (single source of truth)
  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    // Reset to page 1 when filters change (not page itself)
    if (!("page" in updates)) {
      params.delete("page");
    }
    const qs = params.toString();
    router.push(`/properties${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [searchParams, router]);

  const setPage = useCallback((p: number | ((prev: number) => number)) => {
    const newPage = typeof p === "function" ? p(page) : p;
    updateParams({ page: newPage > 1 ? String(newPage) : "" });
  }, [page, updateParams]);

  useEffect(() => {
    getDistinctLocalities().then(setLocalities);
    getDistinctBuilders().then(setBuilders);
    getDistinctStatuses().then(setStatuses);
    getDistinctPropertyTypes().then(setPropertyTypes);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await getProperties({
      search: search || undefined,
      propertyType: propertyType || undefined,
      status: status || undefined,
      rera: rera || undefined,
      locality: locality || undefined,
      builder: builder || undefined,
      grade: grade || undefined,
      page,
      pageSize: PAGE_SIZE,
    });
    setData(result.data);
    setCount(result.count);
    setLoading(false);
  }, [search, propertyType, status, rera, locality, builder, grade, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(count / PAGE_SIZE);

  const columns: Column<Property>[] = [
    {
      key: "name",
      header: "Property",
      render: (row) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-slate-900">{row.name}</p>
          {row.builder_name && <p className="text-xs text-slate-400">{row.builder_name}</p>}
        </div>
      ),
    },
    {
      key: "locality",
      header: "Locality",
      render: (row) => <span className="text-slate-600">{row.locality ?? "—"}</span>,
    },
    {
      key: "price",
      header: "Price",
      render: (row) => (
        <span className="text-slate-700">{row.price_display || formatPrice(row.price_min, row.price_max)}</span>
      ),
    },
    {
      key: "property_type",
      header: "Type",
      render: (row) => (
        <span className="capitalize text-slate-600">{row.property_type ?? "—"}</span>
      ),
    },
    {
      key: "bedrooms",
      header: "BHK",
      render: (row) => <span className="text-slate-600">{row.bedrooms ?? "—"}</span>,
    },
    {
      key: "rera_status",
      header: "RERA",
      render: (row) => {
        if (row.rera_id) return <span className="text-xs font-medium text-emerald-600">Yes</span>;
        if (row.rera_status === "unknown" || row.rera_status === null) return <span className="text-xs font-medium text-slate-400">—</span>;
        return <span className="text-xs font-medium text-red-500">No</span>;
      },
    },
    {
      key: "builder_grade",
      header: "Grade",
      render: (row) => (
        row.builder_grade
          ? <Badge label={`Grade ${row.builder_grade}`} variant={`grade_${row.builder_grade.toLowerCase()}`} />
          : <span className="text-slate-300">—</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        row.status ? <Badge label={row.status} /> : <span className="text-slate-300">—</span>
      ),
    },
    {
      key: "created_at",
      header: "Added",
      render: (row) => <span className="text-slate-400 text-xs">{formatDate(row.created_at)}</span>,
    },
  ];

  const inputCls =
    "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400";
  const selectCls = `w-full sm:w-auto ${inputCls}`;

  return (
    <div className="space-y-4 sm:space-y-6 pt-4 lg:pt-0 pb-8">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Properties</h1>

      {/* Filters */}
      <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, builder, locality..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`w-full pl-9 pr-3 ${inputCls}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <select value={propertyType} onChange={(e) => updateParams({ type: e.target.value })} className={selectCls}>
            <option value="">All Types</option>
            {propertyTypes.map((t) => (
              <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => updateParams({ status: e.target.value })} className={selectCls}>
            <option value="">All Status</option>
            {statuses.map((s) => (
              <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select value={rera} onChange={(e) => updateParams({ rera: e.target.value })} className={selectCls}>
            <option value="">All RERA</option>
            <option value="registered">Registered</option>
            <option value="not_registered">Not Registered</option>
          </select>
          <select value={grade} onChange={(e) => updateParams({ grade: e.target.value })} className={selectCls}>
            <option value="">All Grades</option>
            <option value="A">Grade A</option>
            <option value="B">Grade B</option>
            <option value="C">Grade C</option>
          </select>
          <select value={builder} onChange={(e) => updateParams({ builder: e.target.value })} className={selectCls}>
            <option value="">All Builders</option>
            {builders.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select value={locality} onChange={(e) => updateParams({ locality: e.target.value })} className={selectCls}>
            <option value="">All Localities</option>
            {localities.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-pulse text-slate-400">Loading properties...</div>
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => router.push(`/properties/${row.id}`)}
          />

          <div className="flex items-center justify-between text-sm">
            <p className="text-slate-500 text-xs sm:text-sm">
              {count > 0 ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, count)} of ${count}` : "0 results"}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-900 hover:border-violet-300 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {getPageNumbers(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`dot-${i}`} className="px-1 text-slate-400 text-xs">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`min-w-[32px] h-8 rounded-lg border text-xs sm:text-sm font-medium transition-colors ${
                      p === page
                        ? "border-violet-400 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-violet-300"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-900 hover:border-violet-300 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
