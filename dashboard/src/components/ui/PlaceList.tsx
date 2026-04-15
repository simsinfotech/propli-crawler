"use client";

import { MapPin, Star } from "lucide-react";
import type { PlaceResult } from "@/lib/types";

interface PlaceListProps {
  title: string;
  icon?: React.ReactNode;
  places: PlaceResult[];
  emptyMessage?: string;
}

export default function PlaceList({ title, icon, places, emptyMessage = "None found nearby" }: PlaceListProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="ml-auto text-xs text-slate-400">{places.length} found</span>
      </div>
      {places.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2">
          {places.map((place, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <MapPin className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 truncate">{place.name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{place.distance_km} km</span>
                  {place.rating && (
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {place.rating}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
