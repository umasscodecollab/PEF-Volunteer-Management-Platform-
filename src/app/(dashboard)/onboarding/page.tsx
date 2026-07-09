"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import {
  Upload,
  CheckCircle,
  FileText,
  AlertCircle,
  Loader2,
  Lock,
  ShieldCheck
} from "lucide-react";
import { User } from "@supabase/supabase-js";

interface VolunteerProfile {
  user_id: string;
  status: string;
  id_document_url: string | null;
  nda_document_url: string | null;
  consent_form_url: string | null;
  background_check_cleared: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Document types config
  const documentTypes = [
    {
      key: "id_document_url",
      label: "Government ID",
      description: "Upload a clear photo or PDF of your Aadhar card, PAN card, or driver's license.",
      fileName: "id_document",
    },
    {
      key: "nda_document_url",
      label: "Non-Disclosure Agreement (NDA)",
      description: "Please sign and upload the volunteer NDA document.",
      fileName: "nda_document",
    },
    {
      key: "consent_form_url",
      label: "Volunteer Consent Form",
      description: "Upload your signed liability and medical consent form.",
      fileName: "consent_form",
    },
  ];

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("volunteer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        // Create default profile with 'Application' status if it doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from("volunteer_profiles")
          .insert({
            user_id: userId,
            status: "Application",
            background_check_cleared: false,
          })
          .select()
          .single();

        if (createError) throw createError;
        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error("Error in fetchProfile:", err);
      setErrorMessage("Failed to load or initialize your onboarding profile.");
    }
  };

  useEffect(() => {
    const initPage = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setUser(user);

        // Verify that the user is a Volunteer. Redirect Leads/Admins to dashboard home.
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        if (!userError && userData) {
          if (userData.role === "Center Lead" || userData.role === "Admin") {
            router.push("/");
            return;
          }
        }

        await fetchProfile(user.id);
      } catch (err) {
        console.error("Authentication check error:", err);
        setErrorMessage("An unexpected authentication error occurred.");
      } finally {
        setLoading(false);
      }
    };

    initPage();
  }, [router]);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    docKey: string,
    fileNamePrefix: string
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    const file = files[0];
    setUploadingDoc(docKey);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Create folder-path matching user.id to satisfy RLS policies
      const fileExt = file.name.split(".").pop() || "pdf";
      const storagePath = `${user.id}/${fileNamePrefix}.${fileExt}`;

      // Upload file to Supabase storage (private bucket: 'onboarding_documents')
      const { error: uploadError } = await supabase.storage
        .from("onboarding_documents")
        .upload(storagePath, file, {
          cacheControl: "3605",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Update URL column in volunteer_profiles
      const { error: updateError } = await supabase
        .from("volunteer_profiles")
        .update({
          [docKey]: storagePath,
        } as unknown as Database["public"]["Tables"]["volunteer_profiles"]["Update"])
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      setSuccessMessage(`${file.name} uploaded successfully!`);
      // Refresh profile data
      await fetchProfile(user.id);
    } catch (err) {
      console.error("Upload error:", err);
      const msg = err instanceof Error ? err.message : "Failed to upload document. Please try again.";
      setErrorMessage(msg);
    } finally {
      setUploadingDoc(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 px-5">
        <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-spin" />
        <span className="text-sm text-zinc-550 dark:text-zinc-400 mt-3 font-semibold">
          Loading onboarding status...
        </span>
      </div>
    );
  }

  // Onboarding status pipeline helper
  const stages = [
    { key: "Application", label: "Application", desc: "Submit paperwork" },
    { key: "Screening", label: "Screening", desc: "Verify documents" },
    { key: "Orientation", label: "Orientation", desc: "Attend training" },
    { key: "Active", label: "Active", desc: "Ready to volunteer!" },
  ];

  const currentStatus = profile?.status || "Application";
  const currentStageIndex = stages.findIndex((s) => s.key === currentStatus);

  return (
    <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in pb-20">
      {/* Title Header */}
      <header className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/30 uppercase tracking-wider">
            Phase 2
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-2">
          Volunteer Onboarding
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Complete these steps to activate your volunteer status at Pratham.
        </p>
      </header>

      {/* Progress Tracker (Tactile Timeline) */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-5">
          Your Onboarding Progress
        </h2>

        <div className="relative pl-8 space-y-6">
          {/* Vertical progress connector line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-zinc-200 dark:bg-zinc-800" />
          
          {/* Active portion of progress line */}
          <div 
            className="absolute left-[15px] top-2 w-0.5 bg-emerald-500 dark:bg-emerald-400 transition-all duration-500" 
            style={{ 
              height: `${(currentStageIndex / (stages.length - 1)) * 100}%`,
              maxHeight: "calc(100% - 16px)"
            }}
          />

          {stages.map((stage, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isActive = idx === currentStageIndex;

            return (
              <div key={stage.key} className="relative flex flex-col items-start gap-1">
                {/* Circle Indicator */}
                <div 
                  className={`absolute -left-[25px] w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 z-10 text-xs font-bold ${
                    isCompleted
                      ? "bg-emerald-500 border-emerald-500 text-white dark:bg-emerald-400 dark:border-emerald-400"
                      : isActive
                      ? "bg-white dark:bg-zinc-900 border-emerald-500 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/10 dark:ring-emerald-400/10"
                      : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-400"
                  }`}
                >
                  {isCompleted ? (
                    <span className="font-bold">✓</span>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <div className="pl-3">
                  <h3 
                    className={`text-sm font-bold transition-colors ${
                      isActive 
                        ? "text-zinc-900 dark:text-white" 
                        : isCompleted 
                        ? "text-zinc-700 dark:text-zinc-300" 
                        : "text-zinc-400"
                    }`}
                  >
                    {stage.label}
                  </h3>
                  <p 
                    className={`text-xs transition-colors ${
                      isActive 
                        ? "text-zinc-500 dark:text-zinc-400" 
                        : "text-zinc-400 dark:text-zinc-600"
                    }`}
                  >
                    {stage.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* RLS / Private Bucket Disclaimer */}
      <div className="bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200/50 dark:border-zinc-800/40 rounded-xl p-3.5 flex items-start gap-3">
        <Lock className="w-5 h-5 text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5 stroke-[2]" />
        <div className="flex flex-col gap-0.5">
          <h4 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Secure Encrypted Storage
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
            Your uploaded document files are protected by strict Row Level Security. Only you and your center lead can access them.
          </p>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-900/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-red-800 dark:text-red-400 leading-relaxed">
            {errorMessage}
          </p>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/40 dark:border-emerald-900/30 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400 leading-relaxed">
            {successMessage}
          </p>
        </div>
      )}

      {/* Document Upload Roster */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider px-1">
          Required Documents
        </h2>

        <div className="flex flex-col gap-4">
          {documentTypes.map((doc) => {
            const isUploaded = !!profile?.[doc.key as keyof VolunteerProfile];
            const isUploading = uploadingDoc === doc.key;
            
            return (
              <div 
                key={doc.key} 
                className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-3 transition-all duration-200 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-400">
                    <FileText className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <div className="flex flex-col flex-1">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      {doc.label}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-medium">
                      {doc.description}
                    </p>
                  </div>
                </div>

                {/* Upload Action Button / Input wrapper */}
                <div className="mt-2">
                  <input
                    type="file"
                    id={`file-input-${doc.key}`}
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, doc.key, doc.fileName)}
                    disabled={isUploading}
                  />

                  {isUploading ? (
                    <button 
                      disabled
                      className="w-full flex items-center justify-center gap-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-400 py-3 px-4 rounded-xl font-bold text-sm min-h-[48px]"
                    >
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Uploading document...</span>
                    </button>
                  ) : isUploaded ? (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2 bg-emerald-55 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 py-3 px-4 rounded-xl font-bold text-xs min-h-[48px]">
                        <CheckCircle className="w-4 h-4 stroke-[2.2]" />
                        <span className="truncate">Document Uploaded</span>
                      </div>
                      <label
                        htmlFor={`file-input-${doc.key}`}
                        className="flex items-center justify-center bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-350 active:scale-[0.97] py-3 px-4 rounded-xl font-bold text-xs min-h-[48px] cursor-pointer transition-all duration-150"
                      >
                        Change
                      </label>
                    </div>
                  ) : (
                    <label
                      htmlFor={`file-input-${doc.key}`}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200/30 dark:border-emerald-800/40 active:scale-[0.98] py-3 px-4 rounded-xl font-bold text-sm min-h-[48px] cursor-pointer transition-all duration-150 text-center"
                    >
                      <Upload className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Upload File</span>
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Orientation / Training Completion Status */}
      {profile && (
        <section className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-400">
              <ShieldCheck className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div className="flex flex-col flex-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Background Check Verification
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed font-medium">
                {profile.background_check_cleared 
                  ? "Your background check has been cleared by your Center Lead."
                  : "Pending verification. The Center Lead will clear this once document uploads are reviewed."}
              </p>
            </div>
          </div>

          <div className="mt-1">
            <div 
              className={`flex items-center gap-2 py-3 px-4 rounded-xl font-bold text-xs min-h-[48px] border ${
                profile.background_check_cleared
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-50 dark:bg-amber-950/10 border-amber-100/60 dark:border-amber-900/20 text-amber-700 dark:text-amber-400"
              }`}
            >
              {profile.background_check_cleared ? (
                <>
                  <CheckCircle className="w-4 h-4 stroke-[2.2]" />
                  <span>Background Check: CLEARED</span>
                </>
              ) : (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-550 shrink-0" />
                  <span>Background Check: PENDING</span>
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
