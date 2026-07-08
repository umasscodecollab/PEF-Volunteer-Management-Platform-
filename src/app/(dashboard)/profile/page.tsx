"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { User, Mail, Shield, Building, LogOut, ChevronRight } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUser(user);

        const { data: profileData, error: profileError } = await supabase
          .from("users")
          .select("*, centers(name, location)")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error(
            "Error fetching user profile:",
            profileError.message,
            profileError.details,
            profileError.code
          );
        } else {
          console.log("Fetched User Profile (profile):", profileData);
          setProfile(profileData);
        }
      } catch (err) {
        console.error("Unexpected error on profile mount:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndProfile();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      console.error("Error during sign out:", err);
    }
  };

  const getDisplayName = () => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.user_metadata?.name) return user.user_metadata.name;
    if (user?.email) {
      const prefix = user.email.split("@")[0];
      return prefix
        .split(".")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
    return "User";
  };

  const roleName = profile?.role || "Volunteer";
  const emailVal = user?.email || "";
  
  const centersData = profile?.centers;
  const centerName = Array.isArray(centersData)
    ? (centersData[0]?.name || "No Center Assigned")
    : (centersData?.name || "No Center Assigned");
  const centerLocation = Array.isArray(centersData)
    ? (centersData[0]?.location || "No Location Listed")
    : (centersData?.location || "No Location Listed");

  const sections = [
    {
      title: "Account Settings",
      items: [
        { label: "Personal Information", icon: User },
        { label: "Notification Preferences", icon: Shield },
      ],
    },
    {
      title: "Center Operations",
      items: [
        { label: `Center: ${centerName}`, icon: Building },
        { label: `Location: ${centerLocation}`, icon: Shield },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col gap-6 px-5 py-6 animate-pulse select-none">
        <header className="flex flex-col gap-2">
          <div className="h-7 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
        </header>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex flex-col gap-2 flex-1">
            <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            <div className="h-5 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            <div className="h-3.5 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {[1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-md ml-1" />
              <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm flex flex-col p-4 gap-4">
                <div className="h-5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-md" />
                <div className="h-5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const nameAbbreviation = getDisplayName()
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n.charAt(0))
    .join("");

  return (
    <div className="flex flex-col gap-6 px-5 py-6 select-none animate-fade-in">
      <header className="flex flex-col">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          My Profile
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Manage your account and preferences
        </p>
      </header>

      {/* User Header Profile Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4 relative overflow-hidden">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xl font-bold uppercase shadow-md shadow-emerald-500/10">
          {nameAbbreviation || "U"}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {roleName}
          </span>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white mt-0.5">
            {getDisplayName()}
          </h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            {emailVal}
          </span>
        </div>
      </div>

      {/* Settings list */}
      <div className="flex flex-col gap-5">
        {sections.map((sec, idx) => (
          <div key={idx} className="flex flex-col gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-450 dark:text-zinc-500 px-1">
              {sec.title}
            </h4>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              {sec.items.map((item, itemIdx) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={itemIdx}
                    className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-850 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors text-left w-full border-b border-zinc-100 dark:border-zinc-800/80 last:border-0"
                  >
                    <div className="flex items-center gap-3.5">
                      <ItemIcon className="w-5 h-5 text-zinc-450 dark:text-zinc-500" />
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-450" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Log out Action Button */}
      <button 
        onClick={handleSignOut}
        className="flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-950/40 text-rose-600 dark:text-rose-450 hover:bg-rose-50 dark:hover:bg-rose-950/20 active:scale-[0.98] py-4 rounded-2xl font-bold transition-all mt-4 w-full"
      >
        <LogOut className="w-5 h-5" />
        <span className="text-sm">Sign Out Account</span>
      </button>
    </div>
  );
}
