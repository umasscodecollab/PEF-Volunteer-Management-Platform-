"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Mail, Lock, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";

import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Check if session already exists
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsRedirecting(true);
        router.push("/");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsRedirecting(true);
        router.push("/");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  // Client-side validations
  const validateForm = (): boolean => {
    setValidationError("");
    setApiError("");

    if (!email.trim()) {
      setValidationError("Please enter your email address.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setValidationError("Please enter a valid email address (e.g. name@example.com).");
      return false;
    }

    if (!password) {
      setValidationError("Please enter your password.");
      return false;
    }

    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters long.");
      return false;
    }

    return true;
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setApiError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setApiError(error.message || "Invalid email or password. Please try again.");
      } else {
        // Successful login: subscription/mount effect will handle redirection, 
        // but let's also trigger it explicitly for responsiveness.
        setIsRedirecting(true);
        router.push("/");
      }
    } catch (err) {
      setApiError("A network error occurred. Please verify your internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isRedirecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 dark:text-emerald-400" />
        <p className="mt-4 text-sm font-medium text-zinc-600 dark:text-zinc-400 animate-pulse">
          Redirecting to dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-6 py-12 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-sm mx-auto flex flex-col gap-8">
        {/* Brand/Header */}
        <header className="flex flex-col items-center text-center">
          <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-2xl mb-3 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center">
            <Image
              src="/logo.jpeg"
              alt="Pratyagra Education Foundation"
              width={48}
              height={48}
              className="w-12 h-12 object-contain rounded-xl"
              priority
            />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Pratyagra Education Foundation
          </h1>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">
            Volunteer Management Portal
          </p>
        </header>

        {/* Login Form Container */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 shadow-md rounded-3xl p-6 relative overflow-hidden transition-all duration-200">
          <form onSubmit={handleLogin} className="flex flex-col gap-5.5" noValidate>
            
            {/* Error Message Box */}
            {(validationError || apiError) && (
              <div
                role="alert"
                aria-live="polite"
                className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 rounded-xl text-xs font-medium text-red-800 dark:text-red-400 leading-relaxed"
              >
                {validationError || apiError}
              </div>
            )}

            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
              >
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
                  <Mail className="w-5 h-5 stroke-[1.8]" />
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-11 pr-4 h-12 text-[15px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="password"
                  className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
                  <Lock className="w-5 h-5 stroke-[1.8]" />
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className="w-full pl-11 pr-12 h-12 text-[15px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all"
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
                  tabIndex={0}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 stroke-[1.8]" />
                  ) : (
                    <Eye className="w-5 h-5 stroke-[1.8]" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me / Assistive check - Large touch target */}
            <div className="flex items-center">
              <label className="flex items-center gap-3 py-2 cursor-pointer select-none group w-full">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500/40 bg-zinc-50 dark:bg-zinc-950 transition-all cursor-pointer"
                  disabled={isLoading}
                />
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors">
                  Keep me signed in
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:active:bg-emerald-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/apply"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
              >
                New volunteer? Apply here →
              </Link>
            </div>
          </form>
        </div>

        {/* Footer/Help Text */}
        <footer className="text-center">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-normal">
            Need help signing in? Contact your Center Lead or local administrator.
          </p>
        </footer>
      </div>
    </div>
  );
}
