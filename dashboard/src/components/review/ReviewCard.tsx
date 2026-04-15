import type { CrawledProperty } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import ChangesDisplay from "./ChangesDisplay";

interface ReviewCardProps {
  property: CrawledProperty;
}

export default function ReviewCard({ property }: ReviewCardProps) {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">{property.name}</h3>
          {property.builder_name && (
            <p className="text-sm text-slate-500">{property.builder_name}</p>
          )}
        </div>
        <Badge label={property.match_status} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
        {property.locality && <span>{property.locality}</span>}
        {property.price_display && <span>{property.price_display}</span>}
        {property.bedrooms && <span>{property.bedrooms}</span>}
        {property.property_type && <span className="capitalize">{property.property_type}</span>}
      </div>

      {property.rera_id && (
        <div className="text-xs">
          <Badge label={`RERA: ${property.rera_id}`} variant="registered" />
        </div>
      )}

      {property.match_status === "updated" && property.changes_detected && (
        <div className="pt-2 border-t border-slate-200">
          <p className="text-xs font-medium text-amber-600 mb-2">Changes Detected</p>
          <ChangesDisplay changes={property.changes_detected} />
        </div>
      )}

      <div className="text-xs text-slate-400">
        {property.source_label} &middot; {new Date(property.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
      </div>
    </div>
  );
}
