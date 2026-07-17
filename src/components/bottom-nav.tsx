"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, User, Users, CalendarOff, Briefcase } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function BottomNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string>("Volunteer");
  // We no longer need onboardingStatus for the bottom nav since Onboarding is moved to the dashboard page
  
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profileData } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profileData) {
          setRole(profileData.role);
        }
      } catch (err) {
        console.error("Error fetching nav details:", err);
      }
    };

    fetchRole();
  }, []);

  const navItems = [
    {
      label: "Home",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      label: "Schedule",
      href: "/schedule",
      icon: Calendar,
    },
  ];

  if (role === "Center Lead" || role === "Admin") {
    navItems.push(
      {
        label: "Team",
        href: "/team",
        icon: Users,
      }
    );
  } else {
    // Volunteer
    navItems.push(
      {
        label: "Leave",
        href: "/leave",
        icon: CalendarOff,
      }
    );
  }

  navItems.push({
    label: "Workspace",
    href: "/workspace",
    icon: Briefcase,
  });

  navItems.push({
    label: "Profile",
    href: "/profile",
    icon: User,
  });

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.4)] z-50 transition-colors duration-200 md:hidden">
      <div className="flex items-center justify-around h-20 px-2 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-center select-none active:scale-95 transition-all duration-150 relative ${
                isActive
                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <div className="relative flex items-center justify-center p-1 rounded-xl transition-all duration-150">
                <Icon className={`w-6 h-6 transition-transform duration-200 ${isActive ? "scale-110 stroke-[2.5]" : "stroke-[1.8]"}`} />
              </div>
              <span className="text-[11px] mt-1 tracking-wide transition-all duration-200">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-200" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
