"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Check,
  XCircle,
  BadgeCheck,
  QrCode
} from "lucide-react";

type Session = Database["public"]["Tables"]["sessions"]["Row"];

interface EnrollmentDetails {
  id: string;
  user_id: string;
  status: string;
  users: {
    id: string;
    email: string;
  };
}

interface SessionDetailsData {
  session: Session;
  enrollments: EnrollmentDetails[];
  attendance: any[];
}

export default function SessionDetailsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter();
  const unwrappedParams = React.use(params);
  const { sessionId } = unwrappedParams;

  const [selectedSessionData, setSelectedSessionData] = useState<SessionDetailsData | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(true);
  const [detailsActionLoading, setDetailsActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessionDetails = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionError || !sessionData) return;

        const { data: enrollData, error: enrollError } = await supabase
          .from("session_enrollments")
          .select(`
            id,
            user_id,
            status,
            users (
              id,
              email
            )
          `)
          .eq("session_id", sessionId);

        const { data: attendData, error: attendError } = await supabase
          .from("attendance")
          .select("*")
          .eq("session_id", sessionId);

        if (!enrollError && !attendError) {
          setSelectedSessionData({
            session: sessionData,
            enrollments: enrollData as unknown as EnrollmentDetails[],
            attendance: attendData || []
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsDetailsLoading(false);
      }
    };

    fetchSessionDetails();
  }, [sessionId]);

  const handleEnrollmentAction = async (enrollmentId: string, newStatus: string) => {
    setDetailsActionLoading(enrollmentId);
    try {
      const { error } = await supabase
        .from("session_enrollments")
        .update({ status: newStatus })
        .eq("id", enrollmentId);
      
      if (!error && selectedSessionData) {
        setSelectedSessionData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            enrollments: prev.enrollments.map(e => e.id === enrollmentId ? { ...e, status: newStatus } : e)
          };
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailsActionLoading(null);
    }
  };

  if (isDetailsLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin stroke-[2]" />
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Loading Roster...
        </span>
      </div>
    );
  }

  if (!selectedSessionData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3 px-5">
        <AlertCircle className="w-10 h-10 text-rose-500" />
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 text-center">
          Failed to load session details or session not found.
        </span>
        <button
          onClick={() => router.back()}
          className="mt-4 px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-sm min-h-[48px]"
        >
          Go Back
        </button>
      </div>
    );
  }

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

  return (
    <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in relative min-h-full pb-20">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors w-fit font-medium text-sm min-h-[48px]"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Schedule
        </button>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-snug">
              {selectedSessionData.session.topic}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-zinc-400" />
                {formatDate(selectedSessionData.session.start_time)}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-zinc-400" />
                {formatTime(selectedSessionData.session.start_time)} - {formatTime(selectedSessionData.session.end_time)}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push(`/kiosk/${sessionId}`)}
            className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-5 py-2.5 rounded-xl font-bold text-sm min-h-[48px] transition-all active:scale-95 shadow-md shadow-zinc-900/10"
          >
            <QrCode className="w-4 h-4" />
            Launch Kiosk
          </button>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Slots Filled</span>
          <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300">
            {selectedSessionData.enrollments.filter(e => e.status === 'Approved').length} <span className="text-sm font-semibold text-emerald-600/70">/ {selectedSessionData.session.capacity}</span>
          </span>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Checked In</span>
          <span className="text-2xl font-black text-indigo-800 dark:text-indigo-300">
            {selectedSessionData.attendance.filter(a => a.status === 'Present').length}
          </span>
        </div>
      </div>

      {/* Lists */}
      <div className="flex flex-col gap-8 mt-2">
        {/* Pending Requests */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pending Requests ({selectedSessionData.enrollments.filter(e => e.status === 'Pending').length})
          </h3>
          {selectedSessionData.enrollments.filter(e => e.status === 'Pending').length === 0 ? (
            <div className="text-sm text-zinc-500 italic p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800">No pending requests.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedSessionData.enrollments.filter(e => e.status === 'Pending').map(e => (
                <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl gap-4 shadow-sm">
                  <div className="flex flex-col">
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{e.users.email}</span>
                    <span className="text-xs text-zinc-500">Volunteer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEnrollmentAction(e.id, 'Approved')}
                      disabled={detailsActionLoading === e.id}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/50 dark:hover:bg-emerald-800 dark:text-emerald-300 font-bold px-4 py-2.5 rounded-lg text-sm min-h-[48px] transition-colors"
                    >
                      {detailsActionLoading === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleEnrollmentAction(e.id, 'Denied')}
                      disabled={detailsActionLoading === e.id}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-900/50 dark:hover:bg-rose-800 dark:text-rose-300 font-bold px-4 py-2.5 rounded-lg text-sm min-h-[48px] transition-colors"
                    >
                      {detailsActionLoading === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirmed Volunteers */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Confirmed Volunteers ({selectedSessionData.enrollments.filter(e => e.status === 'Approved').length})
          </h3>
          {selectedSessionData.enrollments.filter(e => e.status === 'Approved').length === 0 ? (
            <div className="text-sm text-zinc-500 italic p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800">No confirmed volunteers yet.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedSessionData.enrollments.filter(e => e.status === 'Approved').map(e => {
                const hasCheckedIn = selectedSessionData.attendance.some(a => a.user_id === e.user_id && a.status === 'Present');
                return (
                  <div key={e.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                    <div className="flex flex-col">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          {e.users.email}
                          {hasCheckedIn && <BadgeCheck className="w-4 h-4 text-indigo-500" />}
                        </span>
                        <span className="text-xs text-zinc-500">Volunteer</span>
                    </div>
                    {hasCheckedIn && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 rounded-full">
                        Checked In
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
