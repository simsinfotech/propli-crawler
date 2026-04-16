"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  GraduationCap,
  Hospital,
  Train,
  ShoppingBag,
  CheckCircle,
  AlertTriangle,
  Image as ImageIcon,
  Brain,
  Navigation,
  Tag,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getPropertyById } from "@/lib/queries";
import { formatPrice, formatDate } from "@/lib/formatters";
import type { Property, PlaceResult } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import ScoreRing from "@/components/ui/ScoreRing";
import PlaceList from "@/components/ui/PlaceList";
import CommuteTable from "@/components/ui/CommuteTable";

export default function PropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    async function load() {
      const id = params.id as string;
      const data = await getPropertyById(id);
      setProperty(data);
      setLoading(false);
    }
    load();
  }, [params.id]);

  // If user landed here directly (shared link / typed URL / new tab), there's no
  // browser history entry to go back to — swipe-back / browser-back would exit the
  // dashboard. Inject /properties as the previous history entry so back returns
  // the user to the listing instead of leaving the app.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SESSION_KEY = "propli-nav-touched";
    const isFirstLoadInSession = sessionStorage.getItem(SESSION_KEY) !== "1";
    sessionStorage.setItem(SESSION_KEY, "1");
    if (isFirstLoadInSession) {
      const currentUrl = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", "/properties");
      window.history.pushState(null, "", currentUrl);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Loading property...</div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="space-y-4 pt-4 lg:pt-0">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-center py-16 text-slate-400">Property not found</div>
      </div>
    );
  }

  const hasIntelligence = !!property.intelligence_updated_at;
  const images = property.images_scraped || [];
  const analysis = property.ai_buying_analysis;
  const research = property.ai_project_research;
  const commutes = property.commute_data || {};
  const schools = property.nearby_schools || [];
  const hospitals = property.nearby_hospitals || [];
  const metro = property.nearby_metro || [];
  const entertainment = property.nearby_entertainment;
  const malls = (entertainment?.malls || []) as PlaceResult[];

  return (
    <div className="space-y-4 sm:space-y-6 pt-2 lg:pt-0 pb-4 lg:pb-8">
      {/* Back button — go back if we have history within app, else navigate explicitly */}
      <button
        onClick={() => {
          if (typeof window !== "undefined" && window.history.length > 1 && document.referrer.includes(window.location.host)) {
            router.back();
          } else {
            router.push("/properties");
          }
        }}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Properties
      </button>

      {/* === Header Card === */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {property.builder_grade && (
                <Badge label={`Grade ${property.builder_grade}`} variant={`grade_${property.builder_grade.toLowerCase()}`} />
              )}
              {property.status && <Badge label={property.status} />}
              {property.rera_status && <Badge label={property.rera_status} />}
              {property.property_type && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">
                  {property.property_type}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{property.name}</h1>
            {property.builder_name && (
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> {property.builder_name}
              </p>
            )}
            {property.locality && (
              <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {property.locality}, {property.city || "Bangalore"}
              </p>
            )}

            {/* Key stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div>
                <p className="text-xs text-slate-400">Price</p>
                <p className="text-sm font-semibold text-slate-900">
                  {property.price_display || formatPrice(property.price_min, property.price_max)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">BHK</p>
                <p className="text-sm font-semibold text-slate-900">{property.bedrooms || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Area</p>
                <p className="text-sm font-semibold text-slate-900">
                  {property.area_min
                    ? `${property.area_min}${property.area_max && property.area_max !== property.area_min ? `-${property.area_max}` : ""} ${property.area_unit || "sqft"}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Possession</p>
                <p className="text-sm font-semibold text-slate-900">{property.possession_date || "—"}</p>
              </div>
            </div>

            {property.rera_id && (
              <p className="text-xs text-slate-400 mt-3">RERA: {property.rera_id}</p>
            )}
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Added {formatDate(property.created_at)}
              {property.intelligence_updated_at && (
                <> &middot; Intelligence updated {formatDate(property.intelligence_updated_at)}</>
              )}
            </p>
          </div>

          {/* Score Ring */}
          {property.location_score != null && (
            <div className="shrink-0">
              <ScoreRing score={property.location_score} size={130} label="Location Score" />
            </div>
          )}
        </div>
      </div>

      {!hasIntelligence && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Brain className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-500">Intelligence Not Yet Available</h3>
          <p className="text-xs text-slate-400 mt-1">
            The intelligence pipeline runs every Sunday at 3 AM. This property will be processed soon.
          </p>
        </div>
      )}

      {/* === Image Gallery === */}
      {images.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-slate-400" /> Property Images
          </h2>
          <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-100 mb-3">
            <img
              src={images[activeImage].url}
              alt={images[activeImage].description || property.name}
              className="w-full h-full object-cover"
            />
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setActiveImage((i) => (i === 0 ? images.length - 1 : i - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setActiveImage((i) => (i === images.length - 1 ? 0 : i + 1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === activeImage ? "bg-white" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-colors ${
                  i === activeImage ? "border-violet-500" : "border-transparent"
                }`}
              >
                <img src={img.url} alt={img.description || ""} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* === AI Buying Analysis === */}
      {analysis && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-500" /> AI Buying Analysis
          </h2>

          {/* Overall rating + one liner */}
          {analysis.overall_rating && (
            <div className="mb-4">
              <span className="text-xs text-slate-400">Overall Rating</span>
              <p className="text-lg font-bold text-slate-900">{analysis.overall_rating}</p>
              {analysis.one_liner && (
                <p className="text-sm text-slate-600 italic mt-1">&ldquo;{analysis.one_liner}&rdquo;</p>
              )}
            </div>
          )}

          {/* Score Breakdown */}
          {analysis.score_breakdown && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {Object.entries(analysis.score_breakdown).map(([key, val]) => (
                <div key={key} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400 capitalize">{key}</p>
                  <p className="text-xl font-bold text-slate-900">{val.score}<span className="text-sm text-slate-400">/25</span></p>
                  <p className="text-xs text-slate-500 mt-0.5">{val.note}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recommendation */}
          {analysis.recommendation && (
            <div className="rounded-lg bg-violet-50 border border-violet-100 p-4 mb-4">
              <p className="text-sm text-violet-900">{analysis.recommendation}</p>
            </div>
          )}

          {/* Why Buy & Watch Out */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {analysis.why_buy && analysis.why_buy.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Why Buy
                </h3>
                <ul className="space-y-1">
                  {analysis.why_buy.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-2">
                      <span className="text-green-500 shrink-0">+</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.watch_out && analysis.watch_out.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Watch Out
                </h3>
                <ul className="space-y-1">
                  {analysis.watch_out.map((c: string, i: number) => (
                    <li key={i} className="text-sm text-slate-600 flex gap-2">
                      <span className="text-amber-500 shrink-0">!</span> {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Additional Analysis Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {analysis.price_verdict && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Price Verdict</p>
                <p className="text-sm font-semibold text-slate-900">{analysis.price_verdict}</p>
              </div>
            )}
            {analysis.invest_or_live && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Best For</p>
                <p className="text-sm font-semibold text-slate-900">{analysis.invest_or_live}</p>
              </div>
            )}
            {analysis.appreciation_outlook && (
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-400">Appreciation</p>
                <p className="text-sm font-semibold text-slate-900">{analysis.appreciation_outlook}</p>
              </div>
            )}
          </div>

          {/* Best for / Not suitable */}
          <div className="flex flex-wrap gap-2">
            {analysis.best_for && (
              <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
                Best for: {analysis.best_for}
              </span>
            )}
            {analysis.not_suitable_for?.map((tag: string, i: number) => (
              <span key={i} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* === Buyer Scorecard === */}
      {analysis?.buyer_scorecard && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-emerald-500" /> Buyer Scorecard
          </h2>
          <div className="space-y-3">
            {(
              [
                ["investment", "Investment"],
                ["self_use", "Self-Use"],
                ["value_for_money", "Value for Money"],
                ["appreciation", "Appreciation"],
                ["growth_factor", "Growth Factor"],
              ] as const
            ).map(([key, label]) => {
              const item = (analysis.buyer_scorecard as Record<string, { score: number; reason: string }>)?.[key];
              if (!item) return null;
              const score = item.score;
              const color = score >= 7 ? "bg-green-500" : score >= 4 ? "bg-amber-500" : "bg-red-500";
              const textColor = score >= 7 ? "text-green-700" : score >= 4 ? "text-amber-700" : "text-red-700";
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700">{label}</span>
                    <span className={`text-sm font-bold ${textColor}`}>{score}/10</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                    <div
                      className={`h-2 rounded-full ${color}`}
                      style={{ width: `${score * 10}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">{item.reason}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === Location & Commute === */}
      {hasIntelligence && (
        <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Location Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Navigation className="h-4 w-4 text-slate-400" /> Location Summary
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <SummaryItem label="Schools" count={schools.length} icon={<GraduationCap className="h-4 w-4 text-blue-500" />} />
              <SummaryItem label="Hospitals" count={hospitals.length} icon={<Hospital className="h-4 w-4 text-red-500" />} />
              <SummaryItem label="Metro" count={metro.length} icon={<Train className="h-4 w-4 text-purple-500" />} />
              <SummaryItem label="Malls" count={malls.length} icon={<ShoppingBag className="h-4 w-4 text-amber-500" />} />
            </div>

            {/* Commute summary from analysis */}
            {analysis?.commute_summary && (
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-1">
                {analysis.commute_summary.best_for_commute_to && (
                  <p className="text-xs text-slate-600">
                    <span className="text-green-600 font-medium">Best commute:</span>{" "}
                    {analysis.commute_summary.best_for_commute_to}
                  </p>
                )}
                {analysis.commute_summary.worst_commute && (
                  <p className="text-xs text-slate-600">
                    <span className="text-red-600 font-medium">Worst commute:</span>{" "}
                    {analysis.commute_summary.worst_commute}
                  </p>
                )}
                {analysis.commute_summary.peak_traffic_note && (
                  <p className="text-xs text-slate-500 italic">{analysis.commute_summary.peak_traffic_note}</p>
                )}
              </div>
            )}
          </div>

          {/* Commute Table */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Navigation className="h-4 w-4 text-slate-400" /> Commute Times
            </h2>
            <CommuteTable commutes={commutes} />
          </div>
        </div>
      )}

      {/* === Nearby Places Grid === */}
      {hasIntelligence && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Nearby Places</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <PlaceList title="Schools" places={schools} icon={<GraduationCap className="h-4 w-4 text-blue-500" />} />
            <PlaceList title="Hospitals" places={hospitals} icon={<Hospital className="h-4 w-4 text-red-500" />} />
            <PlaceList title="Metro Stations" places={metro} icon={<Train className="h-4 w-4 text-purple-500" />} />
            <PlaceList title="Shopping Malls" places={malls} icon={<ShoppingBag className="h-4 w-4 text-amber-500" />} />
          </div>
        </div>
      )}

      {/* === AI Research === */}
      {research && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Brain className="h-4 w-4 text-slate-400" /> AI Project Research
          </h2>

          <div className="space-y-4">
            {/* Builder & Project Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {research.builder_reputation && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">Builder Tier</p>
                  <p className="text-sm font-semibold text-slate-900">{research.builder_reputation}</p>
                </div>
              )}
              {research.delivery_track_record && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">Delivery Record</p>
                  <p className="text-sm font-semibold text-slate-900">{research.delivery_track_record}</p>
                </div>
              )}
              {research.construction_status && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">Construction</p>
                  <p className="text-sm font-semibold text-slate-900">{research.construction_status}</p>
                </div>
              )}
              {research.buyer_sentiment && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">Buyer Sentiment</p>
                  <p className="text-sm font-semibold text-slate-900">{research.buyer_sentiment}</p>
                </div>
              )}
            </div>

            {/* Known Issues */}
            {research.known_issues && research.known_issues !== "null" && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">Known Issues</p>
                <p className="text-sm text-amber-800">{research.known_issues}</p>
              </div>
            )}

            {/* Google Search Snippets (fallback when research is array of search results) */}
            {Array.isArray(research) && research.length > 0 && (
              <div className="space-y-3">
                {research.map((result: { query: string; snippets: string[] }, i: number) => (
                  result.snippets?.length > 0 && (
                    <div key={i}>
                      <p className="text-xs text-slate-400 mb-1">{result.query}</p>
                      <ul className="space-y-1">
                        {result.snippets.map((s: string, j: number) => (
                          <li key={j} className="text-sm text-slate-600">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Amenities === */}
      {property.amenities && property.amenities.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-slate-400" /> Amenities
          </h2>
          <div className="flex flex-wrap gap-2">
            {property.amenities.map((amenity, i) => (
              <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                {amenity}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryItem({
  label,
  count,
  icon,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-900">{count}</p>
      </div>
    </div>
  );
}
