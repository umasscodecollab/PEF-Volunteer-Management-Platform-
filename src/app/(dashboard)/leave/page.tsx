"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import {
  CalendarDays,
  CalendarOff,
  Loader2,
  Plus,
  AlertCircle,
  CheckCircle2,
  FileText,
  Palmtree,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { User } from "@supabase/supabase-js";

type LeaveRequest = Database["public"]["Tables"]["leaves"]["Row"];

export default function LeaveRequestsPage() {
  const router = useRouter();

  // Loading & User states
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [assignedCenterId, setAssignedCenterId] = useState<string | null>(null);

  // Leave Requests state
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form toggles & states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchLeaveRequests = useCallback(async (userId: string) => {
    try {
      setFetchError(null);
      const { data, error } = await supabase
        .from("leaves")
        .select("*")
        .eq("volunteer_id", userId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      setLeaveRequests(data || []);
    } catch (err) {
      console.error("Error fetching leave requests:", err);
      setFetchError("Failed to fetch your leave requests.");
    }
  }, []);

  useEffect(() => {
    const initPage = async () => {
      try {
        setLoading(true);
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
          router.push("/login");
          return;
        }
        setUser(authUser);

        // Fetch center assignment from users table
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("role, assigned_center_id")
          .eq("id", authUser.id)
          .single();

        if (profileError || !profile) {
          throw new Error("Could not load user profile details.");
        }

        // Verify volunteer role
        if (profile.role !== "Volunteer") {
          setFetchError("Access Denied: Only volunteers can request leave from this view.");
          setLoading(false);
          return;
        }

        setAssignedCenterId(profile.assigned_center_id);

        if (authUser.id) {
          await fetchLeaveRequests(authUser.id);
        }
      } catch (err) {
        console.error("Initialization error:", err);
        setFetchError(err instanceof Error ? err.message : "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, [router, fetchLeaveRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!user || !assignedCenterId) {
      setFormError("Unable to identify your profile details.");
      return;
    }

    if (!startDate || !endDate) {
      setFormError("Please select both start and end dates.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      setFormError("Leave start date cannot be in the past.");
      return;
    }

    if (end < start) {
      setFormError("End date must be on or after the start date.");
      return;
    }

    if (!reason.trim()) {
      setFormError("Please provide a brief reason for your leave.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("leaves").insert({
        volunteer_id: user.id,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        status: "Pending",
      });

      if (error) throw error;

      setFormSuccess("Leave request submitted successfully!");
      setStartDate("");
      setEndDate("");
      setReason("");
      
      // Close accordion/form after a short delay
      setTimeout(() => {
        setIsFormOpen(false);
        setFormSuccess(null);
      }, 1500);

      // Refresh list
      await fetchLeaveRequests(user.id);
    } catch (err) {
      console.error("Error submitting leave request:", err);
      setFormError(err instanceof Error ? err.message : "Failed to submit leave request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatLocalDate = (dateStr: string) => {
    const parts = dateStr.split("T")[0].split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return dateStr;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 px-5">
        <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-450 animate-spin" />
        <span className="text-sm text-zinc-550 dark:text-zinc-400 mt-3 font-semibold">
          Loading leave requests...
        </span>
      </div>
    );
  }

  if (fetchError && !user) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 px-5 text-center select-none">
        <CalendarOff className="w-16 h-16 text-rose-500 animate-bounce" />
        <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white mt-4">
          Access Error
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs">
          {fetchError}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in pb-20">
      {/* Title Header */}
      <header className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 uppercase tracking-wider">
            Leave Manager
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-2">
          My Leave Requests
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Request temporary absence and view past approvals.
        </p>
      </header>

      {/* Accordion Request Form Toggle Button */}
      <button
        onClick={() => {
          setIsFormOpen(!isFormOpen);
          setFormError(null);
          setFormSuccess(null);
        }}
        className="w-full flex items-center justify-between bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-450 text-white p-4 rounded-2xl font-bold text-sm min-h-[48px] cursor-pointer shadow-md shadow-emerald-600/10 dark:shadow-none transition-all duration-150 active:scale-[0.98]"
      >
        <span className="flex items-center gap-2">
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>New Leave Request</span>
        </span>
        {isFormOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      {/* Accordion Form Panel */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4 animate-slide-down"
        >
          <h3 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
            Request Leave Details
          </h3>

          {/* Form Error Banner */}
          {formError && (
            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/30 rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span className="text-xs font-semibold text-rose-800 dark:text-rose-400">
                {formError}
              </span>
            </div>
          )}

          {/* Form Success Banner */}
          {formSuccess && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-900/30 rounded-xl p-3.5 flex items-start gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-455 shrink-0 mt-0.5" />
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-455">
                {formSuccess}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="startDate" className="text-xs font-bold text-zinc-550 dark:text-zinc-400">
                Start Date
              </label>
              <input
                id="startDate"
                type="date"
                required
                min={new Date().toISOString().split("T")[0]}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate && e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
                className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 min-h-[48px] w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="endDate" className="text-xs font-bold text-zinc-550 dark:text-zinc-400">
                End Date
              </label>
              <input
                id="endDate"
                type="date"
                required
                min={startDate || new Date().toISOString().split("T")[0]}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 min-h-[48px] w-full focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Short Reason */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reason" className="text-xs font-bold text-zinc-550 dark:text-zinc-400">
              Reason for Absence
            </label>
            <textarea
              id="reason"
              rows={3}
              required
              placeholder="E.g., Medical check-up, family commitment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder:text-zinc-400 dark:placeholder:text-zinc-650 resize-none min-h-[80px]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setFormError(null);
                setFormSuccess(null);
              }}
              className="flex-1 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold text-xs min-h-[48px] transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-50 dark:hover:bg-emerald-450 text-white rounded-xl font-bold text-xs min-h-[48px] transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Request</span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Requests List Section */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-extrabold text-zinc-400 dark:text-zinc-505 uppercase tracking-wider">
          Request History
        </h2>

        {fetchError && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-400">
              {fetchError}
            </p>
          </div>
        )}

        {leaveRequests.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-8 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center gap-3">
            <Palmtree className="w-12 h-12 stroke-[1.2] text-zinc-400" />
            <div>
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">No Leave History</h3>
              <p className="text-xs mt-1">You haven&apos;t requested any leaves yet.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {leaveRequests.map((req) => {
              let statusBadgeColor = "bg-zinc-100 text-zinc-800 dark:bg-zinc-850 dark:text-zinc-300";
              if (req.status === "Approved") {
                statusBadgeColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-450 border border-emerald-200/50 dark:border-emerald-850/30";
              } else if (req.status === "Pending") {
                statusBadgeColor = "bg-amber-105 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/50 dark:border-amber-850/30";
              } else if (req.status === "Denied") {
                statusBadgeColor = "bg-rose-100 text-rose-850 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/50 dark:border-rose-850/30";
              }

              return (
                <div
                  key={req.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-3.5"
                >
                  {/* Card Header: Status & Icon */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-450 stroke-[2]" />
                      Leave Requested
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusBadgeColor}`}>
                      {req.status}
                    </span>
                  </div>

                  {/* Date Range */}
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span className="text-[9px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 font-extrabold">From</span>
                        <span className="text-zinc-800 dark:text-zinc-200">{formatLocalDate(req.start_date)}</span>
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 shrink-0 self-end mb-2.5" />
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span className="text-[9px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 font-extrabold">To</span>
                        <span className="text-zinc-800 dark:text-zinc-200">{formatLocalDate(req.end_date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Short Reason */}
                  <div className="flex items-start gap-2 text-xs">
                    <FileText className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[9px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500 font-bold">Reason</span>
                      <p className="text-zinc-650 dark:text-zinc-350 leading-relaxed font-semibold break-words">
                        {req.reason}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
