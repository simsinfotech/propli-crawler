interface ChangesDisplayProps {
  changes: Record<string, { old: unknown; new: unknown }>;
}

export default function ChangesDisplay({ changes }: ChangesDisplayProps) {
  const entries = Object.entries(changes);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      {entries.map(([field, { old: oldVal, new: newVal }]) => (
        <div key={field} className="text-sm">
          <span className="text-slate-500 capitalize">{field.replace(/_/g, " ")}:</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="line-through text-red-600 bg-red-50 px-1.5 py-0.5 rounded text-xs">
              {String(oldVal ?? "—")}
            </span>
            <span className="text-slate-400">&rarr;</span>
            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-xs">
              {String(newVal ?? "—")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
