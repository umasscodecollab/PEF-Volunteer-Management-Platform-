"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Megaphone, Plus, AlertCircle } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface Announcement {
  id: string;
  title: string;
  content: string;
  target_role: string;
  created_at: string;
  author: {
    id: string;
    email: string;
  };
}

export default function AnnouncementsTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("Volunteer");
  const [assignedCenterId, setAssignedCenterId] = useState<string | null>(null);
  
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  
  // Form State
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetRole, setTargetRole] = useState("All");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUserAndAnnouncements = async () => {
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
          
          let query = supabase
            .from("announcements")
            .select(`
              id,
              title,
              content,
              target_role,
              created_at,
              author:users(id, email)
            `)
            .order("created_at", { ascending: false });
            
          // If Volunteer, only fetch All or Volunteer
          if (profile.role === "Volunteer") {
             query = query.in("target_role", ["All", "Volunteer"]);
          }

          // In a real app, RLS would restrict by center_id. We fetch it all.
          const { data, error } = await query;
          
          if (error) {
            console.error("Error fetching announcements:", error);
          } else if (data) {
            setAnnouncements(data as any);
          }
        }
      } catch (err) {
        console.error("Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndAnnouncements();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }
    if (!assignedCenterId || !user) {
      setError("Missing user or center information.");
      return;
    }
    
    setSubmitting(true);
    setError("");

    try {
      const { data, error: submitError } = await supabase
        .from("announcements")
        .insert({
          title,
          content,
          target_role: targetRole,
          author_id: user.id,
          center_id: assignedCenterId,
        })
        .select(`
          id,
          title,
          content,
          target_role,
          created_at,
          author:users(id, email)
        `)
        .single();

      if (submitError) throw submitError;

      if (data) {
        setAnnouncements([data as any, ...announcements]);
        setTitle("");
        setContent("");
        setTargetRole("All");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create announcement.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 px-5 py-6 animate-pulse pb-24">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
        <div className="bg-white dark:bg-zinc-900 rounded-2xl h-32 border border-zinc-150 dark:border-zinc-800" />
        <div className="bg-white dark:bg-zinc-900 rounded-2xl h-32 border border-zinc-150 dark:border-zinc-800" />
      </div>
    );
  }

  const canCreate = role === "Center Lead" || role === "Admin";

  return (
    <div className="flex flex-col gap-6 select-none animate-fade-in w-full">

      {canCreate && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Create Announcement
          </h2>
          
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement Title"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">
                Target Audience
              </label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[48px] text-zinc-900 dark:text-zinc-100 appearance-none"
              >
                <option value="All">All Roles</option>
                <option value="Volunteer">Volunteers Only</option>
                <option value="Center Lead">Center Leads Only</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 ml-1">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your announcement here..."
                rows={4}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-zinc-900 dark:text-zinc-100 resize-none min-h-[96px]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3.5 rounded-xl min-h-[48px] transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 shadow-sm shadow-indigo-600/20"
            >
              {submitting ? "Publishing..." : "Publish Announcement"}
            </button>
          </form>
        </div>
      )}

      <div className="flex flex-col gap-4 mt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ml-1">
          Recent Feed
        </h3>
        
        {announcements.length === 0 ? (
          <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center flex flex-col items-center gap-2">
            <Megaphone className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2">
              No announcements yet
            </p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div 
              key={announcement.id} 
              className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden"
            >
              <div className="flex justify-between items-start gap-4">
                <h4 className="font-bold text-zinc-900 dark:text-white leading-tight text-base">
                  {announcement.title}
                </h4>
                <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30 tracking-wide uppercase">
                  {announcement.target_role}
                </span>
              </div>
              
              <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {announcement.content}
              </p>
              
              <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-zinc-400 dark:text-zinc-500 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <span className="truncate max-w-[150px]">
                  {announcement.author?.email || "Unknown Author"}
                </span>
                <span>{formatDate(announcement.created_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
