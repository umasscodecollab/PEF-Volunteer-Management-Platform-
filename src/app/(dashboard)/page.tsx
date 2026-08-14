"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Users, Clock, Flame, AlertCircle, ArrowRight, ClipboardList, ShieldAlert, CheckCircle, Megaphone, BookOpen, Calendar, AlertTriangle, CheckCircle2, X, Sparkles, GraduationCap } from "lucide-react";
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
  const [upcomingClasses, setUpcomingClasses] = useState<any[]>([]);
  const [openSessions, setOpenSessions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"my-classes" | "open-sessions">("my-classes");
  
  // Claim Modal States
  const [claimingSession, setClaimingSession] = useState<any | null>(null);
  const [claimAllSeries, setClaimAllSeries] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const [stats, setStats] = useState({
    fillRate: 0,
    filledSlots: 0,
    totalSlots: 0,
    activeSessions: 0,
    totalSessions: 0,
    presentVolunteers: 0,
  });

  const fetchVolunteerSessions = async (userId: string, centerId: string | null) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfDayISO = startOfToday.toISOString();

    // Fetch sessions where current user has an approved enrollment ("My Upcoming Classes")
    const { data: userEnrollments, error: facError } = await supabase
      .from("session_enrollments")
      .select("session_id, sessions!inner(id, topic, start_time, end_time, capacity, centers(name))")
      .eq("user_id", userId)
      .eq("status", "Approved");

    if (facError) {
      console.error("Error fetching facilitator sessions:", facError);
    } else if (userEnrollments) {
      const myClasses = userEnrollments
        .map((e: any) => e.sessions)
        .filter((s: any) => s && new Date(s.start_time) >= startOfToday)
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      setUpcomingClasses(myClasses);
    }

    // Fetch open sessions for volunteer's center (0 approved enrollments & user not enrolled)
    let sessionQuery = supabase
      .from("sessions")
      .select(`
        id, topic, start_time, end_time, capacity, batch_id, is_urgent, center_id, centers(name),
        session_enrollments (
          user_id,
          status
        )
      `)
      .gte("start_time", startOfDayISO)
      .order("is_urgent", { ascending: false })
      .order("start_time", { ascending: true });

    if (centerId) {
      sessionQuery = sessionQuery.eq("center_id", centerId);
    }

    const { data: sessionsData, error: openError } = await sessionQuery;

    if (openError) {
      console.error("Error fetching open sessions:", openError.message);
    } else if (sessionsData) {
      const unclaimedSessions = sessionsData.filter((s: any) => {
        const rosters = s.session_enrollments || [];
        const approvedCount = rosters.filter((r: any) => r.status === "Approved").length;
        const isUserEnrolled = rosters.some((r: any) => r.user_id === userId);
        const capacity = s.capacity || 1;
        return approvedCount < capacity && !isUserEnrolled;
      });

      // Ensure urgent vacancies strictly sort at the very top
      unclaimedSessions.sort((a: any, b: any) => {
        if (a.is_urgent && !b.is_urgent) return -1;
        if (!a.is_urgent && b.is_urgent) return 1;
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      });

      setOpenSessions(unclaimedSessions);
    }
  };

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

              // Fetch KPI Stats for today
              const startOfDay = new Date();
              startOfDay.setHours(0, 0, 0, 0);
              const endOfDay = new Date();
              endOfDay.setHours(23, 59, 59, 999);

              const { data: todaySessions, error: sessionsError } = await supabase
                .from("sessions")
                .select("id, start_time, end_time, capacity, session_enrollments(id, status), attendance(id, status)")
                .eq("center_id", profileData.assigned_center_id)
                .gte("start_time", startOfDay.toISOString())
                .lte("start_time", endOfDay.toISOString());

              if (!sessionsError && todaySessions) {
                const totalSessions = todaySessions.length;
                let activeSessions = 0;
                let totalSlots = 0;
                let filledSlots = 0;
                let presentVolunteers = 0;

                const now = new Date();

                todaySessions.forEach(session => {
                  if (new Date(session.end_time) < now) {
                    activeSessions += 1;
                  }
                  totalSlots += session.capacity || 0;
                  
                  const approvedEnrollments = session.session_enrollments?.filter((e: any) => e.status === "Approved")?.length || 0;
                  filledSlots += approvedEnrollments;

                  const present = session.attendance?.filter((a: any) => a.status === "Present")?.length || 0;
                  presentVolunteers += present;
                });

                const fillRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

                setStats({
                  fillRate,
                  filledSlots,
                  totalSlots,
                  activeSessions,
                  totalSessions,
                  presentVolunteers
                });
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

          // Fetch Volunteer sessions (My Classes & Open Sessions)
          await fetchVolunteerSessions(user.id, profileData.assigned_center_id);
        }
      } catch (err) {
        console.error("Unexpected error on dashboard mount:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndProfile();
  }, [router]);

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

  const handleClaimSubmit = async () => {
    if (!claimingSession || !user) return;
    setIsClaiming(true);
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      if (claimAllSeries && claimingSession.batch_id) {
        // Fetch all future sessions in the series
        const { data: seriesSessions, error: seriesErr } = await supabase
          .from("sessions")
          .select("id, capacity, session_enrollments(user_id, status)")
          .eq("batch_id", claimingSession.batch_id)
          .gte("start_time", startOfToday.toISOString());

        if (seriesErr) {
          toast.error(`Failed to fetch recurring series: ${seriesErr.message}`);
        } else if (seriesSessions) {
          const inserts: any[] = [];
          for (const s of seriesSessions) {
            const rosters = s.session_enrollments || [];
            const approvedCount = rosters.filter((r: any) => r.status === "Approved").length;
            const isEnrolled = rosters.some((r: any) => r.user_id === user.id);
            const cap = s.capacity || 1;
            if (approvedCount < cap && !isEnrolled) {
              inserts.push({
                session_id: s.id,
                user_id: user.id,
                status: "Pending",
              });
            }
          }

          if (inserts.length > 0) {
            const { error: insErr } = await supabase
              .from("session_enrollments")
              .insert(inserts);

            if (insErr) {
              toast.error(`Failed to request series sessions: ${insErr.message}`);
            } else {
              toast.success("Successfully requested all open sessions in this series! Pending Center Lead approval.");
              setClaimingSession(null);
              setClaimAllSeries(false);
              await fetchVolunteerSessions(user.id, profile?.assigned_center_id || null);
            }
          } else {
            toast.success("All available sessions in series already requested.");
            setClaimingSession(null);
            setClaimAllSeries(false);
          }
        }
      } else {
        // Single session request
        const { data: existing } = await supabase
          .from("session_enrollments")
          .select("id")
          .eq("session_id", claimingSession.id)
          .eq("user_id", user.id)
          .maybeSingle();

        let error = null;
        if (existing) {
          const { error: updateErr } = await supabase
            .from("session_enrollments")
            .update({ status: "Pending" })
            .eq("id", existing.id);
          error = updateErr;
        } else {
          const { error: insertErr } = await supabase
            .from("session_enrollments")
            .insert({
              session_id: claimingSession.id,
              user_id: user.id,
              status: "Pending",
            });
          error = insertErr;
        }

        if (error) {
          toast.error(`Failed to request session: ${error.message}`);
        } else {
          toast.success("Successfully requested session! Pending approval from Center Lead.");
          setClaimingSession(null);
          setClaimAllSeries(false);
          await fetchVolunteerSessions(user.id, profile?.assigned_center_id || null);
        }
      }
    } catch (err: any) {
      toast.error(`Unexpected error: ${err?.message || err}`);
    } finally {
      setIsClaiming(false);
    }
  };

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

          {/* Tabbed Volunteer Section: My Upcoming Classes vs Open Sessions Board */}
          <section className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("my-classes")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === "my-classes"
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>My Upcoming Classes</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    activeTab === "my-classes" ? "bg-white/20 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                  }`}>
                    {upcomingClasses.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("open-sessions")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                    activeTab === "open-sessions"
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Open Sessions</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    activeTab === "open-sessions" ? "bg-white/20 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                  }`}>
                    {openSessions.length}
                  </span>
                  {openSessions.some(s => s.is_urgent) && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute -top-0.5 -right-0.5" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => router.push("/schedule")}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider hover:underline flex items-center gap-1 cursor-pointer min-h-[32px] px-2 active:scale-95 transition-all"
              >
                Weekly Schedule
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {activeTab === "my-classes" ? (
              /* MY UPCOMING CLASSES BOARD */
              upcomingClasses.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm text-center flex flex-col items-center gap-2">
                  <Calendar className="w-8 h-8 text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    No upcoming classes assigned as facilitator
                  </span>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Check the Open Sessions Board to claim available sessions at your center!
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("open-sessions")}
                    className="mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 min-h-[36px] cursor-pointer"
                  >
                    Explore Open Sessions Board →
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {upcomingClasses.map((cls) => {
                    const clsCenter = Array.isArray(cls.centers) ? cls.centers[0]?.name : cls.centers?.name;
                    const startDate = new Date(cls.start_time).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    });
                    const startTime = new Date(cls.start_time).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    });

                    return (
                      <div
                        key={cls.id}
                        className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {cls.topic}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                              {startDate} at {startTime}
                            </span>
                            {clsCenter && (
                              <span>
                                • {clsCenter}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => router.push(`/schedule/${cls.id}/students`)}
                          className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs px-4 py-2.5 rounded-xl min-h-[44px] transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 cursor-pointer"
                        >
                          <span>Mark Student Attendance</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* OPEN SESSIONS BOARD */
              openSessions.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm text-center flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    No open sessions available right now
                  </span>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    All sessions at your center currently have assigned facilitators.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {openSessions.map((session) => {
                    const sCenter = Array.isArray(session.centers) ? session.centers[0]?.name : session.centers?.name;
                    const startDate = new Date(session.start_time).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    });
                    const startTime = new Date(session.start_time).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    });

                    return (
                      <div
                        key={session.id}
                        className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                          session.is_urgent
                            ? "border-amber-300 dark:border-amber-900/60 ring-1 ring-amber-500/20"
                            : "border-zinc-150 dark:border-zinc-800"
                        }`}
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            {session.is_urgent && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200/50 flex items-center gap-1 uppercase tracking-wider">
                                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                Urgent Vacancy
                              </span>
                            )}
                            {session.batch_id && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/40 uppercase tracking-wide">
                                Recurring Series
                              </span>
                            )}
                          </div>

                          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                            {session.topic}
                          </span>

                          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                              {startDate} at {startTime}
                            </span>
                            {sCenter && (
                              <span>
                                • {sCenter}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setClaimingSession(session);
                            setClaimAllSeries(false);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs px-5 py-2.5 rounded-xl min-h-[44px] transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 cursor-pointer shrink-0"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Request Session</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </section>

          {/* Student Directory Action Card */}
          <Link
            href="/students"
            className="group bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  View Student Directory
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                  Browse student profiles, historical attendance, and log ad-hoc assessments
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
              <span className="hidden sm:inline">Open Directory</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* REQUEST SESSION CONFIRMATION MODAL */}
          {claimingSession && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-5 relative">
                <button
                  type="button"
                  onClick={() => {
                    setClaimingSession(null);
                    setClaimAllSeries(false);
                  }}
                  className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <Sparkles className="w-5 h-5" />
                    </span>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                      Request Session
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    You are requesting to facilitate this session at your assigned center.
                  </p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {claimingSession.topic}
                    </span>
                    {claimingSession.is_urgent && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded-full">
                        Urgent
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    <span>
                      {new Date(claimingSession.start_time).toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      at{" "}
                      {new Date(claimingSession.start_time).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                </div>

                {/* Series Requesting Toggle (if batch_id is present) */}
                {claimingSession.batch_id && (
                  <div className="flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                        Recurring Series
                      </span>
                      <span className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                        Request all future open sessions in this series
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      id="claimAllSeriesToggle"
                      checked={claimAllSeries}
                      onChange={(e) => setClaimAllSeries(e.target.checked)}
                      className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClaimingSession(null);
                      setClaimAllSeries(false);
                    }}
                    className="flex-1 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors min-h-[44px] cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleClaimSubmit}
                    disabled={isClaiming}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50 cursor-pointer"
                  >
                    {isClaiming ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Requesting...
                      </span>
                    ) : (
                      <span>Confirm Request</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
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
                onClick={() => router.push("/team?tab=approvals")}
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

          {/* Student Directory Action Card for Leads */}
          <Link
            href="/students"
            className="group bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  View Student Directory & Assessments
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                  View center student rosters, historical performance, and log ad-hoc evaluations
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
              <span className="hidden sm:inline">Open Directory</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

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
