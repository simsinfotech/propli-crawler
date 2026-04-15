import Sidebar from "./Sidebar";

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar />
      <main className="flex-1 pt-14 px-4 pb-6 sm:px-6 lg:ml-56 lg:pt-0 lg:p-8">
        {children}
      </main>
    </div>
  );
}
