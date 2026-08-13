"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

interface Center {
  id: string;
  name: string;
  location: string | null;
}

export default function VolunteerApplyPage() {
  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [preferredCenterId, setPreferredCenterId] = useState("");

  // Centers list state
  const [centers, setCenters] = useState<Center[]>([]);
  const [isFetchingCenters, setIsFetchingCenters] = useState(true);
  const [centersError, setCentersError] = useState("");

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Fetch active centers from public.centers on mount
  useEffect(() => {
    async function loadCenters() {
      setIsFetchingCenters(true);
      setCentersError("");
      try {
        const { data, error } = await supabase
          .from("centers")
          .select("id, name, location")
          .order("name");

        if (error) {
          console.error("Error fetching centers:", error);
          setCentersError("Could not load centers list. Please refresh the page.");
        } else if (data) {
          setCenters(data);
        }
      } catch (err) {
        console.error("Unexpected error loading centers:", err);
        setCentersError("Failed to connect. Please check your network.");
      } finally {
        setIsFetchingCenters(false);
      }
    }

    loadCenters();
  }, []);

  // Client-side validations
  const validateForm = (): boolean => {
    setValidationError("");
    setApiError("");

    if (!email.trim()) {
      setValidationError("Email address is required.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setValidationError("Please enter a valid email address (e.g., name@example.com).");
      return false;
    }

    if (!password) {
      setValidationError("Password is required.");
      return false;
    }

    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters long.");
      return false;
    }

    if (!firstName.trim()) {
      setValidationError("First Name is required.");
      return false;
    }

    if (!lastName.trim()) {
      setValidationError("Last Name is required.");
      return false;
    }

    if (!phone.trim()) {
      setValidationError("Phone Number is required.");
      return false;
    }

    if (!city.trim()) {
      setValidationError("City is required.");
      return false;
    }

    if (!preferredCenterId) {
      setValidationError("Please select your Preferred Center.");
      return false;
    }

    return true;
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setApiError("");

    try {
      const fullCombinedName = `${firstName.trim()} ${lastName.trim()}`;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: fullCombinedName,
            phone: phone.trim(),
            city: city.trim(),
            assigned_center_id: preferredCenterId,
            role: "Volunteer",
          },
        },
      });

      if (error) {
        console.error("Supabase Auth SignUp error object:", {
          name: error.name,
          message: error.message,
          status: error.status,
          raw: error,
        });

        let errorMsg = error.message;
        if (!errorMsg || errorMsg === "{}") {
          try {
            errorMsg = JSON.stringify(error, Object.getOwnPropertyNames(error));
          } catch (e) {
            errorMsg = String(error);
          }
        }

        setApiError(`Error: ${errorMsg}`);
      } else if (data?.user && data.user.identities && data.user.identities.length === 0) {
        // Supabase returns an empty identities array if the user email already exists
        setApiError("An account with this email address already exists. Please return to Login to sign in.");
      } else {
        setIsSubmitted(true);
      }
    } catch (err: any) {
      console.error("SignUp catch error:", err);
      const catchMsg = err?.message || err?.name || "A network error occurred.";
      setApiError(`Network/Submission Error: ${catchMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Success State UI
  if (isSubmitted) {
    return (
      <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xl rounded-3xl p-6 sm:p-8 text-center flex flex-col items-center gap-6 my-auto transition-all animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
          <CheckCircle2 className="w-10 h-10 stroke-[2]" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
            Application Received!
          </h2>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300 leading-relaxed max-w-sm">
            Your Volunteer ID has been generated. Our Center Leads will review your application shortly.
          </p>
        </div>

        <div className="w-full pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col items-center gap-3">
          <Link
            href="/login"
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          >
            <span>Return to Login</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 my-auto">
      {/* Brand Header */}
      <header className="flex flex-col items-center text-center">
        <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl mb-3 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center justify-center">
          <Image
            src="/logo.jpeg"
            alt="Pratyagra Education Foundation"
            width={52}
            height={52}
            className="w-13 h-13 object-contain rounded-xl"
            priority
          />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Pratyagra Education Foundation
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1">
          Volunteer Application
        </h1>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">
          Join our mission to empower students across India
        </p>
      </header>

      {/* Main Application Form Container */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xl rounded-3xl p-6 sm:p-7 relative overflow-hidden transition-all duration-200">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          
          {/* Validation & API Error Message Alert */}
          {(validationError || apiError || centersError) && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 rounded-xl text-xs font-medium text-red-800 dark:text-red-400 leading-relaxed"
            >
              {validationError || apiError || centersError}
            </div>
          )}

          {/* Email Address */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Email Address <span className="text-red-500">*</span>
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

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
                <Lock className="w-5 h-5 stroke-[1.8]" />
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full pl-11 pr-12 h-12 text-[15px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all"
                autoComplete="new-password"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors"
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

          {/* First Name & Last Name (2-column layout on sm screens, stacked on mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="firstName"
                className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
              >
                First Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
                  <User className="w-5 h-5 stroke-[1.8]" />
                </span>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full pl-11 pr-4 h-12 text-[15px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all"
                  autoComplete="given-name"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Last Name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="lastName"
                className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
              >
                Last Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
                  <User className="w-5 h-5 stroke-[1.8]" />
                </span>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full pl-11 pr-4 h-12 text-[15px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all"
                  autoComplete="family-name"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Phone Number & City (2-column layout on sm screens, stacked on mobile) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phone Number */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="phone"
                className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
              >
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
                  <Phone className="w-5 h-5 stroke-[1.8]" />
                </span>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-11 pr-4 h-12 text-[15px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all"
                  autoComplete="tel"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* City */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="city"
                className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
              >
                City <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">
                  <MapPin className="w-5 h-5 stroke-[1.8]" />
                </span>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                  className="w-full pl-11 pr-4 h-12 text-[15px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          {/* Preferred Center Select */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="preferredCenter"
              className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
            >
              Preferred Center <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none">
                <Building2 className="w-5 h-5 stroke-[1.8]" />
              </span>
              <select
                id="preferredCenter"
                value={preferredCenterId}
                onChange={(e) => setPreferredCenterId(e.target.value)}
                className="w-full pl-11 pr-8 h-12 text-[15px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-50 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                required
                disabled={isLoading || isFetchingCenters}
              >
                <option value="" disabled>
                  {isFetchingCenters ? "Loading available centers..." : "Select a center..."}
                </option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name} {center.location ? `(${center.location})` : ""}
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 dark:text-zinc-500">
                {isFetchingCenters ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="text-xs">▼</span>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isFetchingCenters}
            className="w-full h-12 mt-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:active:bg-emerald-700 text-white font-bold text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 shadow-md active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:ring-offset-2 dark:focus:ring-offset-zinc-950"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Submitting Application...</span>
              </>
            ) : (
              <span>Submit Application</span>
            )}
          </button>
        </form>

        {/* Secondary Back to Login Link */}
        <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Already applied or registered? Sign In</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
