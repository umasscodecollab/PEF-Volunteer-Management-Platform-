"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
// @ts-ignore
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeft, CheckCircle2, User, Loader2, AlertCircle } from "lucide-react";

interface AttendanceRecord {
  id: string;
  user_id: string;
  check_in_time: string | null;
  checkout_time: string | null;
  users?: {
    email: string | null;
  };
}

export default function KioskPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const router = useRouter();
  const unwrappedParams = React.use(params);
  const { sessionId } = unwrappedParams;

  const [sessionData, setSessionData] = useState<{ topic: string; kiosk_token: string | null } | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let channel: any;

    const initKiosk = async () => {
      try {
        // 1. Fetch Session Info
        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("topic, kiosk_token")
          .eq("id", sessionId)
          .single();

        if (sessionError || !sessionData) {
          setError("Failed to load session details.");
          setLoading(false);
          return;
        }

        setSessionData(sessionData);

        // 2. Fetch Initial Attendance
        const { data: attendData, error: attendError } = await supabase
          .from("attendance")
          .select("id, user_id, check_in_time, checkout_time, users(email)")
          .eq("session_id", sessionId)
          .eq("status", "Present")
          .order("check_in_time", { ascending: false });

        if (!attendError && attendData) {
          setAttendance(attendData as unknown as AttendanceRecord[]);
        }

        // 3. Subscribe to Real-time Attendance
        const channelName = `attendance_kiosk_${sessionId}_${Math.random().toString(36).substring(2)}`;
        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "attendance",
              filter: `session_id=eq.${sessionId}`,
            },
            async (payload) => {
              if (payload.eventType === "INSERT" && payload.new.status === "Present") {
                // Fetch user info for the new record
                const { data: userData } = await supabase
                  .from("users")
                  .select("email")
                  .eq("id", payload.new.user_id)
                  .single();

                const newRecord: AttendanceRecord = {
                  id: payload.new.id,
                  user_id: payload.new.user_id,
                  check_in_time: payload.new.check_in_time,
                  checkout_time: payload.new.checkout_time,
                  users: userData ? { email: userData.email } : undefined,
                };

                setAttendance((prev) => [newRecord, ...prev]);
              } else if (payload.eventType === "UPDATE") {
                setAttendance((prev) => prev.map((record) => {
                  if (record.id === payload.new.id) {
                    return {
                      ...record,
                      checkout_time: payload.new.checkout_time,
                    };
                  }
                  return record;
                }));
              }
            }
          )
          .subscribe();
          
      } catch (err) {
        console.error(err);
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    initKiosk();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white gap-3">
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin stroke-[2]" />
        <span className="text-sm font-semibold text-zinc-400">Initializing Kiosk...</span>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-zinc-950 text-white gap-3 px-5">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <span className="text-sm font-semibold text-zinc-400 text-center">{error}</span>
        <button
          onClick={() => router.back()}
          className="mt-4 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm min-h-[48px]"
        >
          Go Back
        </button>
      </div>
    );
  }

  const qrPayload = JSON.stringify({
    sessionId: sessionId,
    token: sessionData.kiosk_token,
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col p-6 animate-fade-in relative">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />
      
      <header className="relative z-10 flex items-center justify-between mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors font-medium text-sm min-h-[48px]"
        >
          <ChevronLeft className="w-5 h-5" />
          Exit Kiosk
        </button>
        <div className="text-right">
          <h1 className="text-xl font-bold tracking-tight text-white">{sessionData.topic}</h1>
          <p className="text-sm text-emerald-400 font-medium tracking-widest uppercase mt-0.5">Self Check-In Kiosk</p>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col gap-12 max-w-4xl mx-auto w-full items-center justify-start pb-20">
        
        {/* Top Section: QR Code */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 lg:p-10 flex flex-col items-center justify-center shadow-2xl min-h-[60vh]">
          <h2 className="text-2xl lg:text-4xl font-black text-center mb-3 lg:mb-4">Scan to Check In</h2>
          <p className="text-zinc-400 text-center mb-6 lg:mb-10 max-w-sm text-sm lg:text-base">
            Open the scanner in your Volunteer Dashboard and point your camera here.
          </p>
          
          <div className="bg-white p-4 lg:p-6 rounded-3xl shadow-xl shadow-emerald-500/10 mb-4 transition-transform hover:scale-105 duration-300 w-full max-w-[280px] lg:max-w-[360px] mx-auto flex items-center justify-center aspect-square">
            <QRCodeSVG 
              value={qrPayload} 
              size={256}
              style={{ width: "100%", height: "100%" }}
              level="H"
              includeMargin={false}
              className="text-black"
            />
          </div>
        </div>

        {/* Bottom Section: Live Feed */}
        <div className="w-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold tracking-wider uppercase text-zinc-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
              Live Check-Ins
            </h3>
            <span className="bg-zinc-800 text-emerald-400 px-3 py-1 rounded-full text-sm font-bold border border-emerald-500/30">
              {attendance.length} Total
            </span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 flex-1 shadow-inner min-h-[300px]">
            {attendance.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-3">
                <User className="w-12 h-12 stroke-[1]" />
                <p>Waiting for first check-in...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {attendance.map((record) => (
                  <div 
                    key={record.id} 
                    className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800/50 rounded-2xl animate-fade-in-up"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${record.checkout_time ? "bg-zinc-800 text-zinc-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                        <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <div className="flex flex-col">
                        <span className={`font-bold text-lg ${record.checkout_time ? "text-zinc-400" : "text-white"}`}>
                          {record.users?.email?.split('@')[0] || 'Unknown User'}
                        </span>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <span className={record.checkout_time ? "text-zinc-500" : "text-emerald-500/70"}>
                            In: {record.check_in_time 
                              ? new Date(record.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                              : 'Just now'
                            }
                          </span>
                          {record.checkout_time && (
                            <span className="text-zinc-500">
                              Out: {new Date(record.checkout_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {record.checkout_time ? (
                      <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        Checked Out
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-emerald-950 border border-emerald-900/50 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        Checked In
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
