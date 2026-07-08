export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full max-w-md mx-auto bg-zinc-50 dark:bg-zinc-950 flex flex-col relative shadow-2xl md:border-x md:border-zinc-200 dark:md:border-zinc-800 transition-colors duration-200">
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col w-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
