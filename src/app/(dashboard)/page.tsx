"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Users, Clock, Flame, AlertCircle, ArrowRight, ClipboardList, ShieldAlert, CheckCircle, Megaphone, Camera } from "lucide-react";
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
  status?: string;
  id_verification_status?: string;
  consent_accepted?: boolean;
}

export default function CenterLeadDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUser(user);

        let profileData = null;
        const { data: existingProfile, error: profileError } = await supabase
          .from("users")
          .select("*, centers(name)")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error(
            "Error fetching user profile:",
            profileError.message
          );
        } else if (existingProfile) {
          profileData = existingProfile;
        } else {
          console.error("User record missing from public.users table.");
        }

        if (profileData) {
          console.log("Fetched User Profile (page):", profileData);
          setProfile(profileData as unknown as Profile);

          // Fetch pending approvals count for Center Lead / Admin
          if (profileData.role === "Center Lead" || profileData.role === "Admin") {
            if (profileData.assigned_center_id) {
              const { count, error: countError } = await supabase
                .from("session_enrollments")
                .select("id, sessions!inner(center_id)", { count: "exact", head: true })
                .eq("status", "Pending")
                .eq("sessions.center_id", profileData.assigned_center_id);

              if (!countError && count !== null) {
                setPendingApprovalsCount(count);
              }
            }
          }

          // Fetch Recent Announcements
          let annQuery = supabase
            .from("announcements")
            .select("id, title, target_role, created_at")
            .order("created_at", { ascending: false })
            .limit(2);
            
          if (profileData.role === "Volunteer") {
            annQuery = annQuery.in("target_role", ["All", "Volunteer"]);
          }
          
          const { data: annData } = await annQuery;
          if (annData) {
            setAnnouncements(annData);
          }
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

  const onboardingStatus = profile?.status || "Applied";

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
    <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in pb-20">
      {/* Active Check-In Notification Banner */}
      {roleName === "Volunteer" && <ActiveCheckInBanner />}

      {/* Warm Greeting Hero */}
      <header className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 uppercase tracking-wider">
            {roleName}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-2">
          Welcome back, {getDisplayName()}!
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {centerName}
        </p>
      </header>

      {/* Recent Announcements Widget */}
      {announcements.length > 0 && (
        <section className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
              <Megaphone className="w-4 h-4" />
              Announcements
            </h2>
            <button
              onClick={() => router.push("/workspace")}
              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:underline flex items-center gap-1 min-h-[32px] px-2 active:scale-95 transition-all"
            >
              View All
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                onClick={() => router.push("/workspace")}
                className="group flex flex-col gap-1 p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950/50 dark:hover:bg-zinc-800/50 cursor-pointer active:scale-[0.98] transition-all"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 leading-tight">
                    {ann.title}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-500">
                  {new Date(ann.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {roleName === "Volunteer" ? (
        /* VOLUNTEER SPECIFIC VIEW */
        <div className="flex flex-col gap-6">
          {onboardingStatus !== "Active" ? (
            /* ONBOARDING ALERT BANNER */
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
              
              <div className="flex items-start gap-3">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
                  <ShieldAlert className="w-6 h-6 stroke-[1.8]" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Onboarding Required
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                    Your volunteer status is currently <span className="font-semibold text-amber-600 dark:text-amber-400">{onboardingStatus}</span>. Please complete document uploads and clear checks to activate your profile.
                  </p>
                </div>
              </div>

              <button
                onClick={() => router.push("/onboarding")}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-650 text-white active:scale-[0.98] py-3.5 rounded-xl font-bold text-xs min-h-[48px] transition-all shadow-md shadow-amber-500/10"
              >
                <span>Continue Onboarding</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* FULLY ACTIVE VOLUNTEER CARD */
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-450">
                <CheckCircle className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Active Volunteer Account
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Your onboarding process is fully completed and verified!
                </p>
              </div>
            </div>
          )}

          {/* Tactical Action Buttons for Volunteer */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                if (onboardingStatus !== "Active") {
                  alert("Onboarding required: Please complete your onboarding documents before joining sessions.");
                  router.push("/onboarding");
                } else {
                  router.push("/scanner");
                }
              }}
              className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[110px] text-left active:scale-[0.97] transition-all cursor-pointer"
            >
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-455 rounded-xl self-start">
                <Camera className="w-5 h-5" />
              </div>
              <div className="mt-2">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Scan to Check-In</span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 block font-medium">Record attendance</span>
              </div>
            </button>

            <button
              onClick={() => {
                if (onboardingStatus !== "Active") {
                  alert("Onboarding required: Please complete your onboarding documents to check schedules.");
                  router.push("/onboarding");
                } else {
                  router.push("/schedule");
                }
              }}
              className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[110px] text-left active:scale-[0.97] transition-all cursor-pointer"
            >
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-455 rounded-xl self-start">
                <Clock className="w-5 h-5" />
              </div>
              <div className="mt-2">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Weekly Schedule</span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 block font-medium">View timings</span>
              </div>
            </button>
          </div>
        </div>
      ) : (
        /* CENTER LEAD & ADMIN VIEW */
        <div className="flex flex-col gap-6">
          {/* Pending Approvals Alert Banner */}
          {pendingApprovalsCount > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-250/50 dark:border-amber-900/30 rounded-2xl p-5 shadow-sm flex flex-col gap-4 relative overflow-hidden animate-fade-in">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-start gap-3">
                <div className="p-3 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-xl shrink-0">
                  <AlertCircle className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Pending Shift Approvals
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                    You have <span className="font-semibold text-amber-600 dark:text-amber-405">{pendingApprovalsCount}</span> pending volunteer shift signup request{pendingApprovalsCount === 1 ? "" : "s"} awaiting your review.
                  </p>
                </div>
              </div>

              <button
                onClick={() => router.push("/team")}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-650 text-white active:scale-[0.98] py-3.5 rounded-xl font-bold text-xs min-h-[48px] transition-all shadow-md shadow-amber-500/10 cursor-pointer"
              >
                <span>Review Pending Shifts</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Primary Stat Card: Session Fill Rate */}
          <section className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-150 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all duration-200 hover:shadow-md">
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
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Flame className="w-6 h-6 stroke-[2.2]" />
              </div>
            </div>

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

          {/* Quick Roster Management Action Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
            
            <div className="flex items-start gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-450 shrink-0">
                <ClipboardList className="w-6 h-6 stroke-[1.8]" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Volunteer Roster & Onboarding
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                  Review uploaded NDA / ID / Consent documents, toggle background checks, and promote volunteers along onboarding pipeline stages.
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/team")}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.98] py-3.5 rounded-xl font-bold text-xs min-h-[48px] transition-all shadow-md shadow-emerald-600/10"
            >
              <span>Manage Volunteers Roster</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Supporting Context Section */}
          <section className="grid grid-cols-2 gap-4">
            {/* Session Count Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-150 dark:border-zinc-800 shadow-sm flex flex-col justify-between min-h-[100px]">
              <div className="flex items-center justify-between text-zinc-400">
                <Clock className="w-5 h-5 stroke-[1.8]" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Sessions
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {stats.activeSessions}/{stats.totalSessions}
                </span>
                <p className="text-[11px] text-zinc-550 dark:text-zinc-400 mt-0.5 font-medium">
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
                <p className="text-[11px] text-zinc-550 dark:text-zinc-400 mt-0.5 font-medium">
                  Volunteers active
                </p>
              </div>
            </div>
          </section>

          {/* Accessibility Alert banner */}
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl p-3.5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-450 shrink-0 mt-0.5 stroke-[2]" />
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
      )}
    </div>
  );
}
