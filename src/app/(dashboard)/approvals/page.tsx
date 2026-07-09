"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  Inbox,
  CheckCircle,
  Loader2,
  Clock,
  Calendar,
  User,
  ShieldCheck,
  Building,
  Check,
  X,
  FileText
} from "lucide-react";

interface RosterRequest {
  id: string;
  session_id: string;
  user_id: string;
  status: string;
  sessions: {
    id: string;
    topic: string;
    start_time: string;
    end_time: string;
    center_id: string;
  };
  users: {
    id: string;
    email: string | null;
    role: string;
  } | null;
}

interface LeaveRequestExtended {
  id: string;
  user_id: string;
  center_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  users: {
    id: string;
    email: string | null;
    role: string;
  } | null;
}

interface LeadProfile {
  id: string;
  email: string | null;
  role: string;
  assigned_center_id: string | null;
  centers: {
    name: string;
  } | null;
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [leadProfile, setLeadProfile] = useState<LeadProfile | null>(null);
  const [requests, setRequests] = useState<RosterRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestExtended[]>([]);
  const [activeTab, setActiveTab] = useState<"shifts" | "leaves">("shifts");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const getDisplayName = (email: string | null) => {
    if (!email) return "Volunteer";
    const prefix = email.split("@")[0];
    return prefix
      .split(".")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const fetchRequests = useCallback(async (centerId: string) => {
    try {
      const { data, error } = await supabase
        .from("session_rosters")
        .select(`
          id,
          session_id,
          user_id,
          status,
          sessions!inner (
            id,
            topic,
            start_time,
            end_time,
            center_id
          ),
          users (
            id,
            email,
            role
          )
        `)
        .eq("status", "Pending")
        .eq("sessions.center_id", centerId);

      if (error) throw error;
      setRequests((data as unknown as RosterRequest[]) || []);
    } catch (err) {
      console.error("Error fetching approvals:", err);
      setErrorMessage("Failed to fetch pending approvals.");
    }
  }, []);

  const fetchLeaveRequests = useCallback(async (centerId: string) => {
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          id,
          user_id,
          center_id,
          start_date,
          end_date,
          reason,
          status,
          users (
            id,
            email,
            role
          )
        `)
        .eq("status", "Pending")
        .eq("center_id", centerId);

      if (error) throw error;
      setLeaveRequests((data as unknown as LeaveRequestExtended[]) || []);
    } catch (err) {
      console.error("Error fetching leave requests:", err);
      setErrorMessage("Failed to fetch pending leave requests.");
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

        // Fetch lead user role & center assignment
        const { data: leadData, error: leadError } = await supabase
          .from("users")
          .select("*, centers(name)")
          .eq("id", authUser.id)
          .single();

        if (leadError || !leadData) {
          throw new Error("Could not fetch user details.");
        }

        // Verify Center Lead or Admin permission
        if (leadData.role !== "Center Lead" && leadData.role !== "Admin") {
          setErrorMessage("Access Denied: You must be a Center Lead or Admin to access this page.");
          setLoading(false);
          return;
        }

        setLeadProfile(leadData);

        if (!leadData.assigned_center_id) {
          setErrorMessage("No center assigned. Please assign a center to this account.");
          setLoading(false);
          return;
        }

        await fetchRequests(leadData.assigned_center_id);
        await fetchLeaveRequests(leadData.assigned_center_id);
      } catch (err) {
        console.error("Initialization error:", err);
        setErrorMessage(err instanceof Error ? err.message : "An error occurred loading the page.");
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, [router, fetchRequests, fetchLeaveRequests]);

  const handleUpdateRequestStatus = async (requestId: string, nextStatus: "Approved" | "Denied") => {
    setUpdatingId(requestId);
    setSuccessMessage(null);
    try {
      const { error } = await supabase
        .from("session_rosters")
        .update({ status: nextStatus })
        .eq("id", requestId);

      if (error) throw error;

      setSuccessMessage(`Shift signup request successfully ${nextStatus.toLowerCase()}!`);
      // Update local state by removing the card
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error("Error updating request:", err);
      const msg = err instanceof Error ? err.message : "Database update failed";
      alert(`Failed to update request: ${msg}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpdateLeaveRequestStatus = async (
    req: LeaveRequestExtended,
    nextStatus: "Approved" | "Denied"
  ) => {
    setUpdatingId(req.id);
    setSuccessMessage(null);
    try {
      if (nextStatus === "Approved") {
        // SMART BACKFILL LOGIC
        // 1. Update status to 'Approved'
        const { error: updateError } = await supabase
          .from("leave_requests")
          .update({ status: "Approved" })
          .eq("id", req.id);

        if (updateError) throw updateError;

        // 2. Query matching sessions falling between leave start_date and end_date
        // for this volunteer's center.
        const { data: overlappingRosters, error: rosterError } = await supabase
          .from("session_rosters")
          .select(`
            id,
            session_id,
            sessions!inner (
              id,
              center_id,
              start_time
            )
          `)
          .eq("user_id", req.user_id)
          .eq("status", "Approved")
          .eq("sessions.center_id", req.center_id)
          .gte("sessions.start_time", req.start_date)
          .lte("sessions.start_time", req.end_date + "T23:59:59.999Z");

        if (rosterError) throw rosterError;

        let backfillMsg = "";
        // 3. Delete approved rosters for those overlapping sessions to free up capacity
        if (overlappingRosters && overlappingRosters.length > 0) {
          const rosterIds = overlappingRosters.map((r) => r.id);
          const { error: deleteError } = await supabase
            .from("session_rosters")
            .delete()
            .in("id", rosterIds);

          if (deleteError) throw deleteError;
          backfillMsg = ` and ${overlappingRosters.length} overlapping session roster assignment(s) were cancelled to free up slot capacity`;
        }

        setSuccessMessage(`Leave request approved successfully${backfillMsg}!`);
      } else {
        // Denied status update
        const { error: updateError } = await supabase
          .from("leave_requests")
          .update({ status: "Denied" })
          .eq("id", req.id);

        if (updateError) throw updateError;
        setSuccessMessage("Leave request successfully denied.");
      }

      // Remove from pending UI list
      setLeaveRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (err) {
      console.error("Error updating leave request:", err);
      const msg = err instanceof Error ? err.message : "Database update failed";
      alert(`Failed to update leave request: ${msg}`);
    } finally {
      setUpdatingId(null);
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
      <div className="flex flex-col items-center justify-center flex-1 py-12 px-5">
        <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-450 animate-spin" />
        <span className="text-sm text-zinc-550 dark:text-zinc-400 mt-3 font-semibold">
          Loading approvals inbox...
        </span>
      </div>
    );
  }

  // Access Denied screen
  if (errorMessage && !leadProfile) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 px-5 text-center select-none">
        <ShieldCheck className="w-16 h-16 text-rose-500 animate-bounce" />
        <h2 className="text-lg font-extrabold text-zinc-900 dark:text-white mt-4">
          Access Denied
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs">
          {errorMessage}
        </p>
      </div>
    );
  }

  const centerName = leadProfile?.centers?.name || "Center Operations";

  return (
    <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in pb-20">
      {/* Title Header */}
      <header className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 uppercase tracking-wider">
            Approvals
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-2">
          Approvals Inbox
        </h1>
        <p className="text-sm text-zinc-550 dark:text-zinc-400 mt-1 flex items-center gap-1 font-medium">
          <Building className="w-4 h-4 shrink-0" />
          {centerName}
        </p>
      </header>

      {/* Tabs Selector */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 mt-2">
        <button
          onClick={() => {
            setActiveTab("shifts");
            setSuccessMessage(null);
          }}
          className={`flex-1 pb-3 text-xs font-extrabold border-b-2 transition-all min-h-[48px] uppercase tracking-wider cursor-pointer ${
            activeTab === "shifts"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300"
          }`}
        >
          Shift Requests ({requests.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("leaves");
            setSuccessMessage(null);
          }}
          className={`flex-1 pb-3 text-xs font-extrabold border-b-2 transition-all min-h-[48px] uppercase tracking-wider cursor-pointer ${
            activeTab === "leaves"
              ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300"
          }`}
        >
          Leave Requests ({leaveRequests.length})
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-900/30 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-455 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-455 leading-relaxed">
            {successMessage}
          </p>
        </div>
      )}

      {/* Requests Lists */}
      <section className="flex flex-col gap-4">
        {activeTab === "shifts" ? (
          /* SHIFT REQUESTS TAB */
          requests.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-8 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center gap-3">
              <Inbox className="w-12 h-12 stroke-[1.2] text-zinc-400" />
              <div>
                <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Inbox Clean</h3>
                <p className="text-xs mt-1">There are no pending volunteer shift signup requests.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {requests.map((req) => {
                const session = req.sessions;
                const volunteerEmail = req.users?.email || "";
                
                return (
                  <div
                    key={req.id}
                    className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4 relative overflow-hidden transition-all duration-200 hover:shadow-md"
                  >
                    {/* Loader Overlay */}
                    {updatingId === req.id && (
                      <div className="absolute inset-0 bg-white/70 dark:bg-zinc-950/70 z-30 flex items-center justify-center backdrop-blur-[1px]">
                        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                      </div>
                    )}

                    {/* Card Header: Volunteer */}
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-xl text-zinc-550 dark:text-zinc-400 shrink-0">
                        <User className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                          {getDisplayName(volunteerEmail)}
                        </h3>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[200px] mt-0.5">
                          {volunteerEmail}
                        </span>
                      </div>
                    </div>

                    {/* Session Details */}
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-xl flex flex-col gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 block">
                        Requested Shift
                      </span>
                      <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        {session.topic}
                      </h4>
                      <div className="flex flex-col gap-1 mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(session.start_time)}
                        </span>
                        <span className="flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTime(session.start_time)} - {formatTime(session.end_time)}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3.5 mt-1">
                      <button
                        onClick={() => handleUpdateRequestStatus(req.id, "Denied")}
                        className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-650 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30 active:scale-[0.97] py-3.5 px-4 rounded-xl font-bold text-xs min-h-[48px] cursor-pointer transition-all duration-150"
                      >
                        <X className="w-4 h-4 stroke-[2.5]" />
                        <span>Deny Shift</span>
                      </button>
                      <button
                        onClick={() => handleUpdateRequestStatus(req.id, "Approved")}
                        className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-450 active:scale-[0.97] py-3.5 px-4 rounded-xl font-bold text-xs min-h-[48px] cursor-pointer shadow-md shadow-emerald-600/10 dark:shadow-none transition-all duration-150"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Approve</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* LEAVE REQUESTS TAB */
          leaveRequests.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-8 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center gap-3">
              <Inbox className="w-12 h-12 stroke-[1.2] text-zinc-405" />
              <div>
                <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Inbox Clean</h3>
                <p className="text-xs mt-1">There are no pending volunteer leave requests.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {leaveRequests.map((req) => {
                const volunteerEmail = req.users?.email || "";
                
                return (
                  <div
                    key={req.id}
                    className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4 relative overflow-hidden transition-all duration-200 hover:shadow-md"
                  >
                    {/* Loader Overlay */}
                    {updatingId === req.id && (
                      <div className="absolute inset-0 bg-white/70 dark:bg-zinc-950/70 z-30 flex items-center justify-center backdrop-blur-[1px]">
                        <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                      </div>
                    )}

                    {/* Card Header: Volunteer */}
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-xl text-zinc-550 dark:text-zinc-400 shrink-0">
                        <User className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                          {getDisplayName(volunteerEmail)}
                        </h3>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[200px] mt-0.5">
                          {volunteerEmail}
                        </span>
                      </div>
                    </div>

                    {/* Leave Details */}
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-xl flex flex-col gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 block">
                        Requested Absence Period
                      </span>
                      <div className="flex flex-col gap-1 mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-450" />
                          From: <strong className="text-zinc-700 dark:text-zinc-300">{formatLocalDate(req.start_date)}</strong>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-450" />
                          To: <strong className="text-zinc-700 dark:text-zinc-300">{formatLocalDate(req.end_date)}</strong>
                        </span>
                      </div>
                      
                      <div className="border-t border-zinc-150 dark:border-zinc-850 my-1.5" />
                      
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 block">
                        Reason for Absence
                      </span>
                      <p className="text-xs text-zinc-650 dark:text-zinc-350 leading-relaxed font-semibold italic flex gap-1 items-start">
                        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-400" />
                        <span>&ldquo;{req.reason}&rdquo;</span>
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3.5 mt-1">
                      <button
                        onClick={() => handleUpdateLeaveRequestStatus(req, "Denied")}
                        className="flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-650 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30 active:scale-[0.97] py-3.5 px-4 rounded-xl font-bold text-xs min-h-[48px] cursor-pointer transition-all duration-150"
                      >
                        <X className="w-4 h-4 stroke-[2.5]" />
                        <span>Deny Leave</span>
                      </button>
                      <button
                        onClick={() => handleUpdateLeaveRequestStatus(req, "Approved")}
                        className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-450 active:scale-[0.97] py-3.5 px-4 rounded-xl font-bold text-xs min-h-[48px] cursor-pointer shadow-md shadow-emerald-600/10 dark:shadow-none transition-all duration-150"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Approve</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </section>
    </div>
  );
}
