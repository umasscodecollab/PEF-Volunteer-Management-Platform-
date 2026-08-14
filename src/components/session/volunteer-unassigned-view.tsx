"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Loader2,
  ChevronLeft,
  Sparkles,
  Repeat,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  FileText
} from "lucide-react";
import { RecurrenceModal } from "./recurrence-modal";

type Session = Database["public"]["Tables"]["sessions"]["Row"];

interface VolunteerUnassignedViewProps {
  session: Session;
  currentUser?: any;
  role?: string;
}

export function VolunteerUnassignedView({
  session,
  currentUser: initialUser,
  role: initialRole
}: VolunteerUnassignedViewProps) {
  const router = useRouter();
  const sessionId = session.id;

  const [currentUserId, setCurrentUserId] = useState<string>(initialUser?.id || "");
  const [centerData, setCenterData] = useState<{ name: string; location: string | null } | null>(null);
  const [enrolledStudentsCount, setEnrolledStudentsCount] = useState<number>(0);
  const [approvedVolunteersCount, setApprovedVolunteersCount] = useState<number>(0);
  const [enrollmentStatus, setEnrollmentStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingDirectly, setIsRequestingDirectly] = useState(false);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);

  useEffect(() => {
    const fetchDiscoveryData = async () => {
      setIsLoading(true);
      try {
        let authId = currentUserId;
        if (!authId) {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            authId = authUser.id;
            setCurrentUserId(authUser.id);
          }
        }

        // 1. Fetch center location details
        if (session.center_id) {
          const { data: cData } = await supabase
            .from("centers")
            .select("name, location")
            .eq("id", session.center_id)
            .maybeSingle();
          if (cData) setCenterData(cData);
        }

        // 2. Query total number of students enrolled (student_attendance count for this session_id)
        const { count: studentsCount, error: countErr } = await supabase
          .from("student_attendance")
          .select("*", { count: "exact", head: true })
          .eq("session_id", sessionId);

        if (!countErr && studentsCount !== null) {
          setEnrolledStudentsCount(studentsCount);
        }

        // 3. Query existing volunteer enrollments for capacity and user status
        const { data: enrollments } = await supabase
          .from("session_enrollments")
          .select("user_id, status")
          .eq("session_id", sessionId);

        if (enrollments) {
          const approved = enrollments.filter((e) => e.status === "Approved").length;
          setApprovedVolunteersCount(approved);

          if (authId) {
            const userEnr = enrollments.find((e) => e.user_id === authId);
            if (userEnr) {
              setEnrollmentStatus(userEnr.status);
            }
          }
        }
      } catch (err) {
        console.error("Error loading volunteer discovery view:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiscoveryData();
  }, [sessionId, session.center_id, currentUserId]);

  const handleActionClick = () => {
    if (session.batch_id) {
      // If part of recurring series, open Recurrence Modal
      setIsRecurrenceModalOpen(true);
    } else {
      // Direct shift request
      handleDirectRequest();
    }
  };

  const handleDirectRequest = async () => {
    if (!currentUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to request shifts.");
        return;
      }
      setCurrentUserId(user.id);
    }

    setIsRequestingDirectly(true);
    try {
      // 1. Check if user is already enrolled
      const { data: existing } = await supabase
        .from("session_enrollments")
        .select("id, status")
        .eq("session_id", sessionId)
        .eq("user_id", currentUserId)
        .maybeSingle();

      if (existing) {
        if (existing.status === "Approved") {
          toast.info("You are already confirmed for this session.");
          setEnrollmentStatus("Approved");
          return;
        }
        setEnrollmentStatus(existing.status);
        toast.info("Your request has already been submitted (Pending approval).");
        return;
      }

      // 2. Perform INSERT
      const { error } = await supabase
        .from("session_enrollments")
        .insert({
          session_id: sessionId,
          user_id: currentUserId,
          status: "Pending",
        });

      if (error) throw error;

      setEnrollmentStatus("Pending");
      toast.success("Successfully requested to volunteer! Pending approval from Center Lead.");
    } catch (err: any) {
      console.error("Direct request error:", err);
      toast.error(err?.message || "Failed to request shift.");
    } finally {
      setIsRequestingDirectly(false);
    }
  };

  const formatDateLong = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatTimeRange = (startIso: string, endIso: string) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const startStr = start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    const endStr = end.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
    return `${startStr} - ${endStr}`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin stroke-[2]" />
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Loading Session Details...
        </span>
      </div>
    );
  }

  const capacity = session.capacity || 1;
  const isFull = approvedVolunteersCount >= capacity;
  const isPending = enrollmentStatus === "Pending";
  const isApproved = enrollmentStatus === "Approved";

  return (
    <div className="flex flex-col gap-6 px-4 sm:px-6 py-6 select-none animate-fade-in relative min-h-full max-w-4xl mx-auto pb-28">
      {/* Top Back Navigation */}
      <button
        onClick={() => router.push("/schedule")}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors w-fit font-medium text-sm min-h-[44px] cursor-pointer"
      >
        <ChevronLeft className="w-5 h-5" />
        Back to Schedule
      </button>

      {/* Main Details Discovery Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-zinc-950/5 flex flex-col gap-6 relative overflow-hidden">
        {/* Subtle decorative accent */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none" />

        {/* Badges and Topic Header */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {session.batch_id && (
              <button
                type="button"
                onClick={() => setIsRecurrenceModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 transition-all cursor-pointer shadow-xs"
              >
                <Repeat className="w-3.5 h-3.5" />
                Part of a Recurring Series
              </button>
            )}

            {session.is_urgent && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                <Megaphone className="w-3.5 h-3.5 stroke-[2.2]" />
                Urgent Vacancy
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-tight">
            {session.topic}
          </h1>
        </div>

        {/* Key Information Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Date & Time */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Date & Time</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {formatDateLong(session.start_time)}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                {formatTimeRange(session.start_time, session.end_time)}
              </span>
            </div>
          </div>

          {/* Center Location */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Center Location</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {centerData?.name || "Community Center"}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 line-clamp-1">
                {centerData?.location || "Assigned Center"}
              </span>
            </div>
          </div>

          {/* Students Enrolled Metric */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Students Enrolled</span>
              <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {enrolledStudentsCount}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Registered in this session roster
              </span>
            </div>
          </div>

          {/* Volunteer Openings / Capacity */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Volunteer Slots</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {Math.max(0, capacity - approvedVolunteersCount)}
                </span>
                <span className="text-xs font-semibold text-zinc-500">
                  open of {capacity} {capacity === 1 ? "slot" : "slots"}
                </span>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {approvedVolunteersCount} confirmed facilitator{approvedVolunteersCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Session Notes if present */}
        {session.notes && (
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex items-start gap-3">
            <FileText className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Session Notes</span>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                {session.notes}
              </p>
            </div>
          </div>
        )}

        {/* Status Callout if Requested or Approved */}
        {isPending && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
            <Clock className="w-5 h-5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-bold">Shift Request Pending</span>
              <span className="text-xs opacity-90">Your request is waiting for review and approval by the Center Lead.</span>
            </div>
          </div>
        )}

        {isApproved && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-bold">You are Confirmed for this Shift</span>
              <span className="text-xs opacity-90">You have been approved as a volunteer for this session.</span>
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <div className="pt-2">
          {isApproved ? (
            <div className="w-full flex items-center justify-center gap-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 px-6 py-4 rounded-2xl font-bold text-sm min-h-[52px]">
              <CheckCircle2 className="w-5 h-5" />
              <span>Confirmed as Volunteer</span>
            </div>
          ) : isPending ? (
            <div className="w-full flex items-center justify-center gap-2 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 px-6 py-4 rounded-2xl font-bold text-sm min-h-[52px]">
              <Clock className="w-5 h-5 stroke-[2.2]" />
              <span>Requested (Pending Approval)</span>
            </div>
          ) : isFull ? (
            <div className="w-full flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-6 py-4 rounded-2xl font-bold text-sm min-h-[52px]">
              <span>Session is Full</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleActionClick}
              disabled={isRequestingDirectly}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-6 py-4 rounded-2xl font-bold text-base min-h-[52px] transition-all shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
            >
              {isRequestingDirectly ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5 stroke-[2.2]" />
              )}
              <span>Request to Volunteer</span>
            </button>
          )}
        </div>
      </div>

      {/* Recurrence Series Modal */}
      {session.batch_id && (
        <RecurrenceModal
          isOpen={isRecurrenceModalOpen}
          onClose={() => setIsRecurrenceModalOpen(false)}
          currentSession={session}
          centerName={centerData?.name}
          onRequested={() => setEnrollmentStatus("Pending")}
        />
      )}
    </div>
  );
}
