"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import { toast } from "sonner";
import {
  ChevronLeft,
  GraduationCap,
  Building,
  Calendar,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  X,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Check,
  User,
  BookOpen
} from "lucide-react";

type Student = Database["public"]["Tables"]["students"]["Row"] & {
  centers?: {
    id: string;
    name: string;
    location: string | null;
  } | null;
};

interface AttendanceRecord {
  id: string;
  session_id: string | null;
  student_id: string | null;
  status: string;
  marked_by: string | null;
  created_at: string;
  sessions?: {
    id: string;
    topic: string;
    start_time: string;
    end_time: string;
    center_id: string;
  } | null;
}

interface AssessmentRecord {
  id: string;
  student_id: string | null;
  session_id: string | null;
  exam_type: string | null;
  score_achieved: number | null;
  max_score: number | null;
  status: string | null;
  date_administered: string | null;
  recorded_by: string | null;
  evaluator_name?: string;
  notes: string | null;
  created_at: string;
  date: string;
  subject: string;
}

interface VolunteerOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
}

export default function StudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const router = useRouter();
  const unwrappedParams = React.use(params);
  const { studentId } = unwrappedParams;

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [student, setStudent] = useState<Student | null>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [assessmentLogs, setAssessmentLogs] = useState<AssessmentRecord[]>([]);
  const [centerVolunteers, setCenterVolunteers] = useState<VolunteerOption[]>([]);

  // Ad-Hoc Assessment Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formExamType, setFormExamType] = useState<string>("Monthly");
  const [formStatus, setFormStatus] = useState<"Completed" | "Incomplete" | "Not Assessed">("Completed");
  const [formMaxScore, setFormMaxScore] = useState<string>("100");
  const [formScoreAchieved, setFormScoreAchieved] = useState<string>("");
  const [formDateAdministered, setFormDateAdministered] = useState<string>("");
  const [formRecordedBy, setFormRecordedBy] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");

  const getUserDisplayName = useCallback((u?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null) => {
    if (!u) return "Staff";
    const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
    if (fullName) return fullName;
    if (u.email) {
      const prefix = u.email.split("@")[0];
      return prefix
        .split(".")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return "Staff";
  }, []);

  // Set default date to local today
  useEffect(() => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = new Date(Date.now() - tzOffset).toISOString().split("T")[0];
    setFormDateAdministered(localISOTime);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      // 1. Get authenticated user
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }
      setCurrentUserId(authUser.id);
      setFormRecordedBy(authUser.id);

      // 2. Fetch student details with center
      const { data: studentData, error: studentErr } = await supabase
        .from("students")
        .select(`
          id,
          name,
          center_id,
          created_at,
          centers (
            id,
            name,
            location
          )
        `)
        .eq("id", studentId)
        .single();

      if (studentErr || !studentData) {
        throw new Error("Student not found or failed to load profile details.");
      }

      setStudent(studentData as unknown as Student);

      // 3. Fetch attendance history
      const { data: attData, error: attErr } = await supabase
        .from("student_attendance")
        .select(`
          id,
          session_id,
          student_id,
          status,
          marked_by,
          created_at,
          sessions (
            id,
            topic,
            start_time,
            end_time,
            center_id
          )
        `)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      if (attErr) {
        console.error("Error fetching student attendance:", attErr);
      } else {
        setAttendanceLogs((attData as unknown as AttendanceRecord[]) || []);
      }

      // 4. Fetch assessment history & hydrate evaluator names
      const { data: assData, error: assErr } = await supabase
        .from("assessments")
        .select("*")
        .eq("student_id", studentId)
        .order("date_administered", { ascending: false });

      if (assErr) {
        console.error("Error fetching student assessments:", assErr);
      } else {
        const rawAssessments = (assData as unknown as AssessmentRecord[]) || [];
        const userIds = [
          ...new Set(rawAssessments.map((a) => a.recorded_by).filter(Boolean)),
        ] as string[];

        const evaluatorMap: Record<string, string> = {};

        if (userIds.length > 0) {
          const { data: usersData, error: usersErr } = await supabase
            .from("users")
            .select("id, first_name, last_name, email")
            .in("id", userIds);

          if (!usersErr && usersData) {
            usersData.forEach((u) => {
              evaluatorMap[u.id] = getUserDisplayName(u);
            });
          }
        }

        const hydratedAssessments = rawAssessments.map((a) => ({
          ...a,
          evaluator_name:
            (a.recorded_by && evaluatorMap[a.recorded_by]) || "Unknown Evaluator",
        }));

        setAssessmentLogs(hydratedAssessments);
      }

      // 5. Fetch center volunteers for Evaluated By dropdown
      if (studentData.center_id) {
        const { data: volsData, error: volsErr } = await supabase
          .from("users")
          .select("id, first_name, last_name, email, role")
          .eq("assigned_center_id", studentData.center_id)
          .order("first_name", { ascending: true });

        if (!volsErr && volsData) {
          setCenterVolunteers(volsData as VolunteerOption[]);
        }
      }
    } catch (err: any) {
      console.error("Error loading student profile:", err);
      setErrorMessage(err.message || "Failed to load student details.");
    } finally {
      setLoading(false);
    }
  }, [studentId, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal and reset/prepare fields
  const handleOpenModal = () => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = new Date(Date.now() - tzOffset).toISOString().split("T")[0];

    setFormExamType("Monthly");
    setFormStatus("Completed");
    setFormMaxScore("100");
    setFormScoreAchieved("");
    setFormDateAdministered(localISOTime);
    setFormRecordedBy(currentUserId || "");
    setFormNotes("");
    setIsModalOpen(true);
  };

  // Submit Ad-Hoc Assessment Form
  const handleSubmitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const maxScoreNum = Number(formMaxScore);
    if (!formMaxScore || isNaN(maxScoreNum) || maxScoreNum <= 0) {
      toast.error("Please enter a valid Maximum Score (must be greater than 0).");
      return;
    }

    if (!formDateAdministered) {
      toast.error("Please select an Administration Date.");
      return;
    }

    let achievedNum: number | null = null;
    if (formStatus === "Completed") {
      if (formScoreAchieved === "" || isNaN(Number(formScoreAchieved))) {
        toast.error("Please enter a valid score achieved for Completed status.");
        return;
      }
      achievedNum = Number(formScoreAchieved);
      if (achievedNum < 0 || achievedNum > maxScoreNum) {
        toast.error(`Score achieved must be between 0 and ${maxScoreNum}.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const evaluatorId = formRecordedBy || currentUserId;

      const payload = {
        student_id: studentId,
        session_id: null,
        exam_type: formExamType,
        max_score: maxScoreNum,
        score_achieved: formStatus === "Completed" ? achievedNum : null,
        status: formStatus,
        date_administered: formDateAdministered,
        recorded_by: evaluatorId,
        notes: formNotes.trim() || null,
        // Fallbacks for schema constraint compatibility
        date: formDateAdministered,
        subject: "Ad-Hoc Assessment",
      };

      const { data: insertedData, error: insertErr } = await supabase
        .from("assessments")
        .insert(payload)
        .select("*")
        .single();

      if (insertErr) {
        throw insertErr;
      }

      // Optimistically update assessment log locally
      if (insertedData) {
        const selectedVol = centerVolunteers.find((v) => v.id === evaluatorId);
        const evaluatorName = selectedVol
          ? getUserDisplayName(selectedVol)
          : evaluatorId === currentUserId
          ? "Staff"
          : "Staff";

        setAssessmentLogs((prev) => [
          {
            ...(insertedData as unknown as AssessmentRecord),
            evaluator_name: evaluatorName,
          },
          ...prev,
        ]);
      } else {
        await loadData();
      }

      toast.success("Ad-Hoc Assessment logged successfully!");
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Error submitting ad-hoc assessment:", err);
      toast.error(`Failed to record assessment: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "-";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getInitials = (name: string) => {
    if (!name) return "ST";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Metric computations
  const presentCount = attendanceLogs.filter((a) => a.status === "Present").length;
  const absentCount = attendanceLogs.filter((a) => a.status === "Absent").length;
  const totalMarked = presentCount + absentCount;
  const attendanceRate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : null;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[65vh] gap-3 select-none">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin stroke-[2]" />
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Loading Student Profile...
        </span>
      </div>
    );
  }

  if (errorMessage || !student) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {errorMessage || "Student not found."}
        </h2>
        <button
          onClick={() => router.push("/students")}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
        >
          Return to Student Directory
        </button>
      </div>
    );
  }

  const centerData = student.centers as any;
  const centerName = Array.isArray(centerData)
    ? centerData[0]?.name
    : centerData?.name || "Center Assigned";
  const centerLocation = Array.isArray(centerData)
    ? centerData[0]?.location
    : centerData?.location;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8 flex flex-col gap-8 w-full">
      {/* Navigation & Header */}
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => router.push("/students")}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer min-h-[40px] self-start"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Student Directory</span>
        </button>

        {/* Profile Card Header */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-600/20">
              {getInitials(student.name)}
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight truncate">
                  {student.name}
                </h1>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50">
                  <Building className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{centerName}</span>
                  {centerLocation && <span className="opacity-70">• {centerLocation}</span>}
                </span>
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  Enrolled: {formatDate(student.created_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 self-start md:self-center">
            <div className="bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/80 px-4 py-3 rounded-2xl flex flex-col items-center min-w-[95px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Attendance
              </span>
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {attendanceRate !== null ? `${attendanceRate}%` : `${presentCount} P`}
              </span>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/80 px-4 py-3 rounded-2xl flex flex-col items-center min-w-[95px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Assessments
              </span>
              <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {assessmentLogs.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* HISTORICAL TABLES */}
      <div className="flex flex-col gap-10">
        {/* Assessment Log Section */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Assessment Log
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {assessmentLogs.length}
              </span>
            </div>

            <button
              type="button"
              onClick={handleOpenModal}
              className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl min-h-[44px] transition-all shadow-sm shadow-emerald-600/20 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Log Ad-Hoc Assessment</span>
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
            {assessmentLogs.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Award className="w-6 h-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    No assessments recorded yet
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                    Click &quot;Log Ad-Hoc Assessment&quot; above to log an exam score and notes for this student.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 select-none">
                    <tr>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Exam Type</th>
                      <th className="px-5 py-4">Score / Max</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Evaluated By</th>
                      <th className="px-5 py-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {assessmentLogs.map((item) => {
                      const isCompleted = item.status === "Completed";
                      const isIncomplete = item.status === "Incomplete";
                      const pct =
                        isCompleted && item.score_achieved != null && item.max_score
                          ? Math.round((item.score_achieved / item.max_score) * 100)
                          : null;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          {/* Date */}
                          <td className="px-5 py-4 font-semibold text-zinc-800 dark:text-zinc-200">
                            {formatDate(item.date_administered || item.date)}
                          </td>

                          {/* Exam Type */}
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/50">
                              {item.exam_type || "Assessment"}
                            </span>
                          </td>

                          {/* Score / Max Score */}
                          <td className="px-5 py-4 font-bold text-zinc-900 dark:text-zinc-100">
                            {isCompleted && item.score_achieved != null ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-base text-emerald-600 dark:text-emerald-400">
                                  {item.score_achieved}
                                </span>
                                <span className="text-zinc-400 font-normal">
                                  / {item.max_score || 100}
                                </span>
                                {pct != null && (
                                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 ml-1">
                                    ({pct}%)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-400 font-medium">
                                - / {item.max_score || 100}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50">
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" /> Completed
                              </span>
                            ) : isIncomplete ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50">
                                Incomplete
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                                Not Assessed
                              </span>
                            )}
                          </td>

                          {/* Evaluated By */}
                          <td className="px-5 py-4 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                            {item.evaluator_name || "Unknown Evaluator"}
                          </td>

                          {/* Notes */}
                          <td className="px-5 py-4 text-xs text-zinc-600 dark:text-zinc-300 max-w-xs truncate font-medium">
                            {item.notes || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Attendance Log Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Attendance Log
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {attendanceLogs.length}
            </span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
            {attendanceLogs.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    No attendance records logged
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                    Attendance records will appear here when this student is marked during class sessions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 select-none">
                    <tr>
                      <th className="px-5 py-4">Date</th>
                      <th className="px-5 py-4">Session Topic</th>
                      <th className="px-5 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {attendanceLogs.map((item) => {
                      const sessionDate =
                        item.sessions?.start_time || item.created_at;
                      const topic = item.sessions?.topic || "Class Session";
                      const isPresent = item.status === "Present";
                      const isAbsent = item.status === "Absent";

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          {/* Date */}
                          <td className="px-5 py-4 font-semibold text-zinc-800 dark:text-zinc-200">
                            {formatDate(sessionDate)}
                          </td>

                          {/* Session Topic */}
                          <td className="px-5 py-4 font-bold text-zinc-900 dark:text-zinc-100">
                            {item.session_id ? (
                              <Link
                                href={`/schedule/${item.session_id}`}
                                className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors"
                              >
                                {topic}
                              </Link>
                            ) : (
                              <span>{topic}</span>
                            )}
                          </td>

                          {/* Status */}
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
                                {item.status || "Unmarked"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* AD-HOC ASSESSMENT LOGGING MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in select-none">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl max-w-lg w-full flex flex-col gap-5 relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Award className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    Log Ad-Hoc Assessment
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    For <strong className="text-zinc-800 dark:text-zinc-200">{student.name}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitAssessment} className="flex flex-col gap-4">
              {/* Row 1: Exam Type & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Exam Type
                  </label>
                  <select
                    value={formExamType}
                    onChange={(e) => setFormExamType(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-h-[46px]"
                    required
                  >
                    <option value="Diagnostic">Diagnostic</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Mid-Year">Mid-Year</option>
                    <option value="End-of-Year">End-of-Year</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => {
                      const val = e.target.value as "Completed" | "Incomplete" | "Not Assessed";
                      setFormStatus(val);
                      if (val !== "Completed") {
                        setFormScoreAchieved("");
                      }
                    }}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-h-[46px]"
                    required
                  >
                    <option value="Completed">Completed</option>
                    <option value="Incomplete">Incomplete</option>
                    <option value="Not Assessed">Not Assessed</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Max Score & Score Achieved */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Max Score
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formMaxScore}
                    onChange={(e) => setFormMaxScore(e.target.value)}
                    placeholder="e.g. 100"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[46px]"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    Score Achieved
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={formMaxScore || undefined}
                    step="any"
                    disabled={formStatus !== "Completed"}
                    value={formScoreAchieved}
                    onChange={(e) => setFormScoreAchieved(e.target.value)}
                    placeholder={formStatus === "Completed" ? "e.g. 85" : "Disabled (Not completed)"}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[46px] disabled:opacity-50 disabled:cursor-not-allowed"
                    required={formStatus === "Completed"}
                  />
                </div>
              </div>

              {/* Row 3: Date Administered */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Date Administered
                </label>
                <input
                  type="date"
                  value={formDateAdministered}
                  onChange={(e) => setFormDateAdministered(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500 min-h-[46px] cursor-pointer"
                  required
                />
              </div>

              {/* Row 4: Evaluated By (recorded_by) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Evaluated By (Volunteer)
                </label>
                <select
                  value={formRecordedBy}
                  onChange={(e) => setFormRecordedBy(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer min-h-[46px]"
                  required
                >
                  {/* If current user is not in centerVolunteers list, make sure they are an option */}
                  {currentUserId &&
                    !centerVolunteers.some((v) => v.id === currentUserId) && (
                      <option value={currentUserId}>Currently Logged In User</option>
                    )}
                  {centerVolunteers.map((vol) => (
                    <option key={vol.id} value={vol.id}>
                      {getUserDisplayName(vol)} ({vol.role})
                    </option>
                  ))}
                  {centerVolunteers.length === 0 && !currentUserId && (
                    <option value="">No volunteers found</option>
                  )}
                </select>
              </div>

              {/* Row 5: Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Notes & Qualitative Feedback (Optional)
                </label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Add qualitative observations, strengths, improvement areas..."
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-5 py-3 rounded-xl font-bold text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors min-h-[48px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 min-h-[48px] shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Award className="w-4 h-4 stroke-[2.5]" />
                  )}
                  <span>Save Assessment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
