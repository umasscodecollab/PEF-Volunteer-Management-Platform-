"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import {
  X,
  Calendar as CalendarIcon,
  List as ListIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  CalendarDays,
  Sparkles,
  Repeat,
  AlertCircle
} from "lucide-react";

type Session = Database["public"]["Tables"]["sessions"]["Row"];

interface RecurrenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: Session;
  centerName?: string;
  onRequested?: () => void;
}

export function RecurrenceModal({
  isOpen,
  onClose,
  currentSession,
  centerName,
  onRequested
}: RecurrenceModalProps) {
  const [activeTab, setActiveTab] = useState<"list" | "calendar">("list");
  const [futureSessions, setFutureSessions] = useState<Session[]>([]);
  const [userEnrollments, setUserEnrollments] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkSelected, setIsBulkSelected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestingSessionId, setRequestingSessionId] = useState<string | null>(null);

  // Calendar month view state
  const [calendarDate, setCalendarDate] = useState(() => new Date(currentSession.start_time || new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(() => {
    return new Date(currentSession.start_time).toISOString().split("T")[0];
  });

  useEffect(() => {
    if (!isOpen) return;

    const fetchRecurringSeries = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        }

        // Get start of today in ISO
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayIso = today.toISOString();

        let query = supabase
          .from("sessions")
          .select("*");

        if (currentSession.batch_id) {
          query = query
            .eq("batch_id", currentSession.batch_id)
            .gte("start_time", todayIso)
            .order("start_time", { ascending: true });
        } else {
          query = query
            .eq("id", currentSession.id)
            .order("start_time", { ascending: true });
        }

        const { data: sessions, error } = await query;
        if (error) throw error;

        const sessionList = sessions || [];
        setFutureSessions(sessionList);

        // Fetch existing user enrollments for these sessions
        if (user && sessionList.length > 0) {
          const sessionIds = sessionList.map((s) => s.id);
          const { data: enrollments } = await supabase
            .from("session_enrollments")
            .select("session_id, status")
            .eq("user_id", user.id)
            .in("session_id", sessionIds);

          const enrollMap: Record<string, string> = {};
          (enrollments || []).forEach((e) => {
            enrollMap[e.session_id] = e.status;
          });
          setUserEnrollments(enrollMap);
        }
      } catch (err: any) {
        console.error("Error loading recurring series:", err);
        toast.error("Failed to load recurring session schedule.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecurringSeries();
  }, [isOpen, currentSession.batch_id, currentSession.id, currentSession.start_time]);

  if (!isOpen) return null;

  const formatDateShort = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  // Calendar Helpers
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCalendarDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(year, month + 1, 1));
  };

  // Map session dates: YYYY-MM-DD -> Session[]
  const sessionsByDate = futureSessions.reduce<Record<string, Session[]>>((acc, s) => {
    const dateStr = new Date(s.start_time).toISOString().split("T")[0];
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(s);
    return acc;
  }, {});

  // Determine confirmation & requestable statuses
  const isSessionConfirmed = (s: Session) => {
    return userEnrollments[s.id] === "Approved" || (s as any).facilitator_id === currentUserId;
  };

  const isSessionPending = (s: Session) => {
    return userEnrollments[s.id] === "Pending";
  };

  // Unconfirmed sessions (eligible for shift requests)
  const unconfirmedSessions = futureSessions.filter((s) => !isSessionConfirmed(s));
  const confirmedSessions = futureSessions.filter((s) => isSessionConfirmed(s));
  const requestableSessions = unconfirmedSessions.filter((s) => !isSessionPending(s));

  const isCurrentConfirmed = isSessionConfirmed(currentSession);
  const isCurrentPending = isSessionPending(currentSession);

  // Single Session Request Handler
  const handleSingleSessionRequest = async (targetSession: Session) => {
    if (isSessionConfirmed(targetSession)) {
      toast.info("You are already confirmed for this session.");
      return;
    }
    if (isSessionPending(targetSession)) {
      toast.info("You have already requested this session. Pending approval.");
      return;
    }

    setRequestingSessionId(targetSession.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to request a shift.");
        return;
      }

      // Check if already exists in DB
      const { data: existing } = await supabase
        .from("session_enrollments")
        .select("id, status")
        .eq("session_id", targetSession.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        setUserEnrollments((prev) => ({ ...prev, [targetSession.id]: existing.status }));
        if (existing.status === "Approved") {
          toast.info("You are already confirmed for this session.");
        } else {
          toast.info("Your request for this session is already pending approval.");
        }
        return;
      }

      const { error } = await supabase
        .from("session_enrollments")
        .insert({
          session_id: targetSession.id,
          user_id: user.id,
          status: "Pending",
        });

      if (error) throw error;

      setUserEnrollments((prev) => ({ ...prev, [targetSession.id]: "Pending" }));
      toast.success("Successfully requested to volunteer! Pending approval from Center Lead.");
      if (onRequested) onRequested();
    } catch (err: any) {
      console.error("Error submitting single shift request:", err);
      toast.error(err?.message || "Failed to submit shift request.");
    } finally {
      setRequestingSessionId(null);
    }
  };

  // Bulk or Primary Confirmation Handler
  const handleConfirmRequest = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to request a shift.");
        return;
      }

      if (isBulkSelected) {
        // Bulk request ONLY for unconfirmed sessions that haven't been requested yet
        if (requestableSessions.length === 0) {
          toast.info("You are already confirmed or have pending requests for all upcoming sessions.");
          return;
        }

        const enrollmentsToInsert = requestableSessions.map((s) => ({
          session_id: s.id,
          user_id: user.id,
          status: "Pending",
        }));

        const { error } = await supabase
          .from("session_enrollments")
          .insert(enrollmentsToInsert);

        if (error) throw error;

        // Update local state
        const updatedMap = { ...userEnrollments };
        requestableSessions.forEach((s) => {
          updatedMap[s.id] = "Pending";
        });
        setUserEnrollments(updatedMap);

        toast.success(
          `Successfully requested ${requestableSessions.length} upcoming session${requestableSessions.length > 1 ? "s" : ""}!`
        );
      } else {
        // Single session request for the current session (if not confirmed)
        if (isCurrentConfirmed) {
          toast.info("You are already confirmed for this session.");
          return;
        }
        if (isCurrentPending) {
          toast.info("You have already requested this session. Pending approval.");
          return;
        }

        // Check if already in DB
        const { data: existing } = await supabase
          .from("session_enrollments")
          .select("id, status")
          .eq("session_id", currentSession.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) {
          setUserEnrollments((prev) => ({ ...prev, [currentSession.id]: existing.status }));
          if (existing.status === "Approved") {
            toast.info("You are already confirmed for this session.");
          } else {
            toast.info("Your request is already pending approval.");
          }
          return;
        }

        const { error } = await supabase
          .from("session_enrollments")
          .insert({
            session_id: currentSession.id,
            user_id: user.id,
            status: "Pending",
          });

        if (error) throw error;

        setUserEnrollments((prev) => ({ ...prev, [currentSession.id]: "Pending" }));
        toast.success("Successfully requested to volunteer! Pending approval from Center Lead.");
      }

      if (onRequested) onRequested();
      onClose();
    } catch (err: any) {
      console.error("Error submitting shift request:", err);
      toast.error(err?.message || "Failed to submit shift request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedDateSessions = selectedCalendarDate ? sessionsByDate[selectedCalendarDate] || [] : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[95vw] sm:max-w-2xl max-h-[92vh] bg-white dark:bg-zinc-900 shadow-2xl flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                Shift Schedule & Recurrence
              </span>
              {currentSession.batch_id && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <Repeat className="w-3 h-3" /> Recurring Series
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {currentSession.topic} {centerName ? `• ${centerName}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Series Status Summary Pill */}
        {confirmedSessions.length > 0 && (
          <div className="px-6 py-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-xs shrink-0">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              You are confirmed for {confirmedSessions.length} of {futureSessions.length} upcoming session{futureSessions.length !== 1 ? "s" : ""}
            </span>
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
              {unconfirmedSessions.length} open for request
            </span>
          </div>
        )}

        {/* View Toggle Tabs */}
        <div className="px-6 pt-4 pb-2 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between shrink-0">
          <div className="inline-flex p-1 bg-zinc-200/80 dark:bg-zinc-800 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "list"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              List View ({futureSessions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("calendar")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "calendar"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Calendar View
            </button>
          </div>

          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hidden sm:inline-block">
            {unconfirmedSessions.length} unconfirmed / {futureSessions.length} total
          </span>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[260px] max-h-[420px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin stroke-[2]" />
              <span className="text-xs font-semibold text-zinc-400">Loading series dates...</span>
            </div>
          ) : activeTab === "list" ? (
            /* List View */
            <div className="flex flex-col gap-2.5">
              {futureSessions.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500 italic">
                  No upcoming sessions found for this batch.
                </div>
              ) : (
                futureSessions.map((sessionItem, index) => {
                  const isCurrent = sessionItem.id === currentSession.id;
                  const confirmed = isSessionConfirmed(sessionItem);
                  const pending = isSessionPending(sessionItem);
                  const isActionLoading = requestingSessionId === sessionItem.id;

                  return (
                    <div
                      key={sessionItem.id}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                        confirmed
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60"
                          : isCurrent
                          ? "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-300 dark:border-zinc-700 ring-1 ring-zinc-400/20"
                          : "bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                          confirmed
                            ? "bg-emerald-600 text-white shadow-xs"
                            : isCurrent
                            ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                              {formatDateShort(sessionItem.start_time)}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                Current
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                            {formatTime(sessionItem.start_time)} - {formatTime(sessionItem.end_time)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {confirmed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-300/60 dark:border-emerald-800/80">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Confirmed
                          </span>
                        ) : pending ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-950/60 px-3 py-1.5 rounded-xl border border-amber-300/60 dark:border-amber-800/80">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Requested
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSingleSessionRequest(sessionItem)}
                            disabled={isActionLoading || isSubmitting}
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isActionLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            <span>Request Shift</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Calendar View */
            <div className="flex flex-col gap-4">
              {/* Calendar Month Navigation */}
              <div className="flex items-center justify-between px-1">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-600" />
                  {monthName}
                </h4>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 text-center select-none bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                  <div key={day} className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 py-1">
                    {day}
                  </div>
                ))}

                {/* Empty days before 1st of month */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-9" />
                ))}

                {/* Days of Month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const sessionsOnDay = sessionsByDate[dateStr] || [];
                  const hasSession = sessionsOnDay.length > 0;
                  const isSelected = selectedCalendarDate === dateStr;
                  const hasConfirmedSession = sessionsOnDay.some((s) => isSessionConfirmed(s));

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => setSelectedCalendarDate(dateStr)}
                      className={`h-9 rounded-lg text-xs font-semibold flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-600/30"
                          : hasConfirmedSession
                          ? "bg-emerald-100/90 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 font-bold"
                          : hasSession
                          ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300 font-bold hover:bg-indigo-100"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <span>{dayNum}</span>
                      {hasSession && (
                        <span className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${
                          isSelected
                            ? "bg-white"
                            : hasConfirmedSession
                            ? "bg-emerald-600 dark:bg-emerald-400"
                            : "bg-indigo-600 dark:bg-indigo-400"
                        }`} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Day Info Card */}
              {selectedCalendarDate && (
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl flex flex-col gap-2.5">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Sessions on {new Date(selectedCalendarDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}:
                  </span>
                  {selectedDateSessions.length === 0 ? (
                    <span className="text-xs text-zinc-400 italic">No recurring session on this day.</span>
                  ) : (
                    selectedDateSessions.map((s) => {
                      const confirmed = isSessionConfirmed(s);
                      const pending = isSessionPending(s);
                      return (
                        <div key={s.id} className="flex items-center justify-between text-xs py-1 border-b border-zinc-200/60 dark:border-zinc-700/40 last:border-0">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                            {formatTime(s.start_time)} - {formatTime(s.end_time)}
                          </span>
                          <div>
                            {confirmed ? (
                              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                              </span>
                            ) : pending ? (
                              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" /> Requested
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSingleSessionRequest(s)}
                                disabled={requestingSessionId === s.id}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                              >
                                {requestingSessionId === s.id ? "Requesting..." : "Request Shift"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bulk Checkbox & Confirmation Footer */}
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900 flex flex-col gap-4 shrink-0">
          {unconfirmedSessions.length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>You are confirmed for all upcoming sessions in this recurring series!</span>
            </div>
          ) : (
            currentSession.batch_id && unconfirmedSessions.length > 1 && (
              <label className="flex items-start gap-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={isBulkSelected}
                  onChange={(e) => setIsBulkSelected(e.target.checked)}
                  className="mt-0.5 w-4.5 h-4.5 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:checked:bg-emerald-600 cursor-pointer accent-emerald-600"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 transition-colors">
                    Request to volunteer for all {unconfirmedSessions.length} unconfirmed upcoming sessions in this series
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {confirmedSessions.length > 0
                      ? `Excludes the ${confirmedSessions.length} session${confirmedSessions.length > 1 ? "s" : ""} you are already confirmed for.`
                      : "Submits shift requests for each date in this recurring batch in one click."}
                  </span>
                </div>
              </label>
            )
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50 min-h-[42px]"
            >
              {unconfirmedSessions.length === 0 ? "Close" : "Cancel"}
            </button>

            {unconfirmedSessions.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmRequest}
                disabled={isSubmitting || (!isBulkSelected && (isCurrentConfirmed || isCurrentPending))}
                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 min-h-[42px]"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 stroke-[2.2]" />
                )}
                <span>
                  {isBulkSelected
                    ? `Request All ${unconfirmedSessions.length} Unconfirmed Sessions`
                    : isCurrentConfirmed
                    ? "Current Session Confirmed"
                    : isCurrentPending
                    ? "Current Session Requested"
                    : "Confirm Shift Request"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
