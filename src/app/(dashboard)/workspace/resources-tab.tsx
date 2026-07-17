"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { BookOpen, Plus, Search, Download, Trash2, AlertCircle, FileText, Upload, Filter } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface Resource {
  id: string;
  center_id: string | null;
  uploader_id: string;
  title: string;
  description: string;
  file_url: string;
  subject: string;
  grade_level: string;
  created_at: string;
}

export default function ResourcesTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("Volunteer");
  const [assignedCenterId, setAssignedCenterId] = useState<string | null>(null);
  
  const [resources, setResources] = useState<Resource[]>([]);
  
  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [gradeFilter, setGradeFilter] = useState("All");

  // Form State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchResources = async (centerId: string | null) => {
    try {
      let query = supabase
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });

      if (centerId) {
        query = query.or(`center_id.eq.${centerId},center_id.is.null`);
      } else {
        query = query.is("center_id", null);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      if (data) setResources(data as Resource[]);
    } catch (err) {
      console.error("Error fetching resources:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUser(user);

        const { data: profile } = await supabase
          .from("users")
          .select("role, assigned_center_id")
          .eq("id", user.id)
          .single();

        if (profile) {
          setRole(profile.role);
          setAssignedCenterId(profile.assigned_center_id);
          await fetchResources(profile.assigned_center_id);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !subject.trim() || !gradeLevel.trim() || !file) {
      setError("All fields and a file are required.");
      return;
    }
    if (!user) {
      setError("Missing user information.");
      return;
    }
    
    setSubmitting(true);
    setError("");

    try {
      // 1. Upload file to Storage
      const fileExt = file.name.split('.').pop();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${assignedCenterId || 'global'}/${Date.now()}_${sanitizedName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('center_resources')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('center_resources')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;

      // 3. Insert into database
      const { data: insertData, error: insertError } = await supabase
        .from("resources")
        .insert({
          title,
          description,
          subject,
          grade_level: gradeLevel,
          file_url: fileUrl,
          uploader_id: user.id,
          center_id: assignedCenterId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (insertData) {
        setResources([insertData as Resource, ...resources]);
        // Reset form
        setTitle("");
        setDescription("");
        setSubject("");
        setGradeLevel("");
        setFile(null);
        setIsUploadOpen(false);
        // reset file input visually if needed, though state is cleared
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload resource.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (resource: Resource) => {
    if (!confirm(`Are you sure you want to delete "${resource.title}"?`)) return;

    try {
      // 1. Extract path from public URL if possible
      // Public URL format: https://[project].supabase.co/storage/v1/object/public/center_resources/[path]
      const urlParts = resource.file_url.split('/center_resources/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        // 2. Delete from storage
        const { error: storageError } = await supabase.storage
          .from('center_resources')
          .remove([filePath]);
          
        if (storageError) {
           console.error("Storage deletion error (continuing to db delete):", storageError);
        }
      }

      // 3. Delete from database
      const { error: dbError } = await supabase
        .from("resources")
        .delete()
        .eq("id", resource.id);

      if (dbError) throw dbError;

      // Update state
      setResources(resources.filter(r => r.id !== resource.id));
    } catch (err: any) {
      alert("Failed to delete resource: " + err.message);
    }
  };

  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      const matchesSearch = 
        resource.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        resource.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSubject = subjectFilter === "All" || resource.subject === subjectFilter;
      const matchesGrade = gradeFilter === "All" || resource.grade_level === gradeFilter;

      return matchesSearch && matchesSubject && matchesGrade;
    });
  }, [resources, searchQuery, subjectFilter, gradeFilter]);

  // Extract unique subjects and grades for filters
  const uniqueSubjects = useMemo(() => {
    const subs = new Set(resources.map(r => r.subject));
    return Array.from(subs).sort();
  }, [resources]);

  const uniqueGrades = useMemo(() => {
    const grades = new Set(resources.map(r => r.grade_level));
    return Array.from(grades).sort();
  }, [resources]);

  const canManage = role === "Center Lead" || role === "Admin";

  if (loading) {
    return (
      <div className="flex flex-col gap-6 px-5 py-6 animate-pulse pb-24">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="bg-white dark:bg-zinc-900 rounded-2xl h-16 border border-zinc-150 dark:border-zinc-800" />
        <div className="bg-white dark:bg-zinc-900 rounded-2xl h-48 border border-zinc-150 dark:border-zinc-800" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 select-none animate-fade-in w-full">

      {canManage && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <button 
            onClick={() => setIsUploadOpen(!isUploadOpen)}
            className="w-full p-5 flex items-center justify-between text-left focus:outline-none focus:bg-zinc-50 dark:focus:bg-zinc-800/50 min-h-[48px]"
          >
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Upload Resource
            </h2>
            <Plus className={`w-5 h-5 text-zinc-500 transition-transform ${isUploadOpen ? 'rotate-45' : ''}`} />
          </button>
          
          {isUploadOpen && (
            <div className="p-5 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30">
              {error && (
                <div className="mb-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleUpload} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Grade 5 Math Worksheet"
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Math"
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">
                      Grade Level
                    </label>
                    <input
                      type="text"
                      value={gradeLevel}
                      onChange={(e) => setGradeLevel(e.target.value)}
                      placeholder="e.g. Primary"
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the material..."
                    rows={2}
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-zinc-900 dark:text-zinc-100 resize-none min-h-[48px]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">
                    File Attachment
                  </label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] text-zinc-900 dark:text-zinc-100 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-950/50 dark:file:text-indigo-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3.5 rounded-xl min-h-[48px] transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 shadow-sm shadow-indigo-600/20"
                >
                  {submitting ? "Uploading..." : "Upload Resource"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-zinc-400" />
          </div>
          <input
            type="text"
            placeholder="Search materials..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] text-zinc-900 dark:text-zinc-100 shadow-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] text-zinc-900 dark:text-zinc-100 shadow-sm"
            >
              <option value="All">All Subjects</option>
              {uniqueSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-zinc-400" />
            </div>
          </div>
          
          <div className="relative">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] text-zinc-900 dark:text-zinc-100 shadow-sm"
            >
              <option value="All">All Grades</option>
              {uniqueGrades.map(grade => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-zinc-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Resource List */}
      <div className="flex flex-col gap-4 mt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">
          Available Resources
        </h3>
        
        {filteredResources.length === 0 ? (
          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">
              No resources found
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResources.map((resource) => (
              <div 
                key={resource.id} 
                className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4 relative overflow-hidden group justify-between"
              >
                <div>
                  <h4 className="font-bold text-zinc-900 dark:text-white leading-tight text-base mb-1.5 pr-8">
                    {resource.title}
                  </h4>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 tracking-wide">
                      {resource.subject}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-100 dark:border-amber-800/30 tracking-wide">
                      {resource.grade_level}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-650 dark:text-zinc-300 leading-relaxed">
                    {resource.description}
                  </p>
                </div>
                
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
                  <a
                    href={resource.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 font-semibold text-sm py-2.5 rounded-xl transition-colors min-h-[44px]"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                  
                  {canManage && (
                    <button
                      onClick={() => handleDelete(resource)}
                      className="flex-shrink-0 flex items-center justify-center bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 p-2.5 rounded-xl transition-colors min-h-[44px] min-w-[44px]"
                      aria-label="Delete resource"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
