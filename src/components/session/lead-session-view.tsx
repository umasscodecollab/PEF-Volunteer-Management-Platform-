"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Users,
  Loader2,
  ChevronLeft,
  Check,
  XCircle,
  BadgeCheck,
  CheckCircle2,
  UserCheck,
  GraduationCap,
  Megaphone,
  Award,
  Repeat
} from "lucide-react";
import { BulkAssessmentSheet } from "@/components/bulk-assessment-sheet";
import { RecurrenceModal } from "./recurrence-modal";

type Session = Database["public"]["Tables"]["sessions"]["Row"];

interface EnrollmentDetails {
  id: string;
  user_id: string;
  status: string;
  users: {
    id: string;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  };
}

interface SessionDetailsData {
  session: Session;
  enrollments: EnrollmentDetails[];
  attendance: any[];
}

interface LeadSessionViewProps {
  session: Session;
  currentUser?: any;
  role?: string;
}

export function LeadSessionView({ session: initialSession, currentUser: initialUser, role: initialRole }: LeadSessionViewProps) {
  const router = useRouter();
  const sessionId = initialSession.id;

  const [selectedSessionData, setSelectedSessionData] = useState<SessionDetailsData | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(true);
  const [detailsActionLoading, setDetailsActionLoading] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>(initialUser?.id || "");
  const [currentUserRole, setCurrentUserRole] = useState<string>(initialRole || "Center Lead");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isAssessmentSheetOpen, setIsAssessmentSheetOpen] = useState(false);
  const [isRequestingShift, setIsRequestingShift] = useState(false);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);

  useEffect(() => {
    const fetchSessionDetails = async () => {
      try {
        if (!currentUserId) {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            setCurrentUserId(authUser.id);
            const { data: userProfile } = await supabase
              .from("users")
              .select("role")
              .eq("id", authUser.id)
              .maybeSingle();
            if (userProfile?.role) {
              setCurrentUserRole(userProfile.role);
            }
          }
        }

        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionError || !sessionData) return;

        let enrollData: any[] = [];
        const { data: sEnroll } = await supabase
          .from("session_enrollments")
          .select(`
            id,
            user_id,
            status,
            users (
              id,
              email,
              first_name,
              last_name
            )
          `)
          .eq("session_id", sessionId);

        if (sessionData.batch_id) {
          const { data: batchSessions } = await supabase
            .from("sessions")
            .select("id")
            .eq("batch_id", sessionData.batch_id);

          const sessionIds = batchSessions && batchSessions.length > 0
            ? batchSessions.map(s => s.id)
            : [sessionId];

          const { data: bEnroll } = await supabase
            .from("session_enrollments")
            .select(`
              id,
              user_id,
              status,
              users (
                id,
                email,
                first_name,
                last_name
              )
            `)
            .in("session_id", sessionIds);

          const map = new Map();
          (sEnroll || []).forEach((item: any) => map.set(item.user_id, item));
          (bEnroll || []).forEach((item: any) => {
            if (!map.has(item.user_id)) {
              map.set(item.user_id, item);
            }
          });
          enrollData = Array.from(map.values());
        } else {
          if (sEnroll) enrollData = sEnroll;
        }

        const { data: attendData, error: attendError } = await supabase
          .from("attendance")
          .select("*, users(email)")
          .eq("session_id", sessionId);

        if (!attendError) {
          setSelectedSessionData({
            session: sessionData,
            enrollments: enrollData as unknown as EnrollmentDetails[],
            attendance: attendData || []
          });
        }
      } catch (err) {
        console.error("Error fetching session details:", err);
      } finally {
        setIsDetailsLoading(false);
      }
    };

    fetchSessionDetails();
  }, [sessionId, currentUserId]);

  const handleToggleAttendance = async (userId: string, targetStatus: 'Present' | 'Absent') => {
    if (!selectedSessionData) return;
    if (currentUserRole === "Volunteer") {
      toast.error("Volunteers are not permitted to mark attendance for other volunteers.");
      return;
    }
    setDetailsActionLoading(userId);
    try {
      const existing = selectedSessionData.attendance.find(a => a.user_id === userId);

      if (existing) {
        const { error } = await supabase
          .from("attendance")
          .update({
            status: targetStatus,
            checkout_time: targetStatus === 'Absent' ? new Date().toISOString() : null
          })
          .eq("id", existing.id);

        if (error) {
          toast.error(`Failed to update attendance: ${error.message}`);
          return;
        }

        setSelectedSessionData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            attendance: prev.attendance.map(a =>
              a.id === existing.id
                ? { ...a, status: targetStatus, checkout_time: targetStatus === 'Absent' ? new Date().toISOString() : null }
                : a
            )
          };
        });
      } else {
        const { data: inserted, error } = await supabase
          .from("attendance")
          .insert({
            session_id: sessionId,
            user_id: userId,
            status: targetStatus,
            check_in_time: new Date().toISOString()
          })
          .select("*, users(email)")
          .single();

        if (error) {
          toast.error(`Failed to record attendance: ${error.message}`);
          return;
        }

        setSelectedSessionData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            attendance: [...prev.attendance, inserted]
          };
        });
      }
      toast.success(`Marked volunteer as ${targetStatus}`);
    } catch (err: any) {
      console.error("Error updating attendance:", err);
      toast.error(`Unexpected error updating attendance: ${err?.message || err}`);
    } finally {
      setDetailsActionLoading(null);
    }
  };

  const handleEnrollmentAction = async (enrollmentId: string, newStatus: string) => {
    setDetailsActionLoading(enrollmentId);
    try {
      const { error } = await supabase
        .from("session_enrollments")
        .update({ status: newStatus })
        .eq("id", enrollmentId);
      
      if (error) {
        toast.error(`Failed to update request: ${error.message}`);
        return;
      }

      if (selectedSessionData) {
        setSelectedSessionData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            enrollments: prev.enrollments.map(e => e.id === enrollmentId ? { ...e, status: newStatus } : e)
          };
        });
      }

      if (newStatus === "Approved") {
        toast.success("Shift request approved!");
      } else if (newStatus === "Denied") {
        toast.success("Shift request denied.");
      } else {
        toast.success("Shift request status updated.");
      }
    } catch (err: any) {
      console.error("Error updating enrollment:", err);
      toast.error(`Unexpected error updating request: ${err?.message || err}`);
    } finally {
      setDetailsActionLoading(null);
    }
  };

  const handleRequestToVolunteer = async () => {
    if (!currentUserId || !selectedSessionData) return;
    setIsRequestingShift(true);
    try {
      const { data: existing } = await supabase
        .from("session_enrollments")
        .select("id, status")
        .eq("session_id", sessionId)
        .eq("user_id", currentUserId)
        .maybeSingle();

      let error = null;
      let enrollmentRecordId = existing?.id;

      if (existing) {
        const { error: updateErr } = await supabase
          .from("session_enrollments")
          .update({ status: "Pending" })
          .eq("id", existing.id);
        error = updateErr;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from("session_enrollments")
          .insert({
            session_id: sessionId,
            user_id: currentUserId,
            status: "Pending",
          })
          .select("id")
          .single();
        error = insertErr;
        enrollmentRecordId = inserted?.id;
      }

      if (error) {
        toast.error(`Failed to request session: ${error.message}`);
      } else {
        toast.success("Successfully requested to volunteer! Pending approval from Center Lead.");
        const { data: authUserData } = await supabase.auth.getUser();
        const userEmail = authUserData.user?.email || "Volunteer";
        
        setSelectedSessionData(prev => {
          if (!prev) return prev;
          const existsInList = prev.enrollments.some(e => e.user_id === currentUserId);
          if (existsInList) {
            return {
              ...prev,
              enrollments: prev.enrollments.map(e => e.user_id === currentUserId ? { ...e, status: "Pending" } : e)
            };
          } else {
            const newEnrollment: EnrollmentDetails = {
              id: enrollmentRecordId || `temp-${Date.now()}`,
              user_id: currentUserId,
              status: "Pending",
              users: {
                id: currentUserId,
                email: userEmail,
                first_name: null,
                last_name: null,
              }
            };
            return {
              ...prev,
              enrollments: [...prev.enrollments, newEnrollment]
            };
          }
        });
      }
    } catch (err: any) {
      toast.error(`Unexpected error: ${err?.message || err}`);
    } finally {
      setIsRequestingShift(false);
    }
  };

  const getVolunteerDisplayName = (userObj?: { email?: string | null; first_name?: string | null; last_name?: string | null }) => {
    if (!userObj) return "Volunteer";
    if (userObj.first_name || userObj.last_name) {
      return `${userObj.first_name || ""} ${userObj.last_name || ""}`.trim();
    }
    if (userObj.email) {
      const prefix = userObj.email.split("@")[0];
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
    return "Volunteer";
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

  const handleBroadcastVacancy = async () => {
    if (!selectedSessionData || currentUserRole === "Volunteer") return;
    setIsBroadcasting(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ is_urgent: true })
        .eq("id", sessionId);

      if (error) {
        toast.error(`Failed to broadcast vacancy: ${error.message}`);
      } else {
        toast.success("Vacancy broadcasted to volunteers as urgent!");
        setSelectedSessionData(prev => prev ? {
          ...prev,
          session: { ...prev.session, is_urgent: true }
        } : prev);
      }
    } catch (err: any) {
      toast.error(`Unexpected error: ${err?.message || err}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  if (isDetailsLoading || !selectedSessionData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin stroke-[2]" />
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Loading Roster...
        </span>
      </div>
    );
  }

  const approvedEnrollmentsCount = selectedSessionData.enrollments.filter(e => e.status === "Approved").length;
  const capacity = selectedSessionData.session.capacity || 1;
  const hasVacancy = approvedEnrollmentsCount < capacity;
  const isVolunteer = currentUserRole === "Volunteer";
  const userEnrollment = selectedSessionData.enrollments.find(e => e.user_id === currentUserId);
  const isConfirmedVolunteer = userEnrollment?.status === "Approved";
  const isPendingVolunteer = userEnrollment?.status === "Pending";

  return (
    <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in relative min-h-full pb-20">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <button
          onClick={() => router.push('/schedule')}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors w-fit font-medium text-sm min-h-[48px]"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Schedule
        </button>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            {selectedSessionData.session.batch_id && (
              <button
                type="button"
                onClick={() => setIsRecurrenceModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 transition-all cursor-pointer shadow-xs w-fit"
              >
                <Repeat className="w-3.5 h-3.5" />
                Part of a Recurring Series
              </button>
            )}
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

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {!isVolunteer && approvedEnrollmentsCount === 0 && (
              selectedSessionData.session.is_urgent ? (
                <div className="flex items-center justify-center gap-2 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30 px-5 py-3 rounded-xl font-bold text-sm min-h-[48px] shrink-0">
                  <Megaphone className="w-5 h-5 stroke-[2.2]" />
                  <span>Vacancy Broadcasted (Urgent)</span>
                </div>
              ) : (
                <button
                  onClick={handleBroadcastVacancy}
                  disabled={isBroadcasting}
                  className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-5 py-3 rounded-xl font-bold text-sm min-h-[48px] transition-all shadow-md shadow-amber-600/20 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isBroadcasting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Megaphone className="w-5 h-5 stroke-[2.2]" />
                  )}
                  <span>Broadcast Vacancy to Volunteers</span>
                </button>
              )
            )}

            {isVolunteer && !isConfirmedVolunteer && (
              isPendingVolunteer ? (
                <div className="flex items-center justify-center gap-2 bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30 px-5 py-3 rounded-xl font-bold text-sm min-h-[48px] shrink-0">
                  <Clock className="w-5 h-5 stroke-[2.2]" />
                  <span>Request Pending Approval</span>
                </div>
              ) : hasVacancy ? (
                <button
                  onClick={handleRequestToVolunteer}
                  disabled={isRequestingShift}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-3 rounded-xl font-bold text-sm min-h-[48px] transition-all shadow-md shadow-emerald-600/20 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isRequestingShift ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Users className="w-5 h-5 stroke-[2.2]" />
                  )}
                  <span>Request to Volunteer</span>
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-5 py-3 rounded-xl font-bold text-sm min-h-[48px] shrink-0">
                  <span>Session Full</span>
                </div>
              )
            )}

            {(!isVolunteer || isConfirmedVolunteer) && (
              <>
                <button
                  onClick={() => setIsAssessmentSheetOpen(true)}
                  className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-5 py-3 rounded-xl font-bold text-sm min-h-[48px] transition-all shadow-md shadow-indigo-600/20 cursor-pointer shrink-0"
                >
                  <Award className="w-5 h-5 stroke-[2.2]" />
                  <span>Log Assessments</span>
                </button>

                <button
                  onClick={() => router.push(`/schedule/${sessionId}/students`)}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-3 rounded-xl font-bold text-sm min-h-[48px] transition-all shadow-md shadow-emerald-600/20 cursor-pointer shrink-0"
                >
                  <GraduationCap className="w-5 h-5 stroke-[2.2]" />
                  <span>Track Student Attendance</span>
                </button>
              </>
            )}
          </div>
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

      {/* Volunteer Attendance Grid (Spreadsheet Mode) */}
      <div className="flex flex-col gap-3 mt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Volunteer Attendance Grid
          </h3>
          <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 uppercase tracking-wide">
            {currentUserRole === "Volunteer" ? "Read Only View" : "Manual Grid"}
          </span>
        </div>

        <div className="overflow-x-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 select-none">
              <tr>
                <th className="px-4 py-3.5">Volunteer Name</th>
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {selectedSessionData.enrollments.map((vol) => {
                const attRecord = selectedSessionData.attendance.find((a) => a.user_id === vol.user_id);
                const currentStatus = attRecord?.status || "Unmarked";
                const isPresent = currentStatus === "Present";
                const isAbsent = currentStatus === "Absent";

                return (
                  <tr key={vol.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                      {getVolunteerDisplayName(vol.users)}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                      {vol.users?.email || "-"}
                    </td>
                    <td className="px-4 py-3.5">
                      {isPresent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <Check className="w-3.5 h-3.5" /> Present
                        </span>
                      ) : isAbsent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          <XCircle className="w-3.5 h-3.5" /> Absent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50">
                          Unmarked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {currentUserRole === "Volunteer" ? (
                        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 italic">
                          Restricted (Lead Only)
                        </span>
                      ) : (
                        <div className="inline-flex rounded-xl p-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(vol.user_id, "Present")}
                            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                              isPresent
                                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                                : "bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(vol.user_id, "Absent")}
                            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                              isAbsent
                                ? "bg-zinc-700 dark:bg-zinc-600 text-white shadow-sm"
                                : "bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-800"
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Absent
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {selectedSessionData.enrollments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 italic">
                    No volunteers assigned or enrolled for this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">{getVolunteerDisplayName(e.users)}</span>
                    <span className="text-xs text-zinc-500">{e.users?.email || "Volunteer"}</span>
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
                const attendanceRecord = selectedSessionData.attendance.find(a => a.user_id === e.user_id && a.status === 'Present');
                const hasCheckedIn = !!attendanceRecord;
                const hasCheckedOut = !!attendanceRecord?.checkout_time;
                return (
                  <div key={e.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                    <div className="flex flex-col">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          {e.users.email}
                          {hasCheckedIn && !hasCheckedOut && <BadgeCheck className="w-4 h-4 text-indigo-500" />}
                          {hasCheckedOut && <CheckCircle2 className="w-4 h-4 text-zinc-500" />}
                        </span>
                        <span className="text-xs text-zinc-500">Volunteer</span>
                    </div>
                    {hasCheckedIn && (
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${hasCheckedOut ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"}`}>
                          {hasCheckedOut ? "Checked Out" : "Checked In"}
                        </span>
                        <div className="flex flex-col items-end text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                          <span>In: {formatTime(attendanceRecord.check_in_time)}</span>
                          {hasCheckedOut && <span>Out: {formatTime(attendanceRecord.checkout_time)}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance Log (Includes Walk-ins) */}
        <div className="flex flex-col gap-3 pt-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-500 flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Attendance Log ({selectedSessionData.attendance.length})
          </h3>
          <div className="overflow-x-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3.5 font-bold text-zinc-900 dark:text-zinc-100">Volunteer Email</th>
                  <th className="px-4 py-3.5 font-bold text-zinc-900 dark:text-zinc-100">Check In Time</th>
                  <th className="px-4 py-3.5 font-bold text-zinc-900 dark:text-zinc-100">Check Out Time</th>
                  <th className="px-4 py-3.5 font-bold text-zinc-900 dark:text-zinc-100">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {selectedSessionData.attendance.map(a => (
                  <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                     <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                       {a.users?.email || 'Unknown Volunteer'}
                     </td>
                     <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                       {a.check_in_time ? formatTime(a.check_in_time) : '-'}
                     </td>
                     <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                       {a.checkout_time ? formatTime(a.checkout_time) : '-'}
                     </td>
                     <td className="px-4 py-3">
                        {a.checkout_time ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 uppercase tracking-wide">
                            Checked Out
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 uppercase tracking-wide">
                            Checked In
                          </span>
                        )}
                     </td>
                  </tr>
                ))}
                {selectedSessionData.attendance.length === 0 && (
                  <tr>
                     <td colSpan={4} className="px-4 py-8 text-center text-zinc-500 italic">
                       No attendance records found for this session.
                     </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <BulkAssessmentSheet
        isOpen={isAssessmentSheetOpen}
        onClose={() => setIsAssessmentSheetOpen(false)}
        sessionId={sessionId}
        sessionTopic={selectedSessionData.session.topic}
      />

      {selectedSessionData.session.batch_id && (
        <RecurrenceModal
          isOpen={isRecurrenceModalOpen}
          onClose={() => setIsRecurrenceModalOpen(false)}
          currentSession={selectedSessionData.session}
        />
      )}
    </div>
  );
}
