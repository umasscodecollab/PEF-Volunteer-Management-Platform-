const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
  try {
    console.log("Testing storage upload...");
    const dummyFile = Buffer.from("dummy content");
    const storagePath = "test_user_id/test_-_file.txt";

    const { data, error } = await supabase.storage
      .from("onboarding_documents")
      .upload(storagePath, dummyFile, {
        upsert: true,
      });

    if (error) {
      console.log("Upload error:", error);
      console.log("Upload error message:", error.message);
    } else {
      console.log("Upload successful:", data);
    }
  } catch (err) {
    console.error("Caught error:", err);
  }
}

testUpload();
