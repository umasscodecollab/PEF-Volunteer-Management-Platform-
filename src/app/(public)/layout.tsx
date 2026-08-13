import React from "react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center items-center p-4 sm:p-6 transition-colors duration-200">
      <main className="w-full max-w-lg mx-auto flex flex-col">
        {children}
      </main>
    </div>
  );
}
