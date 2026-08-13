import BottomNav from "@/components/bottom-nav";
import Sidebar from "@/components/sidebar";
import Image from "next/image";

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
        {/* Mobile Top Header Branding */}
        <header className="md:hidden sticky top-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 p-0.5 flex items-center justify-center flex-shrink-0 shadow-xs">
              <Image
                src="/logo.jpeg"
                alt="Pratyagra Education Foundation Logo"
                width={32}
                height={32}
                className="w-full h-full object-contain rounded"
                priority
              />
            </div>
            <span className="font-extrabold text-xs tracking-wide text-zinc-900 dark:text-zinc-100 truncate">
              Pratyagra Education Foundation
            </span>
          </div>
        </header>

        <main className="flex-1 flex flex-col w-full pb-24 md:pb-8 overflow-y-auto">
          {children}
        </main>

        {/* Global Bottom Navigation Bar (Mobile only) */}
        <BottomNav />
      </div>
    </div>
  );
}
