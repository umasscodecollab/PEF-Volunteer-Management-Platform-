"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
// @ts-ignore
import { Html5Qrcode } from "html5-qrcode";
import { ChevronLeft, Camera, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function ScannerPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<"idle" | "scanning" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanner = async () => {
    setStatus("scanning");
    setMessage("Please point your camera at the Kiosk QR Code.");
    
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader");
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        onScanFailure
      );
      setScanning(true);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage("Camera access denied or unavailable. Please check your browser permissions.");
      setScanning(false);
    }
  };

  const onScanFailure = (error: any) => {
    // html5-qrcode calls this frequently when no QR is found. We can ignore it.
  };

  const onScanSuccess = async (decodedText: string) => {
    // Stop scanning immediately to prevent multiple triggers
    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop().catch(console.error);
    }
    setScanning(false);
    setStatus("processing");
    setMessage("Processing check-in...");

    try {
      let payload;
      try {
        payload = JSON.parse(decodedText);
      } catch {
        throw new Error("Invalid QR code format.");
      }

      if (!payload.sessionId || !payload.token) {
        throw new Error("Unrecognized QR code.");
      }

      // Verify the token with the session
      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("id, kiosk_token")
        .eq("id", payload.sessionId)
        .eq("kiosk_token", payload.token)
        .single();

      if (sessionError || !sessionData) {
        throw new Error("Invalid or expired session token.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in.");

      // Check for duplicate scan
      const { data: existingAttendance } = await supabase
        .from("attendance")
        .select("id")
        .eq("session_id", payload.sessionId)
        .eq("user_id", user.id)
        .eq("status", "Present")
        .maybeSingle();

      if (existingAttendance) {
        setStatus("success");
        setMessage("You are already checked in!");
        return;
      }

      // Insert attendance record
      const { error: insertError } = await supabase
        .from("attendance")
        .insert({
          session_id: payload.sessionId,
          user_id: user.id,
          status: "Present",
          check_in_time: new Date().toISOString()
        });

      if (insertError) {
        throw new Error("Failed to record attendance.");
      }

      setStatus("success");
      setMessage("Successfully checked in!");

    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setMessage(err.message || "An error occurred during check-in.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col px-5 py-6 select-none animate-fade-in relative pb-20">
      <header className="flex items-center justify-between mb-8">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors font-medium text-sm min-h-[48px]"
        >
          <ChevronLeft className="w-5 h-5" />
          Back Home
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full gap-8">
        
        {/* Status Area */}
        <div className="text-center flex flex-col items-center gap-3 w-full">
          {status === "idle" && (
            <>
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full flex items-center justify-center mb-2">
                <Camera className="w-10 h-10 stroke-[1.5]" />
              </div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Self Check-In</h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">
                Ready to check in? Make sure you have the Kiosk QR code visible on the Lead&apos;s device.
              </p>
            </>
          )}

          {status === "processing" && (
            <>
              <Loader2 className="w-16 h-16 text-emerald-500 animate-spin stroke-[2] mb-2" />
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Verifying...</h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-2 animate-bounce-short shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
              </div>
              <h1 className="text-3xl font-black text-zinc-900 dark:text-zinc-50">Done!</h1>
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">{message}</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-20 h-20 bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 rounded-full flex items-center justify-center mb-2">
                <AlertCircle className="w-10 h-10 stroke-[2]" />
              </div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Scan Failed</h1>
              <p className="text-rose-600 dark:text-rose-400 font-medium max-w-[280px]">{message}</p>
            </>
          )}
        </div>

        {/* Scanner Container */}
        <div 
          className={`w-full max-w-sm aspect-square bg-zinc-200 dark:bg-zinc-800 rounded-3xl overflow-hidden relative shadow-inner flex items-center justify-center transition-all duration-300 ${status === 'scanning' ? 'opacity-100 ring-4 ring-emerald-500/50' : 'opacity-0 h-0 hidden'}`}
        >
          <div id="reader" className="w-full h-full [&>video]:object-cover" />
        </div>

        {/* Action Buttons */}
        <div className="w-full mt-auto mb-4 flex flex-col gap-3">
          {(status === "idle" || status === "error") && (
            <button
              onClick={startScanner}
              disabled={false}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-emerald-600/20"
            >
              <Camera className="w-5 h-5" />
              {status === "error" ? "Try Again" : "Tap to Start Scanner"}
            </button>
          )}

          {(status === "success" || status === "error") && (
            <button
              onClick={() => router.push("/")}
              className="w-full bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 font-bold py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              Return Home
            </button>
          )}
        </div>

      </main>
    </div>
  );
}
