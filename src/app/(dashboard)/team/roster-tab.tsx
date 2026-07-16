"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  UserCheck,
  Eye,
  Building
} from "lucide-react";

interface VolunteerProfile {
  user_id: string;
  status: string;
  id_document_url: string | null;
  nda_document_url: string | null;
  consent_form_url: string | null;
  background_check_cleared: boolean;
}

interface VolunteerUser {
  id: string;
  email: string | null;
  role: string;
  assigned_center_id: string | null;
  volunteer_profiles: VolunteerProfile | VolunteerProfile[] | null;
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

export default function RosterTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [leadProfile, setLeadProfile] = useState<LeadProfile | null>(null);
  const [volunteers, setVolunteers] = useState<VolunteerUser[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<string>("All");

  const getDisplayName = (email: string | null) => {
    if (!email) return "Volunteer";
    const prefix = email.split("@")[0];
    return prefix
      .split(".")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const fetchRoster = useCallback(async (centerId: string) => {
    try {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select(`
          id,
          email,
          role,
          assigned_center_id
        `)
        .eq("role", "Volunteer")
        .eq("assigned_center_id", centerId);

      if (usersError) throw usersError;

      if (!usersData || usersData.length === 0) {
        setVolunteers([]);
        return;
      }

      const userIds = usersData.map((u) => u.id);

      const { data: profilesData, error: profilesError } = await supabase
        .from("volunteer_profiles")
        .select(`
          user_id,
          status,
          id_document_url,
          nda_document_url,
          consent_form_url,
          background_check_cleared
        `)
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      const combined = usersData.map((user) => {
        const profile = profilesData?.find((p) => p.user_id === user.id) || null;
        return {
          ...user,
          volunteer_profiles: profile,
        };
      });

      setVolunteers(combined);
    } catch (err) {
      console.error("Error fetching roster:", err);
      setErrorMessage("Failed to fetch volunteer roster.");
    }
  }, []);

  useEffect(() => {
    const initPage = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        // Fetch lead user role & center assignment
        const { data: leadData, error: leadError } = await supabase
          .from("users")
          .select("*, centers(name)")
          .eq("id", user.id)
          .single();

        if (leadError || !leadData) {
          throw new Error("Could not fetch user role details.");
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

        await fetchRoster(leadData.assigned_center_id);
      } catch (err) {
        console.error("Initialization error:", err);
        setErrorMessage(err instanceof Error ? err.message : "An error occurred loading the page.");
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, [router, fetchRoster]);

  const handleReviewDocument = async (storagePath: string | null, label: string) => {
    if (!storagePath) return;
    
    try {
      // Create signed URL for secure private document access
      const { data, error } = await supabase.storage
        .from("onboarding_documents")
        .createSignedUrl(storagePath, 300); // 5 minutes expiration

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err) {
      console.error("Signed url error:", err);
      const msg = err instanceof Error ? err.message : "Unauthorized";
      alert(`Could not open ${label}: ${msg}`);
    }
  };

  const handleToggleBackgroundCheck = async (volunteerId: string, currentVal: boolean) => {
    setUpdatingId(volunteerId);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const { error } = await supabase
        .from("volunteer_profiles")
        .update({
          background_check_cleared: !currentVal,
        })
        .eq("user_id", volunteerId);

      if (error) throw error;

      setSuccessMessage("Background check updated successfully!");
      if (leadProfile?.assigned_center_id) {
        await fetchRoster(leadProfile.assigned_center_id);
      }
    } catch (err) {
      console.error("Background check update error:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(`Failed to update background check: ${msg}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePromoteStatus = async (volunteerId: string, currentStatus: string) => {
    const pipeline = ["Application", "Screening", "Orientation", "Active"];
    const currentIndex = pipeline.indexOf(currentStatus);
    
    if (currentIndex === -1 || currentIndex === pipeline.length - 1) return;
    
    const nextStatus = pipeline[currentIndex + 1];

    // Verify background check clearance before promotion
    const volunteer = volunteers.find((v) => v.id === volunteerId);
    const rawProfile = volunteer?.volunteer_profiles;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
    const bgCleared = profile?.background_check_cleared || false;

    if (!bgCleared) {
      const msg = `Volunteer needs to pass background check before being promoted to ${nextStatus}.`;
      setErrorMessage(msg);
      setSuccessMessage(null);
      return;
    }

    setUpdatingId(volunteerId);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from("volunteer_profiles")
        .update({
          status: nextStatus,
        })
        .eq("user_id", volunteerId);

      if (error) throw error;

      setSuccessMessage(`Volunteer promoted to ${nextStatus}!`);
      if (leadProfile?.assigned_center_id) {
        await fetchRoster(leadProfile.assigned_center_id);
      }
    } catch (err) {
      console.error("Promotion error:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(`Failed to promote volunteer: ${msg}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDemoteStatus = async (volunteerId: string, currentStatus: string) => {
    const pipeline = ["Application", "Screening", "Orientation", "Active"];
    const currentIndex = pipeline.indexOf(currentStatus);
    
    if (currentIndex === -1 || currentIndex === 0) return;
    
    const prevStatus = pipeline[currentIndex - 1];
    setUpdatingId(volunteerId);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const { error } = await supabase
        .from("volunteer_profiles")
        .update({
          status: prevStatus,
        })
        .eq("user_id", volunteerId);

      if (error) throw error;

      setSuccessMessage(`Volunteer moved back to ${prevStatus}!`);
      if (leadProfile?.assigned_center_id) {
        await fetchRoster(leadProfile.assigned_center_id);
      }
    } catch (err) {
      console.error("Demotion error:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(`Failed to move back volunteer: ${msg}`);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 px-5">
        <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-spin" />
        <span className="text-sm text-zinc-550 dark:text-zinc-400 mt-3 font-semibold">
          Loading center roster...
        </span>
      </div>
    );
  }

  // Access Denied screen
  if (errorMessage && !leadProfile) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 px-5 text-center select-none">
        <ShieldAlert className="w-16 h-16 text-rose-500 animate-bounce" />
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

  // Roster filtering
  const filteredVolunteers = volunteers.filter((vol) => {
    const rawProfile = vol.volunteer_profiles;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
    const status = profile?.status || "Application";

    if (filterStage === "All") return true;
    if (filterStage === "Pending") return status !== "Active";
    return status === filterStage;
  });

  return (
    <div className="flex flex-col gap-6 select-none animate-fade-in">

      {/* Roster Filters */}
      <section className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50">
        {["All", "Pending", "Active"].map((stage) => (
          <button
            key={stage}
            onClick={() => setFilterStage(stage)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all min-h-[38px] ${
              filterStage === stage
                ? "bg-white dark:bg-zinc-850 text-emerald-600 dark:text-emerald-450 shadow-sm border border-zinc-200/20 dark:border-zinc-850"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {stage === "Pending" ? "Onboarding" : stage}
          </button>
        ))}
      </section>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-900/30 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-450 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-450 leading-relaxed">
            {successMessage}
          </p>
        </div>
      )}

      {/* Error Notification Alert */}
      {errorMessage && leadProfile && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/30 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-455 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-rose-800 dark:text-rose-450 leading-relaxed">
            {errorMessage}
          </p>
        </div>
      )}

      {/* Volunteers Cards List */}
      <section className="flex flex-col gap-4">
        {filteredVolunteers.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-8 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center gap-3">
            <Users className="w-12 h-12 stroke-[1.2] text-zinc-400" />
            <div>
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">No Volunteers Found</h3>
              <p className="text-xs mt-1">There are no volunteers matching this filter stage.</p>
            </div>
          </div>
        ) : (
          filteredVolunteers.map((vol) => {
            const rawProfile = vol.volunteer_profiles;
            const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
            
            const status = profile?.status || "Application";
            const bgCleared = profile?.background_check_cleared || false;
            
            const pipeline = ["Application", "Screening", "Orientation", "Active"];
            const isCompleted = status === "Active";

            return (
              <div
                key={vol.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4 relative overflow-hidden transition-all duration-200 hover:shadow-md"
              >
                {/* Loader Overlay */}
                {updatingId === vol.id && (
                  <div className="absolute inset-0 bg-white/70 dark:bg-zinc-950/70 z-30 flex items-center justify-center backdrop-blur-[1px]">
                    <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                  </div>
                )}

                {/* Card Header Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      {getDisplayName(vol.email)}
                    </h3>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[200px] mt-0.5">
                      {vol.email}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                      status === "Active"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/40"
                        : status === "Orientation"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border-blue-100 dark:border-blue-800/40"
                        : status === "Screening"
                        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-100 dark:border-amber-800/40"
                        : "bg-zinc-50 text-zinc-650 dark:bg-zinc-950 dark:text-zinc-450 border-zinc-150 dark:border-zinc-850"
                    }`}
                  >
                    {status}
                  </span>
                </div>

                {/* Background Check Toggle section */}
                <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-xl">
                  <div className="flex items-center gap-2">
                    {bgCleared ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 stroke-[2]" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500 dark:text-amber-450 stroke-[2]" />
                    )}
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Background Check
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleBackgroundCheck(vol.id, bgCleared)}
                    className={`text-[10px] font-extrabold uppercase tracking-wide px-3.5 py-2 rounded-lg transition-all border min-h-[38px] active:scale-95 ${
                      bgCleared
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/40 hover:bg-emerald-100"
                        : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                    {bgCleared ? "Cleared" : "Mark Clear"}
                  </button>
                </div>

                {/* Documents Roster list */}
                <div className="flex flex-col gap-2.5">
                  <h4 className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide px-1">
                    Documents Review
                  </h4>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "id_document_url", label: "Gov ID" },
                      { key: "nda_document_url", label: "NDA" },
                      { key: "consent_form_url", label: "Consent" }
                    ].map((doc) => {
                      const docPath = profile?.[doc.key as keyof VolunteerProfile] as string | null;
                      const hasDoc = !!docPath;

                      return (
                        <button
                          key={doc.key}
                          disabled={!hasDoc}
                          onClick={() => handleReviewDocument(docPath, doc.label)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all select-none text-center min-h-[70px] ${
                            hasDoc
                              ? "bg-white dark:bg-zinc-900 border-emerald-350/30 hover:border-emerald-500/40 text-emerald-700 dark:text-emerald-400 cursor-pointer active:scale-95 shadow-sm"
                              : "bg-zinc-50 dark:bg-zinc-950 border-zinc-100 dark:border-zinc-850 text-zinc-400 cursor-not-allowed opacity-60"
                          }`}
                        >
                          <Eye className={`w-4 h-4 mb-1.5 ${hasDoc ? "text-emerald-600 dark:text-emerald-450" : "text-zinc-350"}`} />
                          <span className="text-[10px] font-bold tracking-wide truncate max-w-[80px]">
                            {doc.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pipeline Actions */}
                <div className="flex flex-col gap-2 mt-1 pt-1">
                  {!isCompleted ? (
                    <button
                      onClick={() => handlePromoteStatus(vol.id, status)}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-450 active:scale-[0.98] py-3.5 px-4 rounded-xl font-bold text-xs min-h-[48px] shadow-md shadow-emerald-600/10 dark:shadow-none transition-all duration-150"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span>Promote to {pipeline[pipeline.indexOf(status) + 1]}</span>
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/20 text-emerald-700 dark:text-emerald-450 py-3.5 px-4 rounded-xl font-bold text-xs min-h-[48px]">
                      <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-450 stroke-[2.2]" />
                      <span>Fully Active Volunteer</span>
                    </div>
                  )}

                  {status !== "Application" && (
                    <button
                      onClick={() => handleDemoteStatus(vol.id, status)}
                      className="w-full flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 active:scale-[0.98] py-3 px-4 rounded-xl font-bold text-xs min-h-[40px] border border-zinc-200 dark:border-zinc-800 transition-all duration-150"
                    >
                      <TrendingDown className="w-4 h-4" />
                      <span>Move Back to {pipeline[pipeline.indexOf(status) - 1]}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
