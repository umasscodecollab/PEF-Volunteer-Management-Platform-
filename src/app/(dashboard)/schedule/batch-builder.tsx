"use client";

import React, { useState } from "react";
import { X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { createBatchAndSessions } from "./actions";

interface BatchBuilderProps {
  centerId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function BatchBuilder({
  centerId,
  isOpen,
  onClose,
  onSuccess,
}: BatchBuilderProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:30");
  const [capacity, setCapacity] = useState("4");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  if (!isOpen) return null;

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!name.trim()) return setFormError("Please enter a batch name.");
    if (!startDate || !endDate) return setFormError("Please select both start and end dates.");
    if (new Date(endDate) < new Date(startDate)) return setFormError("End date must be after start date.");
    if (selectedDays.length === 0) return setFormError("Please select at least one day of the week.");
    if (!startTime || !endTime) return setFormError("Please select start and end times.");
    if (new Date(`1970-01-01T${endTime}`) <= new Date(`1970-01-01T${startTime}`)) return setFormError("End time must be after the start time.");
    
    const cap = parseInt(capacity);
    if (isNaN(cap) || cap <= 0) return setFormError("Capacity must be a positive number.");

    setIsSubmitting(true);

    try {
      const result = await createBatchAndSessions({
        name: name.trim(),
        grade: grade.trim(),
        subject: subject.trim(),
        center_id: centerId,
        start_date: startDate,
        end_date: endDate,
        days_of_week: selectedDays,
        start_time: startTime,
        end_time: endTime,
        capacity: cap,
      });

      if (!result.success) {
        setFormError(result.error || "Failed to generate batch.");
      } else {
        setFormSuccess(`Successfully generated ${result.count} sessions!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setFormError("A network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center select-none animate-fade-in p-4">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-3xl border border-zinc-200 dark:border-zinc-850 p-6 flex flex-col gap-5 shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto pb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Create Recurring Batch
          </h2>
          <button
            onClick={() => {
              onClose();
              setFormError("");
              setFormSuccess("");
            }}
            className="p-1 rounded-full text-zinc-450 dark:text-zinc-555 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl p-3.5 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-455 shrink-0 mt-0.5" />
            <span className="text-xs font-semibold text-rose-800 dark:text-rose-355 leading-relaxed">
              {formError}
            </span>
          </div>
        )}

        {formSuccess && (
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 rounded-2xl p-3.5 flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-455 shrink-0 mt-0.5" />
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-355 leading-relaxed">
              {formSuccess}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
              Batch Name
            </label>
            <input
              type="text"
              placeholder="e.g. Sion Morning Math"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
                Grade
              </label>
              <input
                type="text"
                placeholder="e.g. 5th Grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
                Subject
              </label>
              <input
                type="text"
                placeholder="e.g. Math"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
                Term Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
                Term End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
              Days of Week
            </label>
            <div className="flex flex-wrap gap-2 mt-1">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    disabled={isSubmitting}
                    className={`min-h-[40px] px-3.5 rounded-lg text-sm font-bold border transition-colors ${
                      isSelected
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                        : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    } disabled:opacity-50`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isSubmitting}
                className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-505 dark:text-zinc-400">
              Target Capacity (Volunteers Needed per session)
            </label>
            <input
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-550 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-455 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Batch"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full min-h-[48px] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-350 font-bold text-sm rounded-xl flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
