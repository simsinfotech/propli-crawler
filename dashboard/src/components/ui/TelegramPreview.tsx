interface TelegramPreviewProps {
  message: string;
}

export default function TelegramPreview({ message }: TelegramPreviewProps) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
          P
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900">Propli Crawler Bot</p>
          <p className="text-xs text-slate-400">bot</p>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 sm:px-4 py-3 text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-w-xl overflow-x-auto break-words">
          {message}
        </div>
      </div>
    </div>
  );
}
