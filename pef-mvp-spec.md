IGNORE THIS, THIS DOCUMENT IS OUTDATED

# PEF Volunteer Management Platform - Phase 1 MVP

## 1. Project Context & Constraints
* **Target Audience:** Non-technical users on older Android devices with low-bandwidth connections.
* **Architecture:** Mobile-first, Next.js PWA (Progressive Web App). Must be highly accessible (14-16px text, minimum 48px touch targets).
* **Backend:** Live Supabase (PostgreSQL) Cloud Instance.
* **Security:** Strict Role-Based Access Control (RBAC). Data MUST be scoped by `center_id` using Postgres Row Level Security (RLS). Client-side filtering is strictly prohibited.

## 2. Tech Stack
* **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS.
* **PWA Plugin:** `@ducanh2912/next-pwa` (Must use `--webpack` flag in dev scripts).
* **Icons & Components:** `lucide-react`, standard functional Tailwind components (no heavy UI libraries).
* **Backend/Auth:** `@supabase/supabase-js`. Connected via `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

## 3. Core Data Model (PostgreSQL)
* **Auth:** `auth.users` (System table managed by Supabase)
* **Users:** `public.users` (id, email, role, assigned_center_id)
* **Centers:** `public.centers` (id, name, location)
* **Sessions:** `public.sessions` (id, center_id, topic, start_time, end_time, capacity)
* **Attendance:** `public.attendance` (id, session_id, user_id, status, check_in_time)
* **[PHASE 2] Profiles:** `public.volunteer_profiles` (user_id, status, id_document_url, nda_document_url, consent_form_url, background_check_cleared)
* **[PHASE 2] Rosters:** `public.session_enrollments` (id, session_id, user_id, status [Enum: Pending, Approved, Denied])
* **[PHASE 2] Storage:** `onboarding_documents` (Private bucket. Users can only access their own UUID-named folders).
* **[PHASE 2] Leave:** `public.leave_requests` (id, user_id, center_id, start_date, end_date, reason, status [Enum: Pending, Approved, Denied])
* **[PHASE 3] Comms:** `public.announcements` (id, center_id, author_id, title, content, target_role, created_at)
* **[PHASE 3] Materials:** `public.resources` (id, center_id, uploader_id, title, description, file_url, subject, grade_level, created_at)
* **[PHASE 3] Storage:** `center_resources` (Public bucket for curriculum. Leads can upload/delete; Volunteers can read).


## 4. AI Agent Directives (CRITICAL)
* **NO HARDCODED MOCK DATA:** All user states must be derived dynamically from `supabase.auth.getUser()` and joined with `public.users`. Never hardcode names, emails, or center IDs in the UI components.
* **RLS Reliance:** Data fetching must rely entirely on database-level RLS policies. Do not pass `center_id` filters in the Supabase client queries unless strictly needed for joins.
* **Styling:** NEVER write raw CSS; use Tailwind utility classes exclusively. Build for mobile first.
* **Performance:** Do NOT use heavy client-side rendering unless necessary. Keep dependencies to an absolute minimum to protect bundle size.
* **Stability:** Suppress hydration warnings on the `<body>` tag to prevent browser extension crashes.