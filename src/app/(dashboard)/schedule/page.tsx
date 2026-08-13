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
  ChevronLeft,
  ChevronDown,
  History
} from "lucide-react";
import ActiveCheckInBanner from "@/components/active-check-in-banner";
import BatchBuilder from "./batch-builder";
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
  session_enrollments: OpportunityRoster[];
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
  const [isBatchBuilderOpen, setIsBatchBuilderOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Request Manager Dialog State (for Desktop buttons)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestModalType, setRequestModalType] = useState<"add" | "drop">("add");

  // Form Fields
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:30");
  const [capacity, setCapacity] = useState("4");

  // Student Assignment Roster State
  const [centerStudents, setCenterStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Calendar State (Desktop)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"Month" | "Week" | "Day">("Month");

  useEffect(() => {
    if (assignedCenterId) {
      const fetchCenterStudents = async () => {
        const { data } = await supabase
          .from("students")
          .select("id, name")
          .eq("center_id", assignedCenterId)
          .order("name", { ascending: true });
        if (data) setCenterStudents(data);
      };
      fetchCenterStudents();
    }
  }, [assignedCenterId]);

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
          session_enrollments (
            user_id,
            status
          )
        `)
        .eq("center_id", centerId)
        .gt("start_time", new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Show recent past for calendar layout too
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
        .from("session_enrollments")
        .insert({
          session_id: sessionId,
          user_id: user.id,
          status: "Pending"
        });

      if (error) throw error;

      if (assignedCenterId) {
        await fetchOpportunities(assignedCenterId);
      }
      setFormSuccess("Successfully requested to join shift!");
      setTimeout(() => setFormSuccess(""), 3000);
    } catch (err) {
      console.error("Signup request error:", err);
      const msg = err instanceof Error ? err.message : "Failed to join shift request";
      alert(msg);
    } finally {
      setRequestingSessionId(null);
    }
  };

  const handleDropRequest = async (sessionId: string) => {
    if (!user) return;
    setRequestingSessionId(sessionId);
    try {
      const { error } = await supabase
        .from("session_enrollments")
        .delete()
        .eq("session_id", sessionId)
        .eq("user_id", user.id);

      if (error) throw error;

      if (assignedCenterId) {
        await fetchOpportunities(assignedCenterId);
      }
      setFormSuccess("Successfully dropped shift request!");
      setTimeout(() => setFormSuccess(""), 3000);
    } catch (err) {
      console.error("Drop request error:", err);
      alert("Failed to drop shift request.");
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
      const { data: newSession, error } = await supabase
        .from("sessions")
        .insert({
          topic: topic.trim(),
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          capacity: capacityNum,
          center_id: assignedCenterId,
        })
        .select()
        .single();

      if (error) {
        setFormError(error.message || "Failed to create session.");
      } else {
        // If students were selected for the initial roster, bulk insert into student_attendance
        if (newSession && selectedStudentIds.length > 0) {
          const initialRoster = selectedStudentIds.map((stId) => ({
            session_id: newSession.id,
            student_id: stId,
            status: "Unmarked",
            marked_by: user?.id,
          }));
          const { error: attInsertErr } = await supabase
            .from("student_attendance")
            .insert(initialRoster);

          if (attInsertErr) {
            console.error("Error creating initial student roster:", attInsertErr);
          }
        }

        setFormSuccess("Session created successfully!");
        setTopic("");
        setSelectedStudentIds([]);
        const today = new Date().toISOString().split("T")[0];
        setDate(today);
        setStartTime("10:00");
        setEndTime("11:30");
        setCapacity("4");

        // Refresh sessions list
        if (role === "Volunteer") {
          if (assignedCenterId) await fetchOpportunities(assignedCenterId);
        } else {
          await fetchSessions();
        }

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

    past.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

    return {
      todaySessions: today,
      upcomingSessions: upcoming,
      pastSessions: past,
    };
  }, [sessions]);

  // Calendar Helpers (Desktop View)
  const getSessionsForDate = (dateToCheck: Date) => {
    const targetList = role === "Volunteer" ? opportunities : sessions;
    return targetList.filter((s) => {
      const sDate = new Date(s.start_time);
      return (
        sDate.getFullYear() === dateToCheck.getFullYear() &&
        sDate.getMonth() === dateToCheck.getMonth() &&
        sDate.getDate() === dateToCheck.getDate()
      );
    });
  };

  const formatSessionTimeShort = (isoString: string) => {
    const d = new Date(isoString);
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? "p" : "a";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minStr = minutes > 0 ? `:${minutes.toString().padStart(2, "0")}` : "";
    return `${hours}${minStr}${ampm}`;
  };

  const getWeekDays = (dateToCheck: Date) => {
    const startOfWeek = new Date(dateToCheck);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day); // Align to Sunday
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const prevPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "Month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === "Week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
    setSelectedDate(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "Month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === "Week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
    setSelectedDate(newDate);
  };

  const calendarCells = React.useMemo(() => {
    const cells = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Previous month padding cells
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      cells.push({
        date: new Date(year, month - 1, day),
        isCurrentMonth: false,
        dayNumber: day,
      });
    }

    // Current month cells
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
        dayNumber: i,
      });
    }

    // Next month padding cells
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        dayNumber: i,
      });
    }

    return cells;
  }, [currentDate]);

  // Determine dot color based on session details/enrollments
  const getDotStyle = (session: any) => {
    if (role === "Volunteer") {
      const rosters = session.session_enrollments || [];
      const userRoster = rosters.find((r: any) => r.user_id === user?.id);
      const status = userRoster?.status;
      if (status === "Approved") return "bg-emerald-500 shadow-emerald-500/30";
      if (status === "Pending") return "bg-amber-500 shadow-amber-500/30";
      if (status === "Denied") return "bg-rose-500 shadow-rose-500/30";
      return "bg-indigo-500 shadow-indigo-500/30";
    }
    return "bg-emerald-600 shadow-emerald-600/30";
  };

  const renderSessionCard = (session: Session, tag: "Today" | "Upcoming" | "Past") => {
    let badgeClass = "bg-zinc-100 text-zinc-800 dark:bg-zinc-850 dark:text-zinc-350 border-zinc-200/40";
    if (tag === "Today") {
      badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/20";
    } else if (tag === "Upcoming") {
      badgeClass = "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200/20";
    }

    return (
      <div
        key={session.id}
        onClick={() => router.push(`/schedule/${session.id}`)}
        className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col gap-3.5 hover:shadow-md transition-shadow active:bg-zinc-50 dark:active:bg-zinc-850/50 animate-fade-in cursor-pointer"
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

  return (
    <div className="flex-1 w-full bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200 flex flex-col min-h-full">
      
      {/* MOBILE INTERFACE */}
      <div className="md:hidden">
        {role === "Volunteer" ? (
          <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in relative min-h-full pb-20">
            {/* Active Check-In Notification Banner */}
            <ActiveCheckInBanner />

            {/* Header */}
            <header className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
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
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-455 shrink-0 mt-0.5" />
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
                    const rosters = session.session_enrollments || [];
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
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-450 stroke-[2]" />
                            {formatDate(session.start_time)}
                          </span>
                          <span className="text-xs text-zinc-405 font-medium">
                            Capacity: {session.capacity} vols
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-snug break-words">
                            {session.topic}
                          </h3>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-zinc-450" />
                            {formatTime(session.start_time)} - {formatTime(session.end_time)}
                          </span>
                        </div>

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
        ) : (
          <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in relative min-h-full pb-20">
            <header className="flex items-start justify-between">
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-55">
                  Center Schedule
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  {center ? `${center.name}` : "Loading location..."}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <button
                  onClick={() => setIsBatchBuilderOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 active:bg-indigo-700 dark:bg-indigo-500 dark:active:bg-indigo-600 text-white font-bold text-sm px-4 py-3 rounded-2xl shadow-md transition-all active:scale-[0.97] min-h-[48px] w-full sm:w-auto justify-center"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  Create Batch
                </button>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 bg-emerald-600 active:bg-emerald-700 dark:bg-emerald-500 dark:active:bg-emerald-600 text-white font-bold text-sm px-4 py-3 rounded-2xl shadow-md transition-all active:scale-[0.97] min-h-[48px] w-full sm:w-auto justify-center"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  Create Session
                </button>
              </div>
            </header>

            {fetchError && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-455 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">
                    Error Loading Data
                  </h4>
                  <p className="text-xs text-rose-700 dark:text-rose-400/90 leading-relaxed">
                    {fetchError}
                  </p>
                  <button
                    onClick={fetchSessions}
                    className="text-xs font-bold text-rose-600 dark:text-rose-455 underline text-left mt-1 hover:text-rose-800"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

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
          </div>
        )}
      </div>

      {/* DESKTOP WEB INTERFACE */}
      <div className="hidden md:flex flex-col gap-6 p-8 max-w-7xl mx-auto w-full select-none animate-fade-in min-h-screen">
        
        {/* Desktop Header */}
        <header className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
          <div className="flex flex-col">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Center Schedule & Planner
            </h1>
            <p className="text-sm text-zinc-550 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5 font-semibold">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-450" />
              {center ? `${center.name} Center` : "Loading center location..."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {role !== "Volunteer" && (
              <>
                <button
                  onClick={() => setIsBatchBuilderOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-lg shadow-indigo-500/10 transition-all hover:translate-y-[-1px] active:translate-y-[0] min-h-[48px] cursor-pointer"
                >
                  <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
                  Create Recurring Batch
                </button>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-455 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-lg shadow-emerald-500/10 transition-all hover:translate-y-[-1px] active:translate-y-[0] min-h-[48px] cursor-pointer"
                >
                  <Plus className="w-4.5 h-4.5 stroke-[2.5]" />
                  Create New Session
                </button>
              </>
            )}
          </div>
        </header>

        {/* Desktop Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          
          {/* Current Period Selection */}
          <div className="flex items-center gap-3">
            <button
              onClick={prevPeriod}
              className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-350 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 min-w-[140px] text-center">
              {viewMode === "Month" &&
                currentDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              {viewMode === "Week" && (
                <>
                  Week of{" "}
                  {getWeekDays(currentDate)[0].toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                  })}
                </>
              )}
              {viewMode === "Day" &&
                currentDate.toLocaleDateString("en-IN", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
            </h2>

            <button
              onClick={nextPeriod}
              className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-350 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
              aria-label="Next period"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setCurrentDate(new Date());
                setSelectedDate(new Date());
              }}
              className="ml-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            >
              Today
            </button>
          </div>

          {/* Segmented View Mode Toggle */}
          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50">
            {(["Month", "Week", "Day"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`py-2 px-4 text-xs font-bold rounded-lg transition-all min-h-[38px] ${
                  viewMode === mode
                    ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-zinc-200/30 dark:border-zinc-700/30"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* CALENDAR VIEWS CONTAINER */}
        <div className="flex-1 min-h-[500px]">
          
          {/* 1. MONTH VIEW */}
          {viewMode === "Month" && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900 transition-colors duration-200">
              
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-center font-bold text-xs uppercase tracking-wider text-zinc-500 py-3.5 select-none">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
                  <div key={dayName}>{dayName}</div>
                ))}
              </div>

              {/* Grid Cells */}
              <div className="grid grid-cols-7 grid-rows-6">
                {calendarCells.map((cell, idx) => {
                  const cellSessions = getSessionsForDate(cell.date);
                  const isToday = cell.date.toDateString() === new Date().toDateString();
                  const isSelected = cell.date.toDateString() === selectedDate.toDateString();

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDate(cell.date);
                        setCurrentDate(cell.date);
                        setViewMode("Day");
                      }}
                      className={`min-h-[110px] p-2.5 border-r border-b border-zinc-150 dark:border-zinc-800/80 flex flex-col gap-1.5 transition-all hover:bg-zinc-50/70 dark:hover:bg-zinc-850/20 cursor-pointer group relative ${
                        cell.isCurrentMonth
                          ? "text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-400 dark:text-zinc-600 bg-zinc-50/30 dark:bg-zinc-900/20"
                      } ${idx % 7 === 6 ? "border-r-0" : ""} ${idx >= 35 ? "border-b-0" : ""}`}
                    >
                      {/* Cell Header */}
                      <div className="flex justify-between items-center select-none">
                        <span
                          className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-full transition-colors ${
                            isToday
                              ? "bg-emerald-600 text-white font-extrabold shadow-sm shadow-emerald-500/20"
                              : isSelected
                              ? "bg-zinc-200 dark:bg-zinc-850 font-bold"
                              : ""
                          }`}
                        >
                          {cell.dayNumber}
                        </span>
                        
                        {cellSessions.length > 0 && (
                          <span className="text-[10px] font-bold text-zinc-400 px-1 dark:text-zinc-500">
                            {cellSessions.length} {cellSessions.length === 1 ? "shift" : "shifts"}
                          </span>
                        )}
                      </div>

                      {/* Cell Sessions List */}
                      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 max-h-[85px] scrollbar-thin">
                        {cellSessions.slice(0, 3).map((session: any) => {
                          return (
                            <div
                              key={session.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/schedule/${session.id}`);
                              }}
                              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10.5px] font-semibold bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 border border-zinc-200/25 text-zinc-700 dark:text-zinc-300 transition-colors truncate"
                              title={session.topic}
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 ${getDotStyle(session)}`} />
                              <span className="font-extrabold text-[9.5px] shrink-0 text-zinc-500 dark:text-zinc-400">
                                {formatSessionTimeShort(session.start_time)}
                              </span>
                              <span className="truncate">{session.topic}</span>
                            </div>
                          );
                        })}
                        {cellSessions.length > 3 && (
                          <div className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 pl-1.5">
                            + {cellSessions.length - 3} more shifts
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. WEEK VIEW */}
          {viewMode === "Week" && (
            <div className="grid grid-cols-7 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
              {getWeekDays(currentDate).map((dayDate, idx) => {
                const daySessions = getSessionsForDate(dayDate);
                const isToday = dayDate.toDateString() === new Date().toDateString();
                const isSelected = dayDate.toDateString() === selectedDate.toDateString();

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDate(dayDate);
                      setViewMode("Day");
                    }}
                    className={`min-h-[450px] border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-colors hover:bg-zinc-50/30 dark:hover:bg-zinc-850/10 cursor-pointer ${
                      idx === 6 ? "border-r-0" : ""
                    }`}
                  >
                    {/* Day Column Header */}
                    <div
                      className={`p-4 border-b border-zinc-200 dark:border-zinc-800 text-center flex flex-col items-center gap-1 bg-zinc-50/50 dark:bg-zinc-950/20 ${
                        isToday ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""
                      }`}
                    >
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500">
                        {dayDate.toLocaleDateString("en-IN", { weekday: "short" })}
                      </span>
                      <span
                        className={`w-8 h-8 flex items-center justify-center text-sm font-black rounded-full ${
                          isToday
                            ? "bg-emerald-600 text-white shadow-sm"
                            : isSelected
                            ? "bg-zinc-200 dark:bg-zinc-850 text-zinc-950 dark:text-white"
                            : "text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        {dayDate.getDate()}
                      </span>
                    </div>

                    {/* Day Column Content */}
                    <div className="flex-1 p-3.5 space-y-3 overflow-y-auto max-h-[380px]">
                      {daySessions.length === 0 ? (
                        <div className="text-center text-xs text-zinc-400 dark:text-zinc-650 py-8 select-none">
                          No shifts
                        </div>
                      ) : (
                        daySessions.map((session) => (
                          <div
                            key={session.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/schedule/${session.id}`);
                            }}
                            className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/40 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 p-3 rounded-xl flex flex-col gap-2.5 transition-all shadow-sm active:scale-95 cursor-pointer relative overflow-hidden group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${getDotStyle(session)}`} />
                                {formatSessionTimeShort(session.start_time)}
                              </span>
                            </div>
                            <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white leading-snug truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {session.topic}
                            </h4>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. DAY VIEW */}
          {viewMode === "Day" && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
              
              <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-850 pb-4">
                <div className="flex flex-col">
                  <h3 className="text-xl font-bold text-zinc-850 dark:text-white">
                    Shifts for {selectedDate.toLocaleDateString("en-IN", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                  <p className="text-xs text-zinc-500 font-medium">
                    {getSessionsForDate(selectedDate).length} shifts scheduled
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {getSessionsForDate(selectedDate).length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center gap-3">
                    <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-full text-zinc-400">
                      <Calendar className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white">No Shifts</h4>
                      <p className="text-xs text-zinc-500 max-w-[250px] leading-relaxed mt-1">
                        There are no center shifts scheduled for this specific calendar date.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {getSessionsForDate(selectedDate).map((session: any) => {
                      const rosters = session.session_enrollments || [];
                      const userRoster = rosters.find((r: OpportunityRoster) => r.user_id === user?.id);
                      const requestStatus = userRoster?.status || null;

                      let statusBadge = null;
                      if (role === "Volunteer" && requestStatus) {
                        let style = "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400";
                        if (requestStatus === "Approved") style = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-100/30";
                        if (requestStatus === "Pending") style = "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-100/30";
                        
                        statusBadge = (
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${style}`}>
                            {requestStatus}
                          </span>
                        );
                      }

                      return (
                        <div
                          key={session.id}
                          onClick={() => router.push(`/schedule/${session.id}`)}
                          className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/40 hover:border-zinc-200 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700 p-5 rounded-2xl flex flex-col gap-4 transition-all cursor-pointer relative overflow-hidden group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${getDotStyle(session)}`} />
                              {formatTime(session.start_time)} - {formatTime(session.end_time)}
                            </span>
                            {statusBadge}
                          </div>
                          
                          <div>
                            <h4 className="font-extrabold text-base text-zinc-900 dark:text-white leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {session.topic}
                            </h4>
                          </div>

                          <div className="flex items-center justify-between border-t border-zinc-200/40 dark:border-zinc-800/80 pt-3 text-xs">
                            <span className="text-zinc-500 font-medium flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              Target Capacity
                            </span>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200">
                              {session.capacity} Volunteers
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM ACTION BUTTONS (VOLUNTEERS ONLY) */}
        {role === "Volunteer" && (
          <div className="flex items-center justify-center gap-5 mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <button
              onClick={() => {
                setRequestModalType("add");
                setIsRequestModalOpen(true);
              }}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl min-h-[48px] active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-emerald-500/10"
            >
              Request a Session Shift
            </button>
            
            <button
              onClick={() => {
                setRequestModalType("drop");
                setIsRequestModalOpen(true);
              }}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl min-h-[48px] active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-indigo-600/20"
            >
              Change/Drop Shift Request
            </button>
          </div>
        )}

      </div>

      {/* CREATE SESSION MODAL (FOR CENTER LEAD / ADMIN) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center select-none animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-850 p-6 flex flex-col gap-5 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto pb-6">
            
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
                className="p-1 rounded-full text-zinc-450 dark:text-zinc-555 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl p-3.5 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-455 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-rose-800 dark:text-rose-355 leading-relaxed">
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

            <form onSubmit={handleCreateSession} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
                  Session Topic
                </label>
                <input
                  type="text"
                  placeholder="e.g. Basic Arithmetic & Counting"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
                  Target Capacity (Volunteers Needed)
                </label>
                <input
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                />
              </div>

              {/* Assign Students Multi-Select Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400 flex items-center justify-between">
                  <span>Assign Students (Initial Roster)</span>
                  <span className="text-[10px] text-zinc-400 font-normal">
                    {selectedStudentIds.length} selected
                  </span>
                </label>
                {centerStudents.length === 0 ? (
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-400 italic">
                    No students found in your center to assign.
                  </div>
                ) : (
                  <select
                    multiple
                    value={selectedStudentIds}
                    onChange={(e) => {
                      const options = Array.from(
                        e.target.selectedOptions,
                        (opt) => opt.value
                      );
                      setSelectedStudentIds(options);
                    }}
                    disabled={isSubmitting}
                    className="w-full min-h-[100px] px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50 font-medium select-none cursor-pointer"
                  >
                    {centerStudents.map((st) => (
                      <option key={st.id} value={st.id} className="py-1 px-2">
                        {st.name}
                      </option>
                    ))}
                  </select>
                )}
                <span className="text-[10px] text-zinc-400 font-medium">
                  Hold Ctrl/Cmd to select multiple students. You can also leave empty for an empty initial roster.
                </span>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-455 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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
                  className="w-full min-h-[48px] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-350 font-bold text-sm rounded-xl flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHIFT REQUEST / MANAGE SHIFTS DIALOG (DESKTOP INTERACTIVE POPUP) */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center select-none animate-fade-in p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-3xl border border-zinc-200 dark:border-zinc-850 p-6 flex flex-col gap-5 shadow-2xl animate-scale-in max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-850 pb-3">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                {requestModalType === "add" ? "Request an Upcoming Shift" : "Manage / Drop Shift Requests"}
              </h2>
              <button
                onClick={() => {
                  setIsRequestModalOpen(false);
                  setFormSuccess("");
                }}
                className="p-1 rounded-full text-zinc-450 dark:text-zinc-555 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 rounded-2xl p-3.5 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-455 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-355 leading-relaxed">
                  {formSuccess}
                </span>
              </div>
            )}

            {requestModalType === "add" ? (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Below are all upcoming sessions at this center. Select a shift you would like to request to join:
                </p>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {opportunities.length === 0 ? (
                    <p className="text-center text-xs text-zinc-400 py-8">No upcoming sessions found.</p>
                  ) : (
                    opportunities.map((session) => {
                      const rosters = session.session_enrollments || [];
                      const userRoster = rosters.find((r) => r.user_id === user?.id);
                      const requestStatus = userRoster?.status || null;
                      const approvedCount = rosters.filter((r) => r.status === "Approved").length;
                      const remaining = Math.max(0, session.capacity - approvedCount);

                      return (
                        <div key={session.id} className="border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-950/20">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                              {formatDate(session.start_time)} • {formatTime(session.start_time)}
                            </span>
                            <span className="font-extrabold text-sm text-zinc-900 dark:text-white">{session.topic}</span>
                            <span className="text-[10px] text-zinc-500">{remaining} spots remaining</span>
                          </div>

                          {requestStatus ? (
                            <span className="px-3 py-1.5 text-xs font-bold bg-zinc-150 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-400 rounded-lg">
                              {requestStatus}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRequestJoin(session.id)}
                              disabled={remaining <= 0}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-100 disabled:text-zinc-400 text-white font-bold text-xs rounded-xl min-h-[38px] transition-all cursor-pointer"
                            >
                              Request
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Your current active shift registrations and requests:
                </p>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {opportunities.filter(s => (s.session_enrollments || []).some(r => r.user_id === user?.id)).length === 0 ? (
                    <p className="text-center text-xs text-zinc-400 py-8">You haven&apos;t requested or joined any upcoming shifts.</p>
                  ) : (
                    opportunities.filter(s => (s.session_enrollments || []).some(r => r.user_id === user?.id)).map((session) => {
                      const rosters = session.session_enrollments || [];
                      const userRoster = rosters.find((r) => r.user_id === user?.id);
                      const requestStatus = userRoster?.status || "Pending";

                      return (
                        <div key={session.id} className="border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-950/20">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                              {formatDate(session.start_time)} • {formatTime(session.start_time)}
                            </span>
                            <span className="font-extrabold text-sm text-zinc-900 dark:text-white">{session.topic}</span>
                            <span className="text-[10px] text-zinc-550">Status: <strong className="font-bold">{requestStatus}</strong></span>
                          </div>

                          <button
                            onClick={() => handleDropRequest(session.id)}
                            className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl min-h-[38px] transition-all cursor-pointer"
                          >
                            Drop Shift
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-zinc-150 dark:border-zinc-850 mt-2">
              <button
                onClick={() => setIsRequestModalOpen(false)}
                className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300 font-bold text-sm rounded-xl min-h-[44px] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECURRING BATCH BUILDER */}
      {assignedCenterId && (
        <BatchBuilder
          centerId={assignedCenterId}
          isOpen={isBatchBuilderOpen}
          onClose={() => setIsBatchBuilderOpen(false)}
          onSuccess={() => fetchSessions()}
        />
      )}

    </div>
  );
}
