"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { BellRing, Loader2, CheckCircle2, UserCheck, Sparkles, MapPin } from "lucide-react";

interface Session {
  id: string;
  topic: string;
  start_time: string;
  end_time: string;
  checkedIn?: boolean;
  checkingIn?: boolean;
  checkInTime?: string;
}

export default function ActiveCheckInBanner() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const checkActiveSessions = async () => {
      try {
        // 1. Get authenticated user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          if (isMounted) setLoading(false);
          return;
        }
        if (!isMounted) return;
        setUser(authUser);

        // 2. Get user profile and assigned center
        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("id, assigned_center_id")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profileData) {
          console.error("Error fetching user profile for banner:", profileError);
          if (isMounted) setLoading(false);
          return;
        }
        if (!isMounted) return;

        const centerId = profileData.assigned_center_id;
        if (!centerId) {
          if (isMounted) setLoading(false);
          return;
        }

        // 3. Find any sessions currently active in the present (start_time <= now <= end_time)
        const now = new Date().toISOString();
        const { data: sessionsData, error: sessionsError } = await supabase
          .from("sessions")
          .select("id, topic, start_time, end_time")
          .eq("center_id", centerId)
          .lte("start_time", now)
          .gte("end_time", now)
          .order("start_time", { ascending: true });

        if (sessionsError) {
          console.error("Error fetching active sessions:", sessionsError);
          if (isMounted) setLoading(false);
          return;
        }

        if (!sessionsData || sessionsData.length === 0) {
          if (isMounted) {
            setActiveSessions([]);
            setLoading(false);
          }
          return;
        }
        if (!isMounted) return;

        const sessionList: Session[] = sessionsData.map(s => ({
          ...s,
          checkedIn: false,
          checkingIn: false,
        }));

        // 4. Fetch check-in status for all active sessions in one query
        const sessionIds = sessionList.map(s => s.id);
        const { data: attendanceData, error: attendanceError } = await supabase
          .from("attendance")
          .select("session_id, check_in_time")
          .eq("user_id", authUser.id)
          .eq("status", "Present")
          .in("session_id", sessionIds);

        if (attendanceError) {
          console.error("Error checking attendance for banner:", attendanceError);
        } else if (attendanceData) {
          attendanceData.forEach(att => {
            const matchedSession = sessionList.find(s => s.id === att.session_id);
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

        if (isMounted) {
          setActiveSessions(sessionList);
          // Clamp active index in case sessions count decreased
          setActiveIndex(prev => Math.min(prev, sessionList.length - 1));
          setLoading(false);
        }
      } catch (err) {
        console.error("Error in ActiveCheckInBanner check:", err);
        if (isMounted) setLoading(false);
      }
    };

    checkActiveSessions();

    // Check for updates every 20 seconds to be responsive to transitions
    const interval = setInterval(checkActiveSessions, 20000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const width = e.currentTarget.clientWidth;
    if (width > 0) {
      const index = Math.round(scrollLeft / width);
      setActiveIndex(index);
    }
  };

  const handleCheckIn = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!user) return;

    // Set checkingIn state for this session locally
    setActiveSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, checkingIn: true } : s))
    );

    try {
      const { error } = await supabase.from("attendance").insert({
        session_id: sessionId,
        user_id: user.id,
        status: "Present",
      });

      if (error) {
        console.error("Error checking in from carousel:", error);
        alert("Check-in failed: " + error.message);
        // Reset loading
        setActiveSessions(prev =>
          prev.map(s => (s.id === sessionId ? { ...s, checkingIn: false } : s))
        );
      } else {
        const checkInTimeStr = new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });

        setActiveSessions(prev =>
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
      console.error("Check-in error:", err);
      // Reset loading
      setActiveSessions(prev =>
        prev.map(s => (s.id === sessionId ? { ...s, checkingIn: false } : s))
      );
    }
  };

  const handleBannerClick = () => {
    // Navigates directly to the check-in page
    router.push("/check-in");
  };

  if (loading || activeSessions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 w-full select-none select-none">
      {/* Horizontally scrollable snap container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden w-full rounded-3xl"
      >
        {activeSessions.map((session) => {
          const isChecked = session.checkedIn;
          
          return (
            <div
              key={session.id}
              onClick={handleBannerClick}
              className={`w-full shrink-0 snap-center p-5 rounded-3xl flex flex-col gap-4 relative overflow-hidden transition-all duration-300 border cursor-pointer ${
                isChecked
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 border-emerald-400 dark:border-emerald-500 shadow-md shadow-emerald-500/5 text-white"
                  : "bg-gradient-to-r from-amber-500 to-orange-550 dark:from-amber-600 dark:to-orange-700 border-amber-400 dark:border-amber-500 shadow-md shadow-amber-500/5 text-white animate-pulse"
              }`}
              style={{ animationDuration: isChecked ? "0s" : "3.5s" }}
            >
              {/* Decorative light reflection */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${isChecked ? "bg-white/20 text-white" : "bg-white/20 text-white"}`}>
                    {isChecked ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <BellRing className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-90 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      {isChecked ? "Checked-In Current Session" : "Active Session Notification"}
                    </span>
                    <h4 className="text-base font-extrabold leading-snug mt-0.5 max-w-[220px] truncate">
                      {session.topic}
                    </h4>
                  </div>
                </div>

                {isChecked && (
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-white/20 border border-white/20 uppercase tracking-wider shrink-0">
                    Checked In
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs gap-3">
                <div className="flex items-center gap-1.5 opacity-90 font-medium">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Current Session Window</span>
                </div>

                {!isChecked ? (
                  <button
                    onClick={(e) => handleCheckIn(e, session.id)}
                    disabled={session.checkingIn}
                    className="h-10 min-h-[40px] px-4 bg-white hover:bg-zinc-50 active:scale-95 disabled:bg-white/80 text-amber-600 dark:text-amber-700 font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    {session.checkingIn ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                        <span>Checking In...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Check In Now</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold text-emerald-100 flex items-center gap-1">
                    Recorded today at {session.checkInTime}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Swipe/Indicator pagination dots */}
      {activeSessions.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          {activeSessions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (scrollContainerRef.current) {
                  const width = scrollContainerRef.current.clientWidth;
                  scrollContainerRef.current.scrollTo({
                    left: idx * width,
                    behavior: "smooth",
                  });
                  setActiveIndex(idx);
                }
              }}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                activeIndex === idx
                  ? "w-4 bg-emerald-600 dark:bg-emerald-450"
                  : "w-1.5 bg-zinc-300 dark:bg-zinc-800"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
