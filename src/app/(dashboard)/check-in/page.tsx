"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  CheckCircle2,
  MapPin,
  Calendar,
  Loader2,
  Building2,
  Clock,
  AlertTriangle,
  UserCheck
} from "lucide-react";

import { User } from "@supabase/supabase-js";

interface Session {
  id: string;
  center_id: string;
  topic: string;
  start_time: string;
  end_time: string;
  capacity: number;
  checkedIn?: boolean;
  checkingIn?: boolean;
  checkInTime?: string;
}

interface Profile {
  id: string;
  email: string | null;
  role: string;
  assigned_center_id: string | null;
  created_at?: string;
  centers?: {
    name: string;
    location: string | null;
  } | {
    name: string;
    location: string | null;
  }[] | null;
}

export default function CheckInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const fetchCheckInData = async () => {
      try {
        setLoading(true);
        setErrorMsg("");

        // 1. Get authenticated user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push("/login");
          return;
        }
        setUser(authUser);

        // 2. Fetch user's profile and assigned center in a single query
        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("*, centers(*)")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profileData) {
          console.error("Error fetching user profile:", profileError);
          setErrorMsg("Could not load your user profile or center assignment.");
          return;
        }
        setProfile(profileData);

        const centerId = profileData.assigned_center_id;
        if (!centerId) {
          // Profile exists but no center is assigned yet
          return;
        }

        // 3. Define "today" in local timezone bounds in ISO string format
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const startOfDayISO = startOfToday.toISOString();

        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);
        const endOfDayISO = endOfToday.toISOString();

        // 4. Fetch today's sessions for the center
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("sessions")
          .select("*")
          .eq("center_id", centerId)
          .gte("start_time", startOfDayISO)
          .lte("start_time", endOfDayISO)
          .order("start_time", { ascending: true });

        if (sessionsError) {
          console.error("Error fetching today's sessions:", sessionsError);
          setErrorMsg("Could not retrieve today's scheduled sessions.");
          return;
        }

        const todaySessions: Session[] = (sessionsData || []).map(s => ({
          ...s,
          checkedIn: false,
          checkingIn: false
        }));

        if (todaySessions.length > 0) {
          // 5. Fetch user's attendance records for today's sessions
          const sessionIds = todaySessions.map(s => s.id);
          const { data: attendanceData, error: attendanceError } = await supabase
            .from("attendance")
            .select("*")
            .eq("user_id", authUser.id)
            .eq("status", "Present")
            .in("session_id", sessionIds);

          if (attendanceError) {
            console.error("Error fetching attendance records:", attendanceError);
          } else if (attendanceData) {
            // Map attendance records to sessions
            attendanceData.forEach(att => {
              const matchedSession = todaySessions.find(s => s.id === att.session_id);
              if (matchedSession) {
                matchedSession.checkedIn = true;
                matchedSession.checkInTime = att.check_in_time
                  ? new Date(att.check_in_time).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : undefined;
              }
            });
          }
        }

        setSessions(todaySessions);
      } catch (err) {
        console.error("Unexpected error in Check-In page mount:", err);
        setErrorMsg("An unexpected error occurred while loading. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const checkAuthAndFetch = async () => {
      await fetchCheckInData();
    };

    checkAuthAndFetch();
  }, [router]);

  const handleCheckIn = async (sessionId: string) => {
    if (!user) return;

    // Set loading state for this session locally
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, checkingIn: true } : s))
    );

    try {
      const { error } = await supabase.from("attendance").insert({
        session_id: sessionId,
        user_id: user.id,
        status: "Present",
      });

      if (error) {
        console.error("Check-in error:", error);
        alert("Unable to check in. " + error.message);
        // Reset loading state
        setSessions(prev =>
          prev.map(s => (s.id === sessionId ? { ...s, checkingIn: false } : s))
        );
      } else {
        // Success: update checkedIn and checkInTime locally
        const checkInTimeStr = new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });

        setSessions(prev =>
          prev.map(s =>
            s.id === sessionId
              ? {
                  ...s,
                  checkedIn: true,
                  checkingIn: false,
                  checkInTime: checkInTimeStr,
                }
              : s
          )
        );
      }
    } catch (err) {
      console.error("Check-in failed:", err);
      // Reset loading state
      setSessions(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, checkingIn: false } : s))
      );
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3 select-none">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin stroke-[2]" />
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Loading check-in...
        </span>
      </div>
    );
  }

  const centersData = profile?.centers;
  const centerName = Array.isArray(centersData)
    ? (centersData[0]?.name || "No Center Assigned")
    : (centersData?.name || "No Center Assigned");
  const centerLocation = Array.isArray(centersData)
    ? (centersData[0]?.location || "No Location Listed")
    : (centersData?.location || "No Location Listed");
  const hasCenter = !!profile?.assigned_center_id;

  return (
    <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in">
      <header className="flex flex-col">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-55 animate-fade-in-down">
          Daily Check-In
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
          {formatDate(new Date().toISOString())}
        </p>
      </header>

      {/* Center Details Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden transition-all duration-200 hover:shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Building2 className="w-5 h-5 stroke-[2]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Assigned Center
            </span>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-tight mt-0.5">
              {centerName}
            </h3>
          </div>
        </div>

        {hasCenter && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-1 ml-1.5 font-medium">
            <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{centerLocation}</span>
          </div>
        )}
      </div>

      {/* Error or Warning message */}
      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-450 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">
              Information Error
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-400/90 leading-relaxed font-medium">
              {errorMsg}
            </p>
          </div>
        </div>
      )}

      {/* Main Check-In Content Area */}
      {!errorMsg && (
        <section className="flex flex-col gap-5">
          {!hasCenter ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl text-center shadow-sm min-h-[250px] gap-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/25 rounded-full text-amber-505">
                <AlertTriangle className="w-8 h-8 stroke-[1.8]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  No Center Assigned
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[240px] leading-relaxed">
                  You must be assigned to an education center to check in. Please contact your administrator.
                </p>
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl text-center shadow-sm min-h-[250px] gap-4 animate-fade-in">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-full text-zinc-400">
                <Calendar className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  No Sessions Scheduled Today
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[240px] leading-relaxed">
                  There are no active learning sessions scheduled for today at this center.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-450 dark:text-zinc-500 px-1">
                Today&apos;s Sessions ({sessions.length})
              </h3>

              {sessions.map(session => (
                <div
                  key={session.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-5 shadow-sm flex flex-col gap-5 hover:shadow-md transition-shadow relative overflow-hidden animate-fade-in"
                >
                  {/* Card Header info */}
                  <div className="flex flex-col gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider self-start ${
                      session.checkedIn 
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/30" 
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 border-zinc-200/40"
                    }`}>
                      {session.checkedIn ? "Completed Check-In" : "Pending Check-In"}
                    </span>
                    <h4 className="text-lg font-extrabold text-zinc-900 dark:text-white leading-snug mt-1">
                      {session.topic}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      <Clock className="w-4 h-4 text-zinc-400 shrink-0 font-medium" />
                      <span>
                        {formatTime(session.start_time)} - {formatTime(session.end_time)}
                      </span>
                    </div>
                  </div>

                  {/* Action/Success state */}
                  {session.checkedIn ? (
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-250/30 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-inner animate-fade-in">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 stroke-[2.2]" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 leading-none">
                            ✅ You are checked in for today
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-semibold">
                            Recorded today at {session.checkInTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCheckIn(session.id)}
                      disabled={session.checkingIn}
                      className="w-full h-16 min-h-[64px] bg-gradient-to-r from-emerald-500 to-teal-650 hover:from-emerald-600 hover:to-teal-700 disabled:from-zinc-300 disabled:to-zinc-400 dark:disabled:from-zinc-800 dark:disabled:to-zinc-900 text-white font-extrabold text-lg rounded-2xl shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed select-none outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                      {session.checkingIn ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span>Checking In...</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-6 h-6" />
                          <span>Check In Now</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
