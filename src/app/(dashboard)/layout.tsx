import BottomNav from "@/components/bottom-nav";
import Sidebar from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200 flex flex-col md:flex-row w-full">
      {/* Desktop Sidebar Navigation */}
      <Sidebar />

      {/* Main Content & Navigation Shell */}
      <div className="flex-1 flex flex-col md:pl-64 min-h-screen w-full relative">
        <main className="flex-1 flex flex-col w-full pb-24 md:pb-8 overflow-y-auto">
          {children}
        </main>

        {/* Global Bottom Navigation Bar (Mobile only) */}
        <BottomNav />
      </div>
    </div>
  );
}
