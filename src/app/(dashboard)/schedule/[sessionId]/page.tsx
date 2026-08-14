"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import { Loader2 } from "lucide-react";
import { LeadSessionView } from "@/components/session/lead-session-view";
import { VolunteerUnassignedView } from "@/components/session/volunteer-unassigned-view";
import { VolunteerAssignedView } from "@/components/session/volunteer-assigned-view";

type Session = Database["public"]["Tables"]["sessions"]["Row"];

export default function SessionDetailsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter();
  const unwrappedParams = React.use(params);
  const { sessionId } = unwrappedParams;

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("Volunteer");
  const [session, setSession] = useState<Session | null>(null);
  const [isVolunteerAssigned, setIsVolunteerAssigned] = useState(false);

  useEffect(() => {
    const loadRoutingData = async () => {
      try {
        setLoading(true);

        // 1. Fetch current auth user and profile role
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          router.push("/login");
          return;
        }
        setCurrentUser(authUser);

        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", authUser.id)
          .maybeSingle();

        const role = profile?.role || "Volunteer";
        setUserRole(role);

        // 2. Fetch session data
        const { data: sessionData, error: sessionErr } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessionErr || !sessionData) {
          console.error("Error fetching session:", sessionErr);
          return;
        }
        setSession(sessionData);

        // 3. Determine volunteer assignment / facilitator status
        // Checks if session has facilitator_id assigned to user or if user is approved in session_enrollments
        if (role === "Volunteer") {
          const isDirectFacilitator = (sessionData as any).facilitator_id === authUser.id;

          let sessionIds = [sessionId];
          if (sessionData.batch_id) {
            const { data: batchSessions } = await supabase
              .from("sessions")
              .select("id")
              .eq("batch_id", sessionData.batch_id);

            if (batchSessions && batchSessions.length > 0) {
              sessionIds = batchSessions.map((s) => s.id);
            }
          }

          const { data: approvedEnrollment } = await supabase
            .from("session_enrollments")
            .select("id")
            .in("session_id", sessionIds)
            .eq("user_id", authUser.id)
            .eq("status", "Approved")
            .maybeSingle();

          setIsVolunteerAssigned(Boolean(isDirectFacilitator || approvedEnrollment));
        }
      } catch (err) {
        console.error("Error loading session routing data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadRoutingData();
  }, [sessionId, router]);

  if (loading || !session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin stroke-[2]" />
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Loading Session...
        </span>
      </div>
    );
  }

  // Role-Based Routing
  // 1. Center Lead / Admins / Board Directors -> Operations Dashboard
  if (userRole === "Center Lead" || userRole === "Admin" || userRole === "Board Director" || userRole === "Board of Directors") {
    return <LeadSessionView session={session} currentUser={currentUser} role={userRole} />;
  }

  // 2. Unassigned Volunteer -> Discovery Mode
  if (userRole === "Volunteer" && !isVolunteerAssigned) {
    return <VolunteerUnassignedView session={session} currentUser={currentUser} role={userRole} />;
  }

  // 3. Assigned Volunteer -> Classroom Mode
  return <VolunteerAssignedView session={session} currentUser={currentUser} role={userRole} />;
}
