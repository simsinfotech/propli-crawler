"use client";

import type { CommuteResult } from "@/lib/types";

interface CommuteTableProps {
  commutes: Record<string, CommuteResult>;
}

export default function CommuteTable({ commutes }: CommuteTableProps) {
  const entries = Object.entries(commutes).sort(
    (a, b) => a[1].drive_time_min - b[1].drive_time_min
  );

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">No commute data available</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Destination</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">Distance</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">Drive Time</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-500 uppercase">Peak Traffic</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map(([hub, data]) => (
            <tr key={hub} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 text-slate-700 font-medium">{hub}</td>
              <td className="px-4 py-2.5 text-right text-slate-600">{data.distance_km} km</td>
              <td className="px-4 py-2.5 text-right text-slate-600">
                {data.drive_time_min > 0 ? `${data.drive_time_min} min` : "—"}
              </td>
              <td className="px-4 py-2.5 text-right">
                {data.traffic_time_min > 0 ? (
                  <span
                    className={
                      data.traffic_time_min > 45
                        ? "text-red-600 font-medium"
                        : data.traffic_time_min > 30
                        ? "text-amber-600"
                        : "text-green-600"
                    }
                  >
                    {data.traffic_time_min} min
                  </span>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
