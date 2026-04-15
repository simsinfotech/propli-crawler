import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}

export default function StatCard({ title, value, icon: Icon, color = "text-violet-600" }: StatCardProps) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs sm:text-sm text-slate-500">{title}</p>
        <div className={`rounded-lg p-1.5 bg-slate-50 ${color}`}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
      <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-semibold text-slate-900 truncate">{value}</p>
    </div>
  );
}
