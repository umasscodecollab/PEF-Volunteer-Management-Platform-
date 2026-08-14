"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/database.types";
import {
  GraduationCap,
  Search,
  ChevronRight,
  ChevronLeft,
  Building,
  Loader2,
  Users,
  X,
  AlertCircle
} from "lucide-react";

type Student = Database["public"]["Tables"]["students"]["Row"] & {
  centers?: {
    id: string;
    name: string;
    location: string | null;
  } | null;
};

export default function StudentDirectoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [centerName, setCenterName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const fetchStudentsDirectory = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        // 1. Get authenticated user & profile for center scoping
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) {
          router.push("/login");
          return;
        }

        const { data: userProfile, error: profileErr } = await supabase
          .from("users")
          .select("role, assigned_center_id, centers(name, location)")
          .eq("id", authUser.id)
          .maybeSingle();

        if (profileErr) {
          console.error("Error fetching user profile:", profileErr);
        }

        const role = userProfile?.role || "Volunteer";
        const assignedCenterId = userProfile?.assigned_center_id;

        const centerData = userProfile?.centers as any;
        const cName = Array.isArray(centerData)
          ? centerData[0]?.name
          : centerData?.name;
        if (cName) setCenterName(cName);

        // 2. Query public.students
        let studentsQuery = supabase
          .from("students")
          .select(`
            id,
            name,
            center_id,
            created_at,
            centers (
              id,
              name,
              location
            )
          `)
          .order("name", { ascending: true });

        // If not Admin / Board Director, scope to assigned center
        if (
          role !== "Admin" &&
          role !== "Board Director" &&
          role !== "Board of Directors"
        ) {
          if (assignedCenterId) {
            studentsQuery = studentsQuery.eq("center_id", assignedCenterId);
          }
        }

        const { data: studentsData, error: studentsErr } = await studentsQuery;

        if (studentsErr) {
          throw studentsErr;
        }

        setStudents((studentsData as unknown as Student[]) || []);
      } catch (err: any) {
        console.error("Error fetching student directory:", err);
        setErrorMessage(
          err.message || "Failed to load student directory. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchStudentsDirectory();
  }, [router]);

  // Client-side search filtering
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, searchQuery]);

  // Get initial letters for avatar placeholder
  const getInitials = (name: string) => {
    if (!name) return "ST";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[65vh] gap-3 select-none">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin stroke-[2]" />
        <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Loading Student Directory...
        </span>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {errorMessage}
        </h2>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-8 flex flex-col gap-6 w-full">
      {/* Top Header & Navigation */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer min-h-[40px]"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          {centerName && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
              <Building className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{centerName}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5 tracking-tight">
              <GraduationCap className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              <span>Student Directory</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              View student profiles, historical attendance logs, and record assessments.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 self-start sm:self-center px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300">
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              {students.length} Student{students.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Search Input Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search students by name..."
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl pl-11 pr-10 py-3.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs transition-all min-h-[48px]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Student List */}
      <div className="flex flex-col gap-3">
        {filteredStudents.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-10 shadow-sm text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                {searchQuery ? "No matching students found" : "No students registered"}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                {searchQuery
                  ? `No students matched "${searchQuery}". Try searching with a different name.`
                  : "There are currently no students assigned to your center."}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline underline-offset-4"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          filteredStudents.map((student) => {
            const studentCenter = Array.isArray(student.centers)
              ? student.centers[0]?.name
              : student.centers?.name;

            return (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className="group bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Avatar Placeholder */}
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-extrabold text-sm sm:text-base flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-600/20 group-hover:scale-105 transition-transform duration-200">
                    {getInitials(student.name)}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                      {student.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      {studentCenter && (
                        <span className="flex items-center gap-1 truncate">
                          <Building className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                          <span className="truncate">{studentCenter}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="hidden sm:inline-block text-xs font-bold text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    View Profile
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 group-hover:border-emerald-300 dark:group-hover:border-emerald-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-all">
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
