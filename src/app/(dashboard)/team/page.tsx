"use client";

import { useState } from "react";
import RosterTab from "./roster-tab";
import ApprovalsTab from "./approvals-tab";

export default function TeamHub() {
  const [activeTab, setActiveTab] = useState<"roster" | "approvals">("roster");

  return (
    <div className="flex flex-col gap-6 px-5 py-6 pb-24 animate-fade-in max-w-lg mx-auto w-full">
      <header className="flex flex-col">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Team Hub
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Manage your center's volunteers and requests
        </p>
      </header>

      {/* Top Tab Toggle */}
      <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50">
        <button
          onClick={() => setActiveTab("roster")}
          className={`flex-1 py-3 px-3 text-sm font-bold rounded-lg transition-all min-h-[48px] ${
            activeTab === "roster"
              ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Roster
        </button>
        <button
          onClick={() => setActiveTab("approvals")}
          className={`flex-1 py-3 px-3 text-sm font-bold rounded-lg transition-all min-h-[48px] ${
            activeTab === "approvals"
              ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-zinc-200/50 dark:border-zinc-700/50"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Approvals
        </button>
      </div>

      <div className="mt-2">
        {activeTab === "roster" && <RosterTab />}
        {activeTab === "approvals" && <ApprovalsTab />}
      </div>
    </div>
  );
}
