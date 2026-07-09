"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Users,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  History
} from "lucide-react";
import ActiveCheckInBanner from "@/components/active-check-in-banner";

import { User } from "@supabase/supabase-js";

type Session = Database["public"]["Tables"]["sessions"]["Row"];
type Center = Database["public"]["Tables"]["centers"]["Row"];

interface OpportunityRoster {
  user_id: string;
  status: string;
}

interface OpportunitySession {
  id: string;
  topic: string;
  start_time: string;
  end_time: string;
  capacity: number;
  center_id: string;
  session_rosters: OpportunityRoster[];
}

export default function SchedulePage() {
  const router = useRouter();

  // Auth and Profile States
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("Volunteer");
  const [center, setCenter] = useState<Center | null>(null);
  const [assignedCenterId, setAssignedCenterId] = useState<string | null>(null);

  // Opportunities Board State (Volunteer View)
  const [opportunities, setOpportunities] = useState<OpportunitySession[]>([]);
  const [requestingSessionId, setRequestingSessionId] = useState<string | null>(null);

  // Sessions State (Center Lead View)
  const [sessions, setSessions] = useState<Session[]>([]);
  const [fetchError, setFetchError] = useState("");
  const [showPast, setShowPast] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Form Fields
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:30");
  const [capacity, setCapacity] = useState("4");

  const fetchSessions = async () => {
    setFetchError("");
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      setFetchError("Failed to fetch sessions. Please try again.");
    } else {
      setSessions(data || []);
    }
  };

  const fetchOpportunities = async (centerId: string) => {
    try {
      setFetchError("");
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          *,
          session_rosters (
            user_id,
            status
          )
        `)
        .eq("center_id", centerId)
        .gt("start_time", new Date().toISOString())
        .order("start_time", { ascending: true });

      if (error) {
        setFetchError("Failed to fetch opportunities. Please try again.");
      } else {
        setOpportunities(data || []);
      }
    } catch (err) {
      console.error("Error fetching opportunities:", err);
      setFetchError("Unable to retrieve session opportunities.");
    }
  };

  // Fetch session and associated data
  useEffect(() => {
    const checkSessionAndFetch = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          router.push("/login");
          return;
        }
        setUser(authUser);

        // Fetch current user's profile and center in a single query
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("*, centers(*)")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profile) {
          console.error("Error fetching user profile:", profileError?.message);
          setFetchError("Unable to retrieve user center profile.");
          setLoading(false);
          return;
        }

        setRole(profile.role);
        setAssignedCenterId(profile.assigned_center_id);

        if (profile.centers) {
          if (Array.isArray(profile.centers)) {
            setCenter(profile.centers[0] as unknown as Center);
          } else {
            setCenter(profile.centers as unknown as Center);
          }
        }

        // Fetch data based on role
        if (profile.role === "Volunteer") {
          if (profile.assigned_center_id) {
            await fetchOpportunities(profile.assigned_center_id);
          }
        } else {
          await fetchSessions();
        }
      } catch {
        setFetchError("An unexpected error occurred while loading schedule data.");
      } finally {
        setLoading(false);
      }
    };

    checkSessionAndFetch();
  }, [router]);

  const handleRequestJoin = async (sessionId: string) => {
    if (!user) return;
    setRequestingSessionId(sessionId);
    setFetchError("");
    try {
      const { error } = await supabase
        .from("session_rosters")
        .insert({
          session_id: sessionId,
          user_id: user.id,
          status: "Pending"
        });

      if (error) throw error;

      if (assignedCenterId) {
        await fetchOpportunities(assignedCenterId);
      }
    } catch (err) {
      console.error("Signup request error:", err);
      const msg = err instanceof Error ? err.message : "Failed to join shift request";
      alert(msg);
    } finally {
      setRequestingSessionId(null);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!assignedCenterId) {
      setFormError("No assigned center associated with your profile.");
      return;
    }

    if (!topic.trim()) {
      setFormError("Please enter a session topic.");
      return;
    }

    if (!date) {
      setFormError("Please select a session date.");
      return;
    }

    if (!startTime || !endTime) {
      setFormError("Please select start and end times.");
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    if (endDateTime <= startDateTime) {
      setFormError("End time must be after the start time.");
      return;
    }

    const capacityNum = parseInt(capacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      setFormError("Capacity must be a positive number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("sessions").insert({
        topic: topic.trim(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        capacity: capacityNum,
        center_id: assignedCenterId,
      });

      if (error) {
        setFormError(error.message || "Failed to create session.");
      } else {
        setFormSuccess("Session created successfully!");
        setTopic("");
        const today = new Date().toISOString().split("T")[0];
        setDate(today);
        setStartTime("10:00");
        setEndTime("11:30");
        setCapacity("4");

        // Refresh sessions list
        await fetchSessions();

        // Close modal after a short delay
        setTimeout(() => {
          setIsModalOpen(false);
          setFormSuccess("");
        }, 1500);
      }
    } catch {
      setFormError("A network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
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

  // Group and sort sessions
  const { todaySessions, upcomingSessions, pastSessions } = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const today: Session[] = [];
    const upcoming: Session[] = [];
    const past: Session[] = [];

    sessions.forEach(session => {
      const sessionStart = new Date(session.start_time);
      if (sessionStart < startOfToday) {
        past.push(session);
      } else if (sessionStart > endOfToday) {
        upcoming.push(session);
      } else {
        today.push(session);
      }
    });

    // Today and Upcoming sorted chronological ascending (standard ascending order from fetchSessions)
    // Past sorted chronological descending (most recent first)
    past.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    return {
      todaySessions: today,
      upcomingSessions: upcoming,
      pastSessions: past,
    };
  }, [sessions]);

  const renderSessionCard = (session: Session, tag: "Today" | "Upcoming" | "Past") => {
    let badgeClass = "bg-zinc-100 text-zinc-800 dark:bg-zinc-850 dark:text-zinc-350 border-zinc-200/40";
    if (tag === "Today") {
      badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-405 border-amber-250/20";
    } else if (tag === "Upcoming") {
      badgeClass = "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-250/20";
    }

    return (
      <div
        key={session.id}
        className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col gap-3.5 hover:shadow-md transition-shadow active:bg-zinc-50 dark:active:bg-zinc-850/50 animate-fade-in"
      >
        <div className="flex items-center justify-between">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${badgeClass}`}>
            {tag}
          </span>
          <span className="text-xs text-zinc-550 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 stroke-[1.8]" />
            {formatDate(session.start_time)}
          </span>
        </div>

        <div className="flex justify-between items-end">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-snug break-words">
              {session.topic}
            </h3>
            <div className="flex flex-col gap-1 mt-2">
              <span className="text-xs text-zinc-555 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                {formatTime(session.start_time)} - {formatTime(session.end_time)}
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-450 dark:text-zinc-500 shrink-0" />
        </div>

        <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3 flex justify-between items-center text-xs">
          <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-medium">
            <Users className="w-3.5 h-3.5 text-zinc-400" />
            Target Capacity
          </span>
          <span className="font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-200/20">
            {session.capacity} Volunteers
          </span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin stroke-[2]" />
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Loading Schedule...
        </span>
      </div>
    );
  }

  if (role === "Volunteer") {
    return (
      <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in relative min-h-full pb-20">
        {/* Active Check-In Notification Banner */}
        <ActiveCheckInBanner />

        {/* Header */}
        <header className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-55">
            Volunteer Shifts
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1 font-medium">
            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
            {center ? `${center.name}` : "Loading location..."}
          </p>
        </header>

        {/* Fetch Error Display */}
        {fetchError && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-450 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">
                Error Loading Opportunities
              </h4>
              <p className="text-xs text-rose-700 dark:text-rose-400/90 leading-relaxed">
                {fetchError}
              </p>
            </div>
          </div>
        )}

        {/* Opportunities List */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1">
            Available Sessions ({opportunities.length})
          </h2>

          {opportunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl text-center shadow-sm min-h-[250px] gap-4">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-full text-zinc-400">
                <Calendar className="w-8 h-8 stroke-[1.5]" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  No Opportunities
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[200px] leading-relaxed">
                  There are no upcoming sessions scheduled for this center. Check back later!
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {opportunities.map((session) => {
                const rosters = session.session_rosters || [];
                const userRoster = rosters.find((r: OpportunityRoster) => r.user_id === user?.id);
                const requestStatus = userRoster?.status || null;
                
                const approvedCount = rosters.filter((r: OpportunityRoster) => r.status === "Approved").length;
                const remaining = Math.max(0, session.capacity - approvedCount);
                const isRequesting = requestingSessionId === session.id;

                let badgeColor = "bg-zinc-150 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 border-zinc-200/50";
                if (requestStatus === "Approved") {
                  badgeColor = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/40";
                } else if (requestStatus === "Pending") {
                  badgeColor = "bg-amber-50 text-amber-750 dark:bg-amber-950/60 dark:text-amber-400 border-amber-100 dark:border-amber-800/40";
                } else if (requestStatus === "Denied") {
                  badgeColor = "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-450 border-rose-100 dark:border-rose-800/40";
                }

                return (
                  <div
                    key={session.id}
                    className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow relative overflow-hidden"
                  >
                    {/* Top Row */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                        <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-450 stroke-[2]" />
                        {formatDate(session.start_time)}
                      </span>
                      <span className="text-xs text-zinc-405 font-medium">
                        Capacity: {session.capacity} vols
                      </span>
                    </div>

                    {/* Middle Row */}
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-snug break-words">
                        {session.topic}
                      </h3>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-zinc-450" />
                        {formatTime(session.start_time)} - {formatTime(session.end_time)}
                      </span>
                    </div>

                    {/* Bottom Row */}
                    <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-4 flex items-center justify-between gap-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                          Availability
                        </span>
                        <span className={`text-xs font-bold mt-0.5 ${remaining > 0 ? "text-emerald-600 dark:text-emerald-450" : "text-zinc-400"}`}>
                          {remaining > 0 ? `${remaining} spots left` : "Session Full"}
                        </span>
                      </div>

                      {requestStatus ? (
                        <div className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${badgeColor} text-center min-w-[120px]`}>
                          {requestStatus === "Pending" ? "Pending Approval" : requestStatus}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRequestJoin(session.id)}
                          disabled={remaining <= 0 || isRequesting}
                          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-100 disabled:text-zinc-400 dark:bg-emerald-500 dark:hover:bg-emerald-450 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 text-white font-bold text-xs py-3 px-4 rounded-xl min-h-[48px] active:scale-[0.97] transition-all cursor-pointer min-w-[125px]"
                        >
                          {isRequesting ? (
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          ) : (
                            "Request to Join"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in relative min-h-full pb-20">
      {/* Active Check-In Notification Banner */}
      <ActiveCheckInBanner />

      {/* Header */}
      <header className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Center Schedule
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1 font-medium">
            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
            {center ? `${center.name}` : "Loading location..."}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 active:bg-emerald-700 dark:bg-emerald-500 dark:active:bg-emerald-600 text-white font-bold text-sm px-4 py-3 rounded-2xl shadow-md transition-all active:scale-[0.97] min-h-[48px]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Create Session
        </button>
      </header>

      {/* Fetch Error Display */}
      {fetchError && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-450 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">
              Error Loading Data
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-400/90 leading-relaxed">
              {fetchError}
            </p>
            <button
              onClick={fetchSessions}
              className="text-xs font-bold text-rose-600 dark:text-rose-450 underline text-left mt-1 hover:text-rose-800"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <section className="flex flex-col gap-4">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl text-center shadow-sm min-h-[250px] gap-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-full text-zinc-400">
              <Calendar className="w-8 h-8 stroke-[1.5]" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                No Sessions Scheduled
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[200px] leading-relaxed">
                Create your first session using the button above to begin managing volunteers.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Today's Sessions */}
            {todaySessions.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1">
                  Today&apos;s Sessions ({todaySessions.length})
                </h3>
                <div className="flex flex-col gap-4">
                  {todaySessions.map(session => renderSessionCard(session, "Today"))}
                </div>
              </div>
            )}

            {/* Upcoming Sessions */}
            {upcomingSessions.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1">
                  Upcoming Sessions ({upcomingSessions.length})
                </h3>
                <div className="flex flex-col gap-4">
                  {upcomingSessions.map(session => renderSessionCard(session, "Upcoming"))}
                </div>
              </div>
            )}

            {/* Collapsible Past Sessions */}
            {pastSessions.length > 0 && (
              <div className="flex flex-col gap-3 mt-2">
                <button
                  onClick={() => setShowPast(!showPast)}
                  className="flex items-center justify-between w-full p-4 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 border border-zinc-150 dark:border-zinc-800 rounded-2xl transition-all font-bold text-sm text-zinc-700 dark:text-zinc-300 min-h-[48px] shadow-sm select-none active:scale-[0.99]"
                >
                  <span className="flex items-center gap-2.5">
                    <History className="w-4.5 h-4.5 text-zinc-450 dark:text-zinc-500" />
                    <span>Past Sessions ({pastSessions.length})</span>
                  </span>
                  <ChevronDown className={`w-5 h-5 text-zinc-450 transition-transform duration-200 ${showPast ? "rotate-180" : ""}`} />
                </button>

                {showPast && (
                  <div className="flex flex-col gap-4 mt-1 animate-fade-in">
                    {pastSessions.map(session => renderSessionCard(session, "Past"))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Create Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-sm z-50 flex items-end justify-center select-none animate-fade-in">
          {/* Modal Content Drawer */}
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl border-t border-zinc-200 dark:border-zinc-850 p-6 flex flex-col gap-5 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto pb-10">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                Create New Session
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setFormError("");
                  setFormSuccess("");
                }}
                className="p-1 rounded-full text-zinc-450 dark:text-zinc-555 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Messages */}
            {formError && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl p-3.5 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-450 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-rose-800 dark:text-rose-350 leading-relaxed">
                  {formError}
                </span>
              </div>
            )}

            {formSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 rounded-2xl p-3.5 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-455 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-355 leading-relaxed">
                  {formSuccess}
                </span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateSession} className="flex flex-col gap-4">
              
              {/* Topic Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Session Topic
                </label>
                <input
                  type="text"
                  placeholder="e.g. Basic Arithmetic & Counting"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                />
              </div>

              {/* Date Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                />
              </div>

              {/* Time Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Capacity Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Target Capacity (Volunteers Needed)
                </label>
                <input
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col gap-3 mt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] bg-emerald-600 active:bg-emerald-700 dark:bg-emerald-500 dark:active:bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Session...
                    </>
                  ) : (
                    "Create Session"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormError("");
                    setFormSuccess("");
                  }}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] bg-zinc-100 active:bg-zinc-200 dark:bg-zinc-800 dark:active:bg-zinc-850 text-zinc-700 dark:text-zinc-300 font-bold text-sm rounded-xl flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
