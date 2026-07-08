import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are not set. " +
    "Please define them in your .env.local file. Falling back to development defaults."
  );
}

// Fallback values prevent static build-time failures if variables aren't injected during build/export
export const supabase = createClient<Database>(
  supabaseUrl || "http://127.0.0.1:54321",
  supabaseAnonKey || "placeholder_anon_key"
);
