"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Users, Clock, Flame, AlertCircle, Loader2 } from "lucide-react";
import { User } from "@supabase/supabase-js";
import ActiveCheckInBanner from "@/components/active-check-in-banner";

interface Profile {
  id: string;
  email: string | null;
  role: string;
  assigned_center_id: string | null;
  created_at?: string;
  centers?: {
    name: string;
  } | {
    name: string;
  }[] | null;
}

export default function CenterLeadDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUser(user);

        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("*, centers(name)")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error(
            "Error fetching user profile:",
            profileError.message,
            profileError.details,
            profileError.code
          );
        } else {
          console.log("Fetched User Profile (page):", profileData);
          setProfile(profileData);
        }
      } catch (err) {
        console.error("Unexpected error on dashboard mount:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndProfile();
  }, [router]);

  // Static placeholder data for demonstration
  const stats = {
    fillRate: 82,
    filledSlots: 18,
    totalSlots: 22,
    activeSessions: 3,
    totalSessions: 4,
    presentVolunteers: 12,
  };

  const getDisplayName = () => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.user_metadata?.name) return user.user_metadata.name;
    if (user?.email) {
      const prefix = user.email.split("@")[0];
      return prefix
        .split(".")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
    return "User";
  };

  const centersData = profile?.centers;
  const centerName = Array.isArray(centersData)
    ? (centersData[0]?.name || "No Center Assigned")
    : (centersData?.name || "No Center Assigned");
  const roleName = profile?.role || "Volunteer";

  if (loading) {
    return (
      <div className="flex flex-col gap-6 px-5 py-6 animate-pulse select-none">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="h-7 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-lg mt-2" />
          <div className="h-4 w-36 bg-zinc-200 dark:bg-zinc-800 rounded-md mt-1" />
        </header>

        {/* Primary Stat Card Skeleton */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-150 dark:border-zinc-800 shadow-sm h-36 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <div className="h-3.5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            </div>
            <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-3 rounded-full mt-2" />
        </div>

        {/* Supporting Context Card Skeletons */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-150 dark:border-zinc-800 shadow-sm h-28" />
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-150 dark:border-zinc-800 shadow-sm h-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in">
      {/* Active Check-In Notification Banner */}
      <ActiveCheckInBanner />

      {/* Warm Greeting Hero */}
      <header className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 uppercase tracking-wider">
            {roleName}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-55 mt-2">
          Welcome back, {getDisplayName()}!
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {centerName}
        </p>
      </header>

      {/* Primary Stat Card: Session Fill Rate */}
      <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-150 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold tracking-wider text-zinc-500 dark:text-zinc-400 uppercase">
              Session Fill Rate
            </span>
            <span className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-1.5">
              {stats.fillRate}%
            </span>
          </div>
          <div className="p-3 bg-emerald-55 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Flame className="w-6 h-6 stroke-[2.2]" />
          </div>
        </div>

        {/* High-Fidelity Progress Indicator */}
        <div className="mt-4">
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-3 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-400 dark:to-teal-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.fillRate}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 mt-2.5 font-medium">
            <span>
              {stats.filledSlots} of {stats.totalSlots} slots filled
            </span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {stats.totalSlots - stats.filledSlots} empty
            </span>
          </div>
        </div>
      </section>

      {/* Supporting Context Section */}
      <section className="grid grid-cols-2 gap-4">
        {/* Session Count Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-150 dark:border-zinc-800 shadow-sm flex flex-col justify-between min-h-[100px]">
          <div className="flex items-center justify-between text-zinc-400">
            <Clock className="w-5 h-5 stroke-[1.8]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400">
              Sessions
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">
              {stats.activeSessions}/{stats.totalSessions}
            </span>
            <p className="text-[11px] text-zinc-550 dark:text-zinc-400 mt-0.5">
              Completed today
            </p>
          </div>
        </div>

        {/* Active Volunteers Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-150 dark:border-zinc-800 shadow-sm flex flex-col justify-between min-h-[100px]">
          <div className="flex items-center justify-between text-zinc-400">
            <Users className="w-5 h-5 stroke-[1.8]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-550 dark:text-zinc-400">
              Present
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">
              {stats.presentVolunteers}
            </span>
            <p className="text-[11px] text-zinc-550 dark:text-zinc-400 mt-0.5">
              Volunteers active
            </p>
          </div>
        </div>
      </section>

      {/* Accessibility Alert banner */}
      <div className="mt-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl p-3.5 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 stroke-[2]" />
        <div className="flex flex-col gap-0.5">
          <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Low Attendance Warning
          </h4>
          <p className="text-xs text-amber-700/90 dark:text-amber-400/90 leading-relaxed font-medium">
            2 volunteers haven&apos;t checked in for the upcoming 4:00 PM session.
          </p>
        </div>
      </div>
    </div>
  );
}
