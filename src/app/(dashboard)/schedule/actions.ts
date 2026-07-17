

import { supabase } from "@/lib/supabase/client";

export async function createBatchAndSessions(data: {
  name: string;
  grade: string;
  subject: string;
  center_id: string;
  start_date: string;
  end_date: string;
  days_of_week: string[];
  start_time: string;
  end_time: string;
  capacity: number;
}) {
  try {
    const {
      name,
      grade,
      subject,
      center_id,
      start_date,
      end_date,
      days_of_week,
      start_time,
      end_time,
      capacity,
    } = data;

    const batch_id = crypto.randomUUID();

    // 1. Insert Batch metadata
    const { error: batchError } = await supabase
      .from("batches")
      .insert({
        id: batch_id,
        name,
        grade: grade || null,
        subject: subject || null,
        center_id,
        schedule_rrule: JSON.stringify(days_of_week),
        start_time,
        end_time,
      });

    if (batchError) {
      console.error("Batch insert error object:", batchError);
      return { success: false, error: batchError.message || "Failed to create batch" };
    }

    // 2. Generate session dates
    const start = new Date(start_date);
    const end = new Date(end_date);
    const sessions = [];

    // Map day names to Date.getDay() integers
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };

    const allowedDays = new Set(days_of_week.map((d) => dayMap[d]));

    // Loop through calendar days
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (allowedDays.has(d.getDay())) {
        const dateStr = d.toISOString().split("T")[0];
        const sessionStart = new Date(`${dateStr}T${start_time}`).toISOString();
        const sessionEnd = new Date(`${dateStr}T${end_time}`).toISOString();

        sessions.push({
          topic: name,
          start_time: sessionStart,
          end_time: sessionEnd,
          capacity,
          center_id,
          batch_id,
        });
      }
    }

    if (sessions.length === 0) {
      return { success: false, error: "No sessions fell on the selected days." };
    }

    // 3. Bulk insert sessions
    const { error: sessionsError } = await supabase.from("sessions").insert(sessions);

    if (sessionsError) {
      console.error("Sessions insert error:", sessionsError);
      return { success: false, error: sessionsError.message };
    }

    return { success: true, count: sessions.length };
  } catch (error: any) {
    console.error("Batch creation failed:", error);
    return { success: false, error: error.message || "Unknown error occurred" };
  }
}
