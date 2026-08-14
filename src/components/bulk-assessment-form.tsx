"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { 
  Award, 
  Save, 
  Loader2, 
  AlertCircle,
  FileSpreadsheet,
  RefreshCw
} from "lucide-react";

export interface StudentRow {
  id?: string;
  student_id: string;
  student_name: string;
  score_achieved: string;
  status: 'Completed' | 'Incomplete' | 'Not Assessed';
  notes: string;
  exam_type: string;
  max_score: string;
  date_administered: string;
}

export interface BulkAssessmentFormProps {
  sessionId: string;
  sessionTopic?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  isInline?: boolean;
  refreshToken?: number | string;
}

export function BulkAssessmentForm({
  sessionId,
  sessionTopic,
  onSuccess,
  onCancel,
  isInline = false,
  refreshToken
}: BulkAssessmentFormProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  
  // Global config
  const [examType, setExamType] = useState<string>("Monthly");
  const [maxScore, setMaxScore] = useState<string>("100");
  const [dateAdministered, setDateAdministered] = useState<string>("");

  useEffect(() => {
    // Set default date to today in YYYY-MM-DD
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
    setDateAdministered(localISOTime);
  }, []);

  const fetchStudentsAndAssessments = async () => {
    setLoading(true);
    try {
      const [attendanceRes, assessmentsRes] = await Promise.all([
        supabase
          .from("student_attendance")
          .select(`
            student_id,
            students (
              name
            )
          `)
          .eq("session_id", sessionId)
          .eq("status", "Present"),
        supabase
          .from("assessments")
          .select("*")
          .eq("session_id", sessionId)
      ]);

      if (attendanceRes.error) throw attendanceRes.error;
      if (assessmentsRes.error) throw assessmentsRes.error;

      const attendanceData = attendanceRes.data || [];
      const existingAssessments = assessmentsRes.data || [];

      // Pre-fill global config if existing assessments are present
      let currentDefaultExamType = examType;
      let currentDefaultMaxScore = maxScore;
      let currentDefaultDate = dateAdministered;

      if (existingAssessments.length > 0) {
        const first = existingAssessments[0];
        if (first.exam_type) {
          setExamType(first.exam_type);
          currentDefaultExamType = first.exam_type;
        }
        if (first.max_score != null) {
          setMaxScore(first.max_score.toString());
          currentDefaultMaxScore = first.max_score.toString();
        }
        if (first.date_administered) {
          setDateAdministered(first.date_administered);
          currentDefaultDate = first.date_administered;
        }
      }

      const assessmentByStudent = new Map<string, any>();
      existingAssessments.forEach((item: any) => {
        if (item.student_id) {
          assessmentByStudent.set(item.student_id, item);
        }
      });

      const rows: StudentRow[] = attendanceData.map((item: any) => {
        const existing = assessmentByStudent.get(item.student_id);
        if (existing) {
          return {
            id: existing.id,
            student_id: item.student_id,
            student_name: item.students?.name || "Unknown Student",
            score_achieved: existing.score_achieved != null ? existing.score_achieved.toString() : "",
            status: (existing.status as 'Completed' | 'Incomplete' | 'Not Assessed') || "Completed",
            notes: existing.notes || "",
            exam_type: existing.exam_type || currentDefaultExamType,
            max_score: existing.max_score != null ? existing.max_score.toString() : currentDefaultMaxScore,
            date_administered: existing.date_administered || currentDefaultDate
          };
        }
        return {
          student_id: item.student_id,
          student_name: item.students?.name || "Unknown Student",
          score_achieved: "",
          status: "Completed",
          notes: "",
          exam_type: currentDefaultExamType,
          max_score: currentDefaultMaxScore,
          date_administered: currentDefaultDate
        };
      });

      // Sort alphabetically by name
      rows.sort((a, b) => a.student_name.localeCompare(b.student_name));
      setStudentRows(rows);
    } catch (err: any) {
      console.error("Error fetching students/assessments:", err);
      toast.error("Failed to load students and assessment data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchStudentsAndAssessments();
    }
  }, [sessionId, refreshToken]);

  const handleRowChange = (index: number, field: keyof StudentRow, value: string) => {
    setStudentRows(prev => {
      const newRows = [...prev];
      newRows[index] = { ...newRows[index], [field]: value };
      
      // If status changed to Incomplete or Not Assessed, clear the score
      if (field === 'status' && value !== 'Completed') {
        newRows[index].score_achieved = "";
      }
      return newRows;
    });
  };

  const handleApplyGlobalToAll = () => {
    setStudentRows(prev => prev.map(row => ({
      ...row,
      exam_type: examType,
      max_score: maxScore,
      date_administered: dateAdministered
    })));
    toast.success("Applied global settings to all student rows");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Validation
    let validationFailed = false;
    for (const row of studentRows) {
      const rowMaxScore = Number(row.max_score);
      if (!row.max_score || isNaN(rowMaxScore) || rowMaxScore <= 0) {
        toast.error(`Please enter a valid Maximum Score for ${row.student_name}.`);
        validationFailed = true;
        break;
      }
      if (!row.date_administered) {
        toast.error(`Please select an Administration Date for ${row.student_name}.`);
        validationFailed = true;
        break;
      }
      if (row.status === 'Completed') {
        const scoreNum = Number(row.score_achieved);
        if (row.score_achieved === "" || isNaN(scoreNum) || scoreNum < 0 || scoreNum > rowMaxScore) {
          toast.error(`Please enter a valid score (0-${rowMaxScore}) for ${row.student_name}, or change their status.`);
          validationFailed = true;
          break;
        }
      }
    }
    if (validationFailed) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated.");

      const payload = studentRows.map((row) => {
        const rowMaxScoreNum = Number(row.max_score);
        return {
          ...(row.id ? { id: row.id } : {}),
          student_id: row.student_id,
          session_id: sessionId,
          exam_type: row.exam_type,
          max_score: rowMaxScoreNum,
          score_achieved: row.status === 'Completed' && row.score_achieved !== '' ? Number(row.score_achieved) : null,
          status: row.status,
          date_administered: row.date_administered,
          recorded_by: user.id,
          notes: row.notes?.trim() || null,
          // Fallbacks for DB schema constraints
          date: row.date_administered,
          subject: sessionTopic || "General",
        };
      });

      if (payload.length > 0) {
        const { error } = await supabase.from("assessments").upsert(payload);
        if (error) throw error;
      }

      toast.success(`Successfully saved assessments for ${payload.length} student${payload.length !== 1 ? 's' : ''}!`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Error submitting assessments:", err);
      toast.error(`Failed to submit assessments: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Global Config Section */}
      <section className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
            Global Assessment Defaults
          </h3>
          <button
            type="button"
            onClick={handleApplyGlobalToAll}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 hover:underline focus:outline-none cursor-pointer"
          >
            Apply Defaults to All Students
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Exam Type</label>
            <select 
              value={examType}
              onChange={(e) => setExamType(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl p-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Diagnostic">Diagnostic</option>
              <option value="Monthly">Monthly</option>
              <option value="Mid-Year">Mid-Year</option>
              <option value="End-of-Year">End-of-Year</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Max Score</label>
            <input 
              type="number"
              min="1"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl p-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
              Date Administered
            </label>
            <input 
              type="date"
              value={dateAdministered}
              onChange={(e) => setDateAdministered(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl p-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </section>

      {/* Student Grid Section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-500" />
            Present Students ({studentRows.length})
          </h3>
          <button
            type="button"
            onClick={fetchStudentsAndAssessments}
            disabled={loading}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Roster
          </button>
        </div>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center p-10 gap-3 text-zinc-500 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-dashed">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-xs font-medium">Loading assessment roster...</span>
          </div>
        ) : studentRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 gap-2 text-center bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/80 dark:border-amber-900/60">
            <AlertCircle className="w-8 h-8 text-amber-500" />
            <div className="flex flex-col">
              <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200">No students are currently marked as 'Present'</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-sm mx-auto">
                Mark student attendance as Present in the grid above to log their scores here.
              </span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[850px]">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-3.5 py-3 font-bold text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Student</th>
                  <th className="px-3.5 py-3 font-bold text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400 w-36">Exam Type</th>
                  <th className="px-3.5 py-3 font-bold text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400 w-24">Max Score</th>
                  <th className="px-3.5 py-3 font-bold text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400 w-36">Date Admin.</th>
                  <th className="px-3.5 py-3 font-bold text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400 w-36">Status</th>
                  <th className="px-3.5 py-3 font-bold text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400 w-28">Score</th>
                  <th className="px-3.5 py-3 font-bold text-xs uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Notes (Optional)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                {studentRows.map((row, idx) => (
                  <tr key={row.student_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-3.5 py-3 font-bold text-zinc-900 dark:text-zinc-100">
                      {row.student_name}
                    </td>
                    <td className="px-3.5 py-3">
                      <select 
                        value={row.exam_type}
                        onChange={(e) => handleRowChange(idx, 'exam_type', e.target.value)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500 w-32"
                      >
                        <option value="Diagnostic">Diagnostic</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Mid-Year">Mid-Year</option>
                        <option value="End-of-Year">End-of-Year</option>
                      </select>
                    </td>
                    <td className="px-3.5 py-3">
                      <input 
                        type="number"
                        min="1"
                        value={row.max_score}
                        onChange={(e) => handleRowChange(idx, 'max_score', e.target.value)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500 w-20"
                      />
                    </td>
                    <td className="px-3.5 py-3">
                      <input 
                        type="date"
                        value={row.date_administered}
                        onChange={(e) => handleRowChange(idx, 'date_administered', e.target.value)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500 w-32"
                      />
                    </td>
                    <td className="px-3.5 py-3">
                      <select 
                        value={row.status}
                        onChange={(e) => handleRowChange(idx, 'status', e.target.value)}
                        className={`w-full border rounded-lg p-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${
                          row.status === 'Completed' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300' 
                            : row.status === 'Incomplete'
                            ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300'
                            : 'bg-zinc-100 border-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                        }`}
                      >
                        <option value="Completed">Completed</option>
                        <option value="Incomplete">Incomplete</option>
                        <option value="Not Assessed">Not Assessed</option>
                      </select>
                    </td>
                    <td className="px-3.5 py-3">
                      <input 
                        type="number"
                        min="0"
                        max={row.max_score}
                        value={row.score_achieved}
                        onChange={(e) => handleRowChange(idx, 'score_achieved', e.target.value)}
                        disabled={row.status !== 'Completed'}
                        placeholder={row.status === 'Completed' ? "Score" : "N/A"}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg p-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed w-20"
                      />
                    </td>
                    <td className="px-3.5 py-3">
                      <input 
                        type="text"
                        value={row.notes}
                        onChange={(e) => handleRowChange(idx, 'notes', e.target.value)}
                        placeholder="Add context..."
                        className="w-full bg-transparent border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-300 dark:focus:border-indigo-700 rounded-lg p-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none transition-colors min-w-[140px]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button 
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50 min-h-[42px]"
          >
            Cancel
          </button>
        )}
        <button 
          type="button"
          onClick={() => handleSubmit()}
          disabled={submitting || studentRows.length === 0}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[42px]"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 stroke-[2.2]" />}
          <span>Save & Submit Assessments</span>
        </button>
      </div>
    </div>
  );
}
