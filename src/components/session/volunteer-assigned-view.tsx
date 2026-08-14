"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Loader2,
  ChevronLeft,
  ChevronDown,
  Check,
  XCircle,
  Award,
  GraduationCap,
  CalendarOff,
  UserPlus,
  Repeat,
  Sparkles,
  AlertCircle,
  X,
  Search,
  BookOpen
} from "lucide-react";
import { BulkAssessmentForm } from "@/components/bulk-assessment-form";
import { LeaveRequestModal } from "./leave-request-modal";
import { RecurrenceModal } from "./recurrence-modal";

type Session = Database["public"]["Tables"]["sessions"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];
type StudentAttendance = Database["public"]["Tables"]["student_attendance"]["Row"];

interface VolunteerAssignedViewProps {
  session: Session;
  currentUser: any;
  role?: string;
}

export function VolunteerAssignedView({
  session,
  currentUser,
  role = "Volunteer"
}: VolunteerAssignedViewProps) {
  const router = useRouter();
  const sessionId = session.id;

  const [loading, setLoading] = useState(true);
  const [centerName, setCenterName] = useState<string>("");
  const [centerLocation, setCenterLocation] = useState<string | null>(null);

  // Student Attendance State
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendance[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Accordions
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [isAssessmentAccordionOpen, setIsAssessmentAccordionOpen] = useState(false);
  const [assessmentRefreshToken, setAssessmentRefreshToken] = useState(0);

  // Add Student Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [allCenterStudents, setAllCenterStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [addToFutureSessions, setAddToFutureSessions] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  const fetchSessionAndAttendance = async () => {
    try {
      setLoading(true);

      // 1. Fetch Center details
      if (session.center_id) {
        const { data: cData } = await supabase
          .from("centers")
          .select("name, location")
          .eq("id", session.center_id)
          .maybeSingle();

        if (cData) {
          setCenterName(cData.name);
          setCenterLocation(cData.location);
        }
      }

      // 2. Fetch student_attendance joined with students
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
        toast.error("Failed to load student attendance roster.");
      } else if (attendanceData) {
        setAttendance(attendanceData as unknown as StudentAttendance[]);

        const enrolledStudents: Student[] = [];
        const seenIds = new Set<string>();

        attendanceData.forEach((att: any) => {
          if (att.students && !seenIds.has(att.students.id)) {
            seenIds.add(att.students.id);
            enrolledStudents.push(att.students as Student);
          }
        });

        // Sort students alphabetically
        enrolledStudents.sort((a, b) => a.name.localeCompare(b.name));
        setStudents(enrolledStudents);
      }
    } catch (err: any) {
      console.error("Error in fetchSessionAndAttendance:", err);
      toast.error("Error loading session data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionAndAttendance();
  }, [sessionId, session.center_id]);

  // Handle Optimistic Attendance Toggle
  const handleToggleAttendance = async (studentId: string, targetStatus: "Present" | "Absent") => {
    if (!currentUser) return;

    const existingRecord = attendance.find((a) => a.student_id === studentId);
    const currentStatus = existingRecord?.status || "Unmarked";
    const newStatus = currentStatus === targetStatus ? "Unmarked" : targetStatus;

    // 1. Optimistic React state update
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

    // Notify assessment form to sync present roster
    setAssessmentRefreshToken((prev) => prev + 1);

    // 2. Background Database Upsert
    try {
      if (existingRecord?.id && !existingRecord.id.startsWith("temp-")) {
        const { error } = await supabase
          .from("student_attendance")
          .update({
            status: newStatus,
            marked_by: currentUser.id,
          })
          .eq("id", existingRecord.id);

        if (error) {
          console.error("Attendance update error:", error);
          toast.error(`Failed to update attendance: ${error.message}`);
        }
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
            { onConflict: "session_id,student_id" }
          )
          .select()
          .single();

        if (error) {
          console.error("Attendance upsert error:", error);
          toast.error(`Failed to record attendance: ${error.message}`);
        } else if (data) {
          setAttendance((prev) =>
            prev.map((a) => (a.student_id === studentId ? { ...a, id: data.id } : a))
          );
        }
      }
    } catch (err: any) {
      console.error("Attendance error:", err);
    }
  };

  // Open Add Student Modal
  const handleOpenAddModal = async () => {
    if (!session.center_id) {
      toast.error("Center information not available.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("center_id", session.center_id)
        .order("name", { ascending: true });

      if (error) throw error;

      // Filter out already enrolled students
      const currentIds = new Set(students.map((s) => s.id));
      const available = (data || []).filter((s) => !currentIds.has(s.id));
      setAllCenterStudents(available);
      setSelectedStudentId(available.length > 0 ? available[0].id : "");
      setIsAddModalOpen(true);
    } catch (err: any) {
      console.error("Error fetching center students:", err);
      toast.error("Failed to load center students.");
    }
  };

  // Add Student Submit Handler
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      toast.error("Please select a student to add.");
      return;
    }

    setIsAddingStudent(true);
    try {
      const studentObj = allCenterStudents.find((s) => s.id === selectedStudentId);

      let targetSessionIds = [sessionId];
      if (addToFutureSessions && session.batch_id) {
        const { data: futureBatchSessions } = await supabase
          .from("sessions")
          .select("id")
          .eq("batch_id", session.batch_id)
          .gte("start_time", session.start_time);

        if (futureBatchSessions && futureBatchSessions.length > 0) {
          targetSessionIds = futureBatchSessions.map((s) => s.id);
        }
      }

      const rowsToInsert = targetSessionIds.map((sId) => ({
        session_id: sId,
        student_id: selectedStudentId,
        status: "Unmarked",
      }));

      const { data: insertedRows, error: insertErr } = await supabase
        .from("student_attendance")
        .upsert(rowsToInsert, { onConflict: "session_id,student_id" })
        .select();

      if (insertErr) throw insertErr;

      // Optimistically update local lists
      if (studentObj) {
        setStudents((prev) => [...prev, studentObj].sort((a, b) => a.name.localeCompare(b.name)));
      }
      if (insertedRows && insertedRows.length > 0) {
        const currentRow = insertedRows.find((r: any) => r.session_id === sessionId);
        if (currentRow) {
          setAttendance((prev) => [...prev, currentRow as StudentAttendance]);
        }
      }

      toast.success(
        addToFutureSessions
          ? `Enrolled student in this and ${targetSessionIds.length - 1} future sessions!`
          : "Student successfully added to session roster!"
      );
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error("Error enrolling student:", err);
      toast.error(err?.message || "Failed to add student to session.");
    } finally {
      setIsAddingStudent(false);
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin stroke-[2]" />
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Loading Classroom Session...
        </span>
      </div>
    );
  }

  // Attendance metrics
  const presentCount = attendance.filter((a) => a.status === "Present").length;
  const absentCount = attendance.filter((a) => a.status === "Absent").length;
  const unmarkedCount = students.length - (presentCount + absentCount);

  // Filter students based on search query
  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 sm:gap-8 px-4 sm:px-6 py-6 select-none animate-fade-in relative min-h-full max-w-5xl mx-auto pb-28">
      
      {/* Top Bar Navigation & Actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.push("/schedule")}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors w-fit font-medium text-sm min-h-[44px] cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Schedule
        </button>

        {/* Leave Request Action Button */}
        <button
          type="button"
          onClick={() => setIsLeaveModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 transition-all cursor-pointer shadow-xs min-h-[42px]"
        >
          <CalendarOff className="w-4 h-4 stroke-[2.2]" />
          <span>Request Leave</span>
        </button>
      </div>

      {/* Header & Session Details Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-lg shadow-zinc-950/5 flex flex-col gap-5 relative overflow-hidden">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
              <Sparkles className="w-3.5 h-3.5" /> Assigned Facilitator
            </span>

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
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-snug">
            {session.topic}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-zinc-600 dark:text-zinc-400 mt-1">
            <span className="flex items-center gap-1.5 font-semibold">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {formatDate(session.start_time)}
            </span>
            <span className="flex items-center gap-1.5 font-semibold">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {formatTimeRange(session.start_time, session.end_time)}
            </span>
            {centerName && (
              <span className="flex items-center gap-1.5 font-semibold">
                <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {centerName} {centerLocation ? `(${centerLocation})` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Quick Attendance Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Enrolled</span>
            <span className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-0.5">{students.length}</span>
          </div>
          <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200/70 dark:border-emerald-900/40 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Present</span>
            <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-0.5">{presentCount}</span>
          </div>
          <div className="p-3.5 bg-rose-50/70 dark:bg-rose-950/30 rounded-2xl border border-rose-200/70 dark:border-rose-900/40 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Absent</span>
            <span className="text-xl font-extrabold text-rose-800 dark:text-rose-300 mt-0.5">{absentCount}</span>
          </div>
          <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-2xl border border-amber-200/70 dark:border-amber-900/40 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Unmarked</span>
            <span className="text-xl font-extrabold text-amber-800 dark:text-amber-300 mt-0.5">{unmarkedCount}</span>
          </div>
        </div>
      </div>

      {/* Section 1: Inline Student Attendance Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Student Attendance
            </h2>
            <span className="text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full">
              {students.length}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Add Student Button */}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all shadow-xs cursor-pointer min-h-[36px] shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Student</span>
            </button>
          </div>
        </div>

        {/* Student Attendance Table Grid */}
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3.5">Student Name</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right sm:text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filteredStudents.map((student) => {
                const attRecord = attendance.find((a) => a.student_id === student.id);
                const currentStatus = attRecord?.status || "Unmarked";
                const isPresent = currentStatus === "Present";
                const isAbsent = currentStatus === "Absent";

                return (
                  <tr key={student.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                      {student.name}
                    </td>
                    <td className="px-5 py-3.5">
                      {isPresent ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                          <Check className="w-3.5 h-3.5" /> Present
                        </span>
                      ) : isAbsent ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
                          <XCircle className="w-3.5 h-3.5" /> Absent
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50">
                          Unmarked
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right sm:text-center">
                      <div className="inline-flex rounded-xl p-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleAttendance(student.id, "Present")}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
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
                          onClick={() => handleToggleAttendance(student.id, "Absent")}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                            isAbsent
                              ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30"
                              : "bg-transparent text-zinc-600 dark:text-zinc-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600"
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-zinc-500 italic text-xs">
                    {searchQuery ? "No students match your search filter." : "No students enrolled in this session yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Inline Assessment Logging Accordion */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden transition-all">
        {/* Accordion Trigger Header */}
        <button
          type="button"
          onClick={() => setIsAssessmentAccordionOpen((prev) => !prev)}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Log Assessments
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {presentCount} Present
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Record diagnostic, monthly, or mid-year scores for present students
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ChevronDown
              className={`w-5 h-5 text-zinc-400 transition-transform duration-200 ${
                isAssessmentAccordionOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {/* Accordion Content Body */}
        {isAssessmentAccordionOpen && (
          <div className="px-6 py-5 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-900/40 animate-in fade-in-50 duration-200">
            <BulkAssessmentForm
              sessionId={sessionId}
              sessionTopic={session.topic}
              isInline={true}
              refreshToken={assessmentRefreshToken}
              onSuccess={() => {
                // Keep accordion open and refreshed
              }}
            />
          </div>
        )}
      </div>

      {/* Leave Request Modal */}
      <LeaveRequestModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        sessionDate={session.start_time}
        sessionTopic={session.topic}
        userId={currentUser?.id}
      />

      {/* Recurrence Series Modal */}
      {session.batch_id && (
        <RecurrenceModal
          isOpen={isRecurrenceModalOpen}
          onClose={() => setIsRecurrenceModalOpen(false)}
          currentSession={session}
          centerName={centerName}
          onRequested={() => {
            fetchSessionAndAttendance();
          }}
        />
      )}

      {/* Add Student to Session Modal */}
      {isAddModalOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsAddModalOpen(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[95vw] sm:max-w-md bg-white dark:bg-zinc-900 shadow-2xl flex flex-col rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                Add Student to Session
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudentSubmit} className="p-6 flex flex-col gap-4">
              {allCenterStudents.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 italic bg-zinc-50 dark:bg-zinc-800/40 rounded-xl">
                  All students from this center are already enrolled in this session.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Select Student
                    </label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {allCenterStudents.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {session.batch_id && (
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={addToFutureSessions}
                        onChange={(e) => setAddToFutureSessions(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500 accent-emerald-600"
                      />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                        Also add this student to all future sessions in this recurring batch
                      </span>
                    </label>
                  )}
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isAddingStudent}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingStudent || allCenterStudents.length === 0}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isAddingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>Enroll Student</span>
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
