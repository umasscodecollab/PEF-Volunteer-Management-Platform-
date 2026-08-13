"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import {
  ChevronLeft,
  Calendar,
  Clock,
  UserCheck,
  Check,
  XCircle,
  Loader2,
  AlertCircle,
  GraduationCap,
  Sparkles,
  BookOpen,
  UserPlus,
  X,
  Plus,
  Trash2
} from "lucide-react";

type Session = Database["public"]["Tables"]["sessions"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];
type StudentAttendance = Database["public"]["Tables"]["student_attendance"]["Row"];

export default function StudentAttendancePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const router = useRouter();
  const unwrappedParams = React.use(params);
  const { sessionId } = unwrappedParams;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("Volunteer");
  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Add Student Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [allCenterStudents, setAllCenterStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [addToFutureSessions, setAddToFutureSessions] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Remove Student Confirmation Modal State
  const [studentToRemove, setStudentToRemove] = useState<Student | null>(null);
  const [isRemoving, setIsRemoving] = useState<boolean>(false);

  useEffect(() => {
    const initPageData = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        // 1. Get authenticated user & profile role
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push("/login");
          return;
        }
        setCurrentUser(authUser);

        const { data: profile } = await supabase
          .from("users")
          .select("role, assigned_center_id")
          .eq("id", authUser.id)
          .maybeSingle();

        const role = profile?.role || "Volunteer";
        setUserRole(role);

        // 2. Fetch session details
        const { data: sessionData, error: sessionErr } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionErr || !sessionData) {
          setErrorMessage("Failed to load session details or session not found.");
          return;
        }
        setSession(sessionData);

        // 3. Enrollment-Based Fetching: Query student_attendance for this sessionId joining students
        const { data: attendanceData, error: attendanceErr } = await supabase
          .from("student_attendance")
          .select(`
            id,
            session_id,
            student_id,
            status,
            marked_by,
            created_at,
            students (
              id,
              name,
              center_id,
              created_at
            )
          `)
          .eq("session_id", sessionId);

        if (attendanceErr) {
          console.error("Error fetching student attendance:", attendanceErr);
        } else if (attendanceData) {
          setAttendance(attendanceData as unknown as StudentAttendance[]);

          // Extract unique students from joined attendance rows
          const enrolledStudents: Student[] = [];
          const seenIds = new Set<string>();

          attendanceData.forEach((att: any) => {
            if (att.students && !seenIds.has(att.students.id)) {
              seenIds.add(att.students.id);
              enrolledStudents.push(att.students as Student);
            }
          });

          setStudents(enrolledStudents);
        }
      } catch (err: any) {
        console.error("Error initializing Student Attendance Page:", err);
        setErrorMessage("An unexpected error occurred while loading data.");
      } finally {
        setLoading(false);
      }
    };

    initPageData();
  }, [sessionId, router]);

  // Optimistic Toggle Handler
  const handleToggleAttendance = async (
    studentId: string,
    targetStatus: "Present" | "Absent"
  ) => {
    if (!currentUser || !session) return;

    const existingRecord = attendance.find((a) => a.student_id === studentId);
    const currentStatus = existingRecord?.status || "Unmarked";
    const newStatus = currentStatus === targetStatus ? "Unmarked" : targetStatus;

    // 1. Optimistic local React state update
    setAttendance((prev) => {
      const updated = [...prev];
      const idx = updated.findIndex((a) => a.student_id === studentId);
      if (idx >= 0) {
        updated[idx] = {
          ...updated[idx],
          status: newStatus,
          marked_by: currentUser.id,
        };
      } else {
        updated.push({
          id: `temp-${Date.now()}`,
          session_id: sessionId,
          student_id: studentId,
          status: newStatus,
          marked_by: currentUser.id,
          created_at: new Date().toISOString(),
        });
      }
      return updated;
    });

    // 2. Background Supabase Upsert
    try {
      if (existingRecord?.id && !existingRecord.id.startsWith("temp-")) {
        const { error } = await supabase
          .from("student_attendance")
          .update({
            status: newStatus,
            marked_by: currentUser.id,
          })
          .eq("id", existingRecord.id);

        if (error) console.error("Failed to update student attendance:", error);
      } else {
        const { data, error } = await supabase
          .from("student_attendance")
          .upsert(
            {
              session_id: sessionId,
              student_id: studentId,
              status: newStatus,
              marked_by: currentUser.id,
            },
            { onConflict: "session_id, student_id" }
          )
          .select()
          .single();

        if (error) {
          console.error("Failed to upsert student attendance:", error);
        } else if (data) {
          setAttendance((prev) =>
            prev.map((a) => (a.student_id === studentId ? { ...a, id: data.id } : a))
          );
        }
      }
    } catch (err) {
      console.error("Error executing student attendance upsert:", err);
    }
  };

  // Open Add Student Modal & Fetch Center Students
  const handleOpenAddModal = async () => {
    if (!session?.center_id) {
      toast.error("Session center ID is not available.");
      return;
    }
    setIsAddModalOpen(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("center_id", session.center_id)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching center students:", error);
      } else if (data) {
        setAllCenterStudents(data);
        // Preselect first available student who is not already in current roster
        const available = data.filter((cs) => !students.some((s) => s.id === cs.id));
        if (available.length > 0) {
          setSelectedStudentId(available[0].id);
        } else {
          setSelectedStudentId("");
        }
      }
    } catch (err) {
      console.error("Error fetching center students for modal:", err);
    }
  };

  // Submit Add Student to Session & Future Recurring Sessions
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !session) return;

    const targetStudent = allCenterStudents.find((s) => s.id === selectedStudentId);
    if (!targetStudent) return;

    setIsSubmitting(true);
    try {
      // 1. Insert attendance record for current session
      const { data: newAtt, error: attErr } = await supabase
        .from("student_attendance")
        .insert({
          session_id: sessionId,
          student_id: selectedStudentId,
          status: "Unmarked",
          marked_by: currentUser?.id,
        })
        .select()
        .single();

      if (attErr) {
        console.error("Error adding student to current session:", attErr);
        toast.error(`Failed to add student to session: ${attErr.message}`);
        setIsSubmitting(false);
        return;
      }

      // 2. If recurring toggle is checked and batch_id exists, bulk insert for future sessions in series
      let futureCount = 0;
      if (addToFutureSessions && session.batch_id) {
        const { data: futureSessions } = await supabase
          .from("sessions")
          .select("id")
          .eq("batch_id", session.batch_id)
          .gt("start_time", session.start_time);

        if (futureSessions && futureSessions.length > 0) {
          const bulkRows = futureSessions.map((fs) => ({
            session_id: fs.id,
            student_id: selectedStudentId,
            status: "Unmarked",
            marked_by: currentUser?.id,
          }));

          const { error: bulkErr } = await supabase
            .from("student_attendance")
            .insert(bulkRows);

          if (bulkErr) {
            console.error("Error bulk adding student to future sessions:", bulkErr);
          } else {
            futureCount = futureSessions.length;
          }
        }
      }

      // 3. Optimistically update local React state so student appears in roster immediately
      setStudents((prev) => [...prev, targetStudent]);
      if (newAtt) {
        setAttendance((prev) => [...prev, newAtt]);
      } else {
        setAttendance((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            session_id: sessionId,
            student_id: selectedStudentId,
            status: "Unmarked",
            marked_by: currentUser?.id,
            created_at: new Date().toISOString(),
          },
        ]);
      }

      // 4. Close modal and notify user via non-blocking toast
      setIsAddModalOpen(false);
      setSelectedStudentId("");
      setAddToFutureSessions(false);
      toast.success(
        `Successfully added ${targetStudent.name} to this session!${
          futureCount > 0 ? ` (and ${futureCount} future recurring sessions)` : ""
        }`
      );
    } catch (err: any) {
      console.error("Exception submitting add student:", err);
      toast.error(`Unexpected error: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Remove Student Confirmation Modal
  const handleOpenRemoveModal = (student: Student) => {
    setStudentToRemove(student);
  };

  // Confirm Remove Student Execution
  const handleConfirmRemoveStudent = async () => {
    if (!session || !studentToRemove) return;
    const targetStudent = studentToRemove;
    const studentId = targetStudent.id;

    setIsRemoving(true);
    const previousStudents = [...students];
    const previousAttendance = [...attendance];

    // Optimistically update React state
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setAttendance((prev) => prev.filter((a) => a.student_id !== studentId));

    try {
      const { error } = await supabase
        .from("student_attendance")
        .delete()
        .eq("session_id", sessionId)
        .eq("student_id", studentId);

      if (error) {
        console.error("Failed to remove student from session:", error);
        toast.error(`Failed to remove student: ${error.message}`);
        setStudents(previousStudents);
        setAttendance(previousAttendance);
      } else {
        toast.success(`Removed ${targetStudent.name} from session roster.`);
        setStudentToRemove(null);
      }
    } catch (err: any) {
      console.error("Exception removing student:", err);
      toast.error(`Unexpected error: ${err?.message || err}`);
      setStudents(previousStudents);
      setAttendance(previousAttendance);
    } finally {
      setIsRemoving(false);
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
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
          Loading Student Roster...
        </span>
      </div>
    );
  }

  if (errorMessage || !session) {
    return (
      <div className="max-w-7xl mx-auto px-5 py-12 flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {errorMessage || "Session not found."}
        </h2>
        <button
          onClick={() => router.back()}
          className="mt-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold text-sm min-h-[48px] active:scale-95 transition-all shadow-md"
        >
          Go Back
        </button>
      </div>
    );
  }

  const presentCount = attendance.filter((a) => a.status === "Present").length;
  const absentCount = attendance.filter((a) => a.status === "Absent").length;

  return (
    <div className="max-w-7xl mx-auto px-5 py-6 select-none animate-fade-in relative min-h-full pb-20 flex flex-col gap-6">
      {/* Navigation Header */}
      <header className="flex flex-col gap-4">
        <button
          onClick={() => router.push(`/schedule/${sessionId}`)}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors w-fit font-semibold text-sm min-h-[48px]"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Session
        </button>

        {/* Page Banner Header */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 uppercase tracking-wider">
                Student Attendance Tracker
              </span>
              <span className="text-xs text-zinc-400 font-medium">
                • {userRole} Scope
              </span>
            </div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight leading-snug">
              {session.topic}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-zinc-600 dark:text-zinc-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {formatDate(session.start_time)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {formatTime(session.start_time)} - {formatTime(session.end_time)}
              </span>
            </div>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 px-4 py-2.5 rounded-xl flex flex-col items-center min-w-[90px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Present
              </span>
              <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300">
                {presentCount}
              </span>
            </div>
            <div className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 rounded-xl flex flex-col items-center min-w-[90px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Absent
              </span>
              <span className="text-xl font-extrabold text-zinc-800 dark:text-zinc-300">
                {absentCount}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Spreadsheet Style Attendance Grid */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Class Student Roster ({students.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl min-h-[44px] transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Student</span>
            </button>
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 uppercase tracking-wide">
              Spreadsheet View
            </span>
          </div>
        </div>

        <div className="overflow-x-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 select-none">
              <tr>
                <th className="px-5 py-4">Student Name</th>
                <th className="px-5 py-4">Current Status</th>
                <th className="px-5 py-4 text-center min-w-[220px]">Mark Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {students.map((student) => {
                const attRecord = attendance.find((a) => a.student_id === student.id);
                const currentStatus = attRecord?.status || "Unmarked";
                const isPresent = currentStatus === "Present";
                const isAbsent = currentStatus === "Absent";

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    {/* Name Column */}
                    <td className="px-5 py-4 font-bold text-zinc-900 dark:text-zinc-100 text-base">
                      {student.name}
                    </td>

                    {/* Status Column */}
                    <td className="px-5 py-4">
                      {isPresent ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50">
                          <Check className="w-4 h-4 stroke-[2.5]" /> Present
                        </span>
                      ) : isAbsent ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/50">
                          <XCircle className="w-4 h-4 stroke-[2.5]" /> Absent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50">
                          Unmarked
                        </span>
                      )}
                    </td>

                    {/* Action Column with Large Touch Targets (Min 48px height) */}
                    <td className="px-5 py-3 text-center">
                      <div className="inline-flex items-center gap-2">
                        <div className="inline-flex rounded-xl p-1 bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 gap-2">
                          {/* Present Button (P / Checkmark) */}
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(student.id, "Present")}
                            className={`min-h-[48px] px-5 py-2.5 rounded-lg font-extrabold text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.96] shadow-sm select-none ${
                              isPresent
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-500/50"
                                : "bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-400"
                            }`}
                          >
                            <Check className="w-5 h-5 stroke-[2.5]" />
                            <span>P</span>
                          </button>

                          {/* Absent Button (AB / X) */}
                          <button
                            type="button"
                            onClick={() => handleToggleAttendance(student.id, "Absent")}
                            className={`min-h-[48px] px-5 py-2.5 rounded-lg font-extrabold text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.96] shadow-sm select-none ${
                              isAbsent
                                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30 ring-2 ring-rose-500/50"
                                : "bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-400"
                            }`}
                          >
                            <XCircle className="w-5 h-5 stroke-[2.5]" />
                            <span>AB</span>
                          </button>
                        </div>

                        {/* Remove Student Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenRemoveModal(student)}
                          title="Remove student from session roster"
                          className="p-3 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all min-h-[48px] min-w-[48px] flex items-center justify-center cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 active:scale-95 stroke-[2]"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {students.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-12 text-center text-zinc-500 dark:text-zinc-400 italic font-medium"
                  >
                    No students found assigned to this class session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add Student UI Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl max-w-md w-full flex flex-col gap-5 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Add Student to Session
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudentSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Select Student
                </label>
                {allCenterStudents.filter((cs) => !students.some((s) => s.id === cs.id)).length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-300 text-center">
                    All students in this center are already added to this session.
                  </div>
                ) : (
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100 min-h-[48px] outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    required
                  >
                    {allCenterStudents
                      .filter((cs) => !students.some((s) => s.id === cs.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {session?.batch_id && (
                <label className="flex items-start gap-3 p-3.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={addToFutureSessions}
                    onChange={(e) => setAddToFutureSessions(e.target.checked)}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 mt-0.5"
                  />
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Add this student to all future sessions in this recurring series
                  </span>
                </label>
              )}

              <div className="flex items-center justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-3 rounded-xl font-bold text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors min-h-[48px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    allCenterStudents.filter((cs) => !students.some((s) => s.id === cs.id)).length === 0 ||
                    !selectedStudentId
                  }
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>Add Student</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Student Confirmation Modal */}
      {studentToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in select-none">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl max-w-md w-full flex flex-col gap-5 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                Remove Student from Session
              </h3>
              <button
                type="button"
                onClick={() => setStudentToRemove(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Are you sure you want to remove <strong className="font-bold text-zinc-900 dark:text-zinc-100">{studentToRemove.name} </strong> from this session&apos;s roster? This action will delete their attendance record for this class.
            </p>

            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setStudentToRemove(null)}
                disabled={isRemoving}
                className="px-5 py-3 rounded-xl font-bold text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors min-h-[48px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveStudent}
                disabled={isRemoving}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white transition-all disabled:opacity-50 min-h-[48px] shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer"
              >
                {isRemoving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Remove Student</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
