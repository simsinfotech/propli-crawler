const colors: Record<string, string> = {
  new: "bg-emerald-50 text-emerald-700 border-emerald-200",
  matched: "bg-blue-50 text-blue-700 border-blue-200",
  updated: "bg-amber-50 text-amber-700 border-amber-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  pending: "bg-slate-50 text-slate-600 border-slate-200",
  registered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  not_registered: "bg-red-50 text-red-700 border-red-200",
  unknown: "bg-slate-50 text-slate-600 border-slate-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  upcoming: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  "grade_a": "bg-violet-50 text-violet-700 border-violet-200",
  "grade_b": "bg-blue-50 text-blue-700 border-blue-200",
  "grade_c": "bg-amber-50 text-amber-700 border-amber-200",
};

interface BadgeProps {
  label: string;
  variant?: string;
}

export default function Badge({ label, variant }: BadgeProps) {
  const key = variant ?? label.toLowerCase().replace(/\s+/g, "_");
  const cls = colors[key] ?? colors.pending;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
