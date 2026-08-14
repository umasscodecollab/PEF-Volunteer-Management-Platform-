"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { 
  X, 
  CalendarOff, 
  Loader2, 
  AlertCircle,
  Calendar,
  FileText
} from "lucide-react";

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionDate: string; // ISO date or YYYY-MM-DD
  sessionTopic?: string;
  userId: string;
  onSuccess?: () => void;
}

export function LeaveRequestModal({
  isOpen,
  onClose,
  sessionDate,
  sessionTopic,
  userId,
  onSuccess
}: LeaveRequestModalProps) {
  // Extract YYYY-MM-DD formatted date from sessionDate
  const defaultDateStr = React.useMemo(() => {
    if (!sessionDate) return new Date().toISOString().split("T")[0];
    try {
      const d = new Date(sessionDate);
      return d.toISOString().split("T")[0];
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }, [sessionDate]);

  const [startDate, setStartDate] = useState(defaultDateStr);
  const [endDate, setEndDate] = useState(defaultDateStr);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setStartDate(defaultDateStr);
      setEndDate(defaultDateStr);
      setReason("");
      setErrorMsg(null);
    }
  }, [isOpen, defaultDateStr]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!startDate || !endDate) {
      setErrorMsg("Please provide both start and end dates.");
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setErrorMsg("End date must be on or after the start date.");
      return;
    }

    if (!reason.trim()) {
      setErrorMsg("Please provide a reason for your leave request.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("leaves").insert({
        volunteer_id: userId,
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim(),
        status: "Pending",
      });

      if (error) throw error;

      toast.success("Leave request submitted successfully! Center Lead will review your request.");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Leave request error:", err);
      setErrorMsg(err?.message || "Failed to submit leave request.");
      toast.error(err?.message || "Failed to submit leave request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[95vw] sm:max-w-lg bg-white dark:bg-zinc-900 shadow-2xl flex flex-col rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <CalendarOff className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 leading-snug">
                Request Leave / Absence
              </h2>
              {sessionTopic && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  {sessionTopic}
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="bg-amber-50/60 dark:bg-amber-950/20 p-3.5 rounded-2xl border border-amber-200/70 dark:border-amber-900/40 flex items-start gap-2.5">
            <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 dark:text-amber-300 leading-relaxed font-medium">
              The dates have been automatically pre-filled with this session's scheduled date. Adjust if requesting a multi-day absence.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Start Date
              </label>
              <input 
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                End Date
              </label>
              <input 
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              Reason for Absence
            </label>
            <textarea 
              rows={3}
              required
              placeholder="Please explain why you cannot facilitate this session..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 text-xs font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button 
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50 min-h-[42px]"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50 min-h-[42px]"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CalendarOff className="w-4 h-4 stroke-[2.2]" />
              )}
              <span>Submit Leave Request</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
