"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Users,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from "lucide-react";

type Session = Database["public"]["Tables"]["sessions"]["Row"];
type Center = Database["public"]["Tables"]["centers"]["Row"];

export default function SchedulePage() {
  const router = useRouter();

  // Auth and Profile States
  const [loading, setLoading] = useState(true);
  const [center, setCenter] = useState<Center | null>(null);
  const [assignedCenterId, setAssignedCenterId] = useState<string | null>(null);

  // Sessions State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [fetchError, setFetchError] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Form Fields
  const [topic, setTopic] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:30");
  const [capacity, setCapacity] = useState("4");

  // Format today's date for defaults
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
  }, []);

  // Fetch session and associated data
  useEffect(() => {
    const checkSessionAndFetch = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/login");
          return;
        }

        // Fetch current user's profile and center in a single query
        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("*, centers(*)")
          .eq("id", user.id)
          .single();

        if (profileError || !profile) {
          console.error(
            "Error fetching user profile:",
            profileError?.message,
            profileError?.details,
            profileError?.code
          );
          setFetchError("Unable to retrieve user center profile.");
          setLoading(false);
          return;
        }

        console.log("Fetched User Profile (schedule):", profile);
        setAssignedCenterId(profile.assigned_center_id);

        if (profile.centers) {
          if (Array.isArray(profile.centers)) {
            setCenter(profile.centers[0] as unknown as Center);
          } else {
            setCenter(profile.centers as unknown as Center);
          }
        }

        // Fetch Sessions
        await fetchSessions();
      } catch (err) {
        setFetchError("An unexpected error occurred while loading schedule data.");
      } finally {
        setLoading(false);
      }
    };

    checkSessionAndFetch();
  }, [router]);

  const fetchSessions = async () => {
    setFetchError("");
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .order("start_time", { ascending: true });

    if (error) {
      setFetchError("Failed to fetch sessions. Please try again.");
    } else {
      setSessions(data || []);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!assignedCenterId) {
      setFormError("No assigned center associated with your profile.");
      return;
    }

    if (!topic.trim()) {
      setFormError("Please enter a session topic.");
      return;
    }

    if (!date) {
      setFormError("Please select a session date.");
      return;
    }

    if (!startTime || !endTime) {
      setFormError("Please select start and end times.");
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    if (endDateTime <= startDateTime) {
      setFormError("End time must be after the start time.");
      return;
    }

    const capacityNum = parseInt(capacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      setFormError("Capacity must be a positive number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("sessions").insert({
        topic: topic.trim(),
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        capacity: capacityNum,
        center_id: assignedCenterId,
      });

      if (error) {
        setFormError(error.message || "Failed to create session.");
      } else {
        setFormSuccess("Session created successfully!");
        setTopic("");
        const today = new Date().toISOString().split("T")[0];
        setDate(today);
        setStartTime("10:00");
        setEndTime("11:30");
        setCapacity("4");

        // Refresh sessions list
        await fetchSessions();

        // Close modal after a short delay
        setTimeout(() => {
          setIsModalOpen(false);
          setFormSuccess("");
        }, 1500);
      }
    } catch (err) {
      setFormError("A network error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin stroke-[2]" />
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Loading Schedule...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in relative min-h-full">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Center Schedule
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1 font-medium">
            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
            {center ? `${center.name}` : "Loading location..."}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 active:bg-emerald-700 dark:bg-emerald-500 dark:active:bg-emerald-600 text-white font-bold text-sm px-4 py-3 rounded-2xl shadow-md transition-all active:scale-[0.97] min-h-[48px]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Create Session
        </button>
      </header>

      {/* Fetch Error Display */}
      {fetchError && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-450 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">
              Error Loading Data
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-400/90 leading-relaxed">
              {fetchError}
            </p>
            <button
              onClick={fetchSessions}
              className="text-xs font-bold text-rose-600 dark:text-rose-450 underline text-left mt-1 hover:text-rose-800"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <section className="flex flex-col gap-4">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl text-center shadow-sm min-h-[250px] gap-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-full text-zinc-400">
              <Calendar className="w-8 h-8 stroke-[1.5]" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                No Sessions Scheduled
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[200px] leading-relaxed">
                Create your first session using the button above to begin managing volunteers.
              </p>
            </div>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col gap-3.5 hover:shadow-md transition-shadow active:bg-zinc-50 dark:active:bg-zinc-850/50"
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200/40 uppercase tracking-wider">
                  Upcoming
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 stroke-[1.8]" />
                  {formatDate(session.start_time)}
                </span>
              </div>

              <div className="flex justify-between items-end">
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-snug break-words">
                    {session.topic}
                  </h3>
                  <div className="flex flex-col gap-1 mt-2">
                    <span className="text-xs text-zinc-550 dark:text-zinc-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      {formatTime(session.start_time)} - {formatTime(session.end_time)}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-450 dark:text-zinc-500 shrink-0" />
              </div>

              <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3 flex justify-between items-center text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                  Target Capacity
                </span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-200/20">
                  {session.capacity} Volunteers
                </span>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Create Session Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-sm z-50 flex items-end justify-center select-none animate-fade-in">
          {/* Modal Content Drawer */}
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl border-t border-zinc-200 dark:border-zinc-850 p-6 flex flex-col gap-5 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto pb-10">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                Create New Session
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setFormError("");
                  setFormSuccess("");
                }}
                className="p-1 rounded-full text-zinc-450 dark:text-zinc-555 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Messages */}
            {formError && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl p-3.5 flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-450 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-rose-800 dark:text-rose-350 leading-relaxed">
                  {formError}
                </span>
              </div>
            )}

            {formSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 rounded-2xl p-3.5 flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-450 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-350 leading-relaxed">
                  {formSuccess}
                </span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateSession} className="flex flex-col gap-4">
              
              {/* Topic Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Session Topic
                </label>
                <input
                  type="text"
                  placeholder="e.g. Basic Arithmetic & Counting"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                />
              </div>

              {/* Date Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                />
              </div>

              {/* Time Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Capacity Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Target Capacity (Volunteers Needed)
                </label>
                <input
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent text-zinc-900 dark:text-white disabled:opacity-50"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col gap-3 mt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] bg-emerald-600 active:bg-emerald-700 dark:bg-emerald-500 dark:active:bg-emerald-600 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Session...
                    </>
                  ) : (
                    "Create Session"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormError("");
                    setFormSuccess("");
                  }}
                  disabled={isSubmitting}
                  className="w-full min-h-[48px] bg-zinc-100 active:bg-zinc-200 dark:bg-zinc-800 dark:active:bg-zinc-850 text-zinc-700 dark:text-zinc-300 font-bold text-sm rounded-xl flex items-center justify-center transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
