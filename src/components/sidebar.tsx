"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, User, Users, CalendarOff, Briefcase, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string>("Volunteer");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setEmail(user.email || "");
        const { data: profileData } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profileData) setRole(profileData.role);
      } catch (err) {
        console.error("Error fetching nav details:", err);
      }
    };
    fetchRole();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navItems = [
    { label: "Home", href: "/", icon: LayoutDashboard },
    { label: "Schedule", href: "/schedule", icon: Calendar },
  ];

  if (role === "Center Lead" || role === "Admin") {
    navItems.push({ label: "Team", href: "/team", icon: Users });
  } else {
    navItems.push({ label: "Leave", href: "/leave", icon: CalendarOff });
  }

  navItems.push({ label: "Workspace", href: "/workspace", icon: Briefcase });
  navItems.push({ label: "Profile", href: "/profile", icon: User });

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 p-5 fixed top-0 left-0 transition-colors duration-200 z-40 select-none">
      {/* Header Branding */}
      <div className="flex items-center gap-3 px-2 py-4 mb-6">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 p-1 flex items-center justify-center shadow-sm flex-shrink-0">
          <Image
            src="/logo.jpeg"
            alt="Pratyagra Education Foundation Logo"
            width={36}
            height={36}
            className="w-full h-full object-contain rounded-lg"
            priority
          />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-extrabold text-xs tracking-wide text-zinc-900 dark:text-white leading-tight">
            Pratyagra Education Foundation
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest mt-0.5">
            {role}
          </span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 flex flex-col gap-1 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3.5 py-3 px-4 rounded-xl transition-all duration-150 relative min-h-[48px] font-semibold text-sm ${
                isActive
                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-200 ${
                  isActive ? "scale-105 stroke-[2.3]" : "stroke-[1.8]"
                }`}
              />
              <span>{item.label}</span>
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Profile/Sign Out Area */}
      {email && (
        <div className="border-t border-zinc-150 dark:border-zinc-800 pt-4 flex flex-col gap-2 px-1">
          <div className="flex flex-col px-3">
            <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
              {email.split("@")[0]}
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-500 truncate">
              {email}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3.5 py-2.5 px-4 rounded-xl text-zinc-650 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-150 font-semibold text-sm min-h-[48px] w-full text-left"
          >
            <LogOut className="w-5 h-5 stroke-[1.8]" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </aside>
  );
}
