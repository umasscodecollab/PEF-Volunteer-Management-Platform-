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
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Check,
  XCircle,
  BadgeCheck,
  UserCheck,
  GraduationCap,
  Megaphone
} from "lucide-react";

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

export default function SessionDetailsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter();
  const unwrappedParams = React.use(params);
  const { sessionId } = unwrappedParams;

  const [selectedSessionData, setSelectedSessionData] = useState<SessionDetailsData | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(true);
  const [detailsActionLoading, setDetailsActionLoading] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    const fetchSessionDetails = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: userProfile } = await supabase
            .from("users")
            .select("role")
            .eq("id", authUser.id)
            .maybeSingle();
          if (userProfile?.role) {
            setCurrentUserRole(userProfile.role);
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
  }, [sessionId]);

  const handleToggleAttendance = async (userId: string, targetStatus: 'Present' | 'Absent') => {
    if (!selectedSessionData) return;
    if (currentUserRole === "Volunteer") {
      alert("Volunteers are not permitted to mark attendance for other volunteers.");
      return;
    }

    const existingAtt = selectedSessionData.attendance.find(a => a.user_id === userId);
    const previousAttList = [...selectedSessionData.attendance];
    const currentStatus = existingAtt?.status || 'Unmarked';
    const newStatus = currentStatus === targetStatus ? 'Unmarked' : targetStatus;
    const nowIso = newStatus === 'Present' ? new Date().toISOString() : null;

    // Optimistically update UI
    setSelectedSessionData(prev => {
      if (!prev) return prev;
      const attList = [...prev.attendance];
      const index = attList.findIndex(a => a.user_id === userId);
      if (index >= 0) {
        attList[index] = {
          ...attList[index],
          status: newStatus,
          check_in_time: nowIso,
          method: 'Manual'
        };
      } else {
        attList.push({
          id: `temp-${Date.now()}`,
          session_id: sessionId,
          user_id: userId,
          status: newStatus,
          check_in_time: nowIso,
          checkout_time: null,
          method: 'Manual',
          geo_location: null
        });
      }
      return { ...prev, attendance: attList };
    });

    try {
      let dbError = null;
      let newRow = null;

      if (existingAtt?.id && !existingAtt.id.startsWith('temp-')) {
        const { data, error } = await supabase
          .from("attendance")
          .update({
            status: newStatus,
            check_in_time: nowIso,
            method: 'Manual'
          })
          .eq("id", existingAtt.id)
          .select()
          .single();
        dbError = error;
        newRow = data;
      } else {
        const { data, error } = await supabase
          .from("attendance")
          .insert({
            session_id: sessionId,
            user_id: userId,
            status: newStatus,
            check_in_time: nowIso,
            method: 'Manual'
          })
          .select()
          .single();
        dbError = error;
        newRow = data;
      }

      if (dbError) {
        console.error("Attendance persistence failed:", dbError.message);
        alert(`Failed to save attendance: ${dbError.message}`);
        // Revert optimistic update on failure
        setSelectedSessionData(prev => prev ? { ...prev, attendance: previousAttList } : prev);
      } else if (newRow) {
        setSelectedSessionData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            attendance: prev.attendance.map(a => a.user_id === userId ? newRow : a)
          };
        });
      }
    } catch (err: any) {
      console.error("Attendance exception:", err);
      alert(`Unexpected error updating attendance: ${err?.message || err}`);
      setSelectedSessionData(prev => prev ? { ...prev, attendance: previousAttList } : prev);
    }
  };

  const handleEnrollmentAction = async (enrollmentId: string, newStatus: string) => {
    setDetailsActionLoading(enrollmentId);
    try {
      const targetEnrollment = selectedSessionData?.enrollments.find(e => e.id === enrollmentId);

      const { error } = await supabase
        .from("session_enrollments")
        .update({ status: newStatus })
        .eq("id", enrollmentId);
      
      if (error) {
        toast.error(`Failed to update request: ${error.message}`);
        return;
      }

      if (newStatus === "Approved" && targetEnrollment) {
        const { error: sessionUpdateError } = await supabase
          .from("sessions")
          .update({ facilitator_id: targetEnrollment.user_id })
          .eq("id", sessionId);

        if (sessionUpdateError) {
          console.error("Error setting session facilitator:", sessionUpdateError.message);
        }
      }

      if (selectedSessionData) {
        setSelectedSessionData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            session: newStatus === "Approved" && targetEnrollment
              ? { ...prev.session, facilitator_id: targetEnrollment.user_id }
              : prev.session,
            enrollments: prev.enrollments.map(e => e.id === enrollmentId ? { ...e, status: newStatus } : e)
          };
        });
      }

      if (newStatus === "Approved") {
        toast.success("Shift request approved and facilitator assigned!");
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
    if (!selectedSessionData) return;
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

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {selectedSessionData.enrollments.filter(e => e.status === "Approved").length === 0 && (
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

            <button
              onClick={() => router.push(`/schedule/${sessionId}/students`)}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-3 rounded-xl font-bold text-sm min-h-[48px] transition-all shadow-md shadow-emerald-600/20 cursor-pointer shrink-0"
            >
              <GraduationCap className="w-5 h-5 stroke-[2.2]" />
              <span>Track Student Attendance</span>
            </button>
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
    </div>
  );
}
