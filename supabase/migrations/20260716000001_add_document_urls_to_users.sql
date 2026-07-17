-- Add missing document URL columns and background check status to the users table
ALTER TABLE "public"."users" 
  ADD COLUMN IF NOT EXISTS "id_document_url" text,
  ADD COLUMN IF NOT EXISTS "nda_document_url" text,
  ADD COLUMN IF NOT EXISTS "consent_form_url" text,
  ADD COLUMN IF NOT EXISTS "background_check_cleared" boolean DEFAULT false;
