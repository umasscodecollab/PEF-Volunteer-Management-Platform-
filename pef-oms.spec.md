# PEF Operations Management System (OMS) Specification

## 1. Project Context & Constraints
* **Purpose:** A simple, mobile-first system for PEF to manage volunteers, attendance, and assessments.
* **Architecture:** Mobile-first, Next.js PWA (Progressive Web App). Must be highly accessible.
* **Backend:** Live Supabase (PostgreSQL) Cloud Instance.
* **Security:** Strict Role-Based Access Control (RBAC). Data MUST be scoped by `center_id` using Postgres Row Level Security (RLS). Client-side filtering as a security measure is strictly prohibited.

## 2. Roles & Access (Least Privilege)
* **Org Admin / Board Director:** Org-wide read-only access and export capabilities.
* **Center Lead:** Manages volunteers, schedules, attendance, and approvals for a specific center.
* **Volunteer:** Teaches sessions, logs student attendance, tracks student assessments, and requests shifts/leaves.

## 3. Core Data Model (Supabase PostgreSQL)
* **users (auth):** Managed by Supabase Auth.
* **volunteer_profiles:** `id` (matches auth.uid), `role`, `assigned_center_id`, `status`.
* **centers:** `id`, `name`, `location`.
* **students:** `id`, `name`, `center_id` (Students belong to a center, NOT a specific volunteer).
* **sessions:** `id`, `batch_id` (for recurring), `center_id`, `date`, `start_time`, `end_time`, `facilitator_id` (NULL means open shift), `is_urgent` (boolean flag for vacancies).
* **student_attendance:** `session_id`, `student_id`, `status` ('Present', 'Absent', 'Unmarked').
* **assessments:** `id`, `student_id`, `session_id`, `exam_type` ('Diagnostic', 'Monthly', 'Mid-Year', 'End-of-Year'), `score_achieved` (numeric, nullable), `max_score` (numeric), `status` ('Completed', 'Incomplete', 'Not Assessed'), `date_administered`, `recorded_by`, `notes`.
* **leave_requests:** `id`, `user_id`, `center_id`, `start_date`, `end_date`, `status` ('Pending', 'Approved', 'Denied').

## 4. Key Workflows & Architecture Pivots
* **Scheduling (Unified Architecture):** "Sessions" and "Shift Requests" are the same entity. An open shift is a session where `facilitator_id` is null. Leads can broadcast vacancies (`is_urgent`). Volunteers "Request" sessions, which Leads must then "Approve".
* **Attendance (Manual Grids):** The old QR system is DEPRECATED. Center Leads log volunteer attendance via a grid. Volunteers log student attendance via a grid on the Session Details page. Users can add new students to a session/batch dynamically.
* **Assessments (Dual-Entry):** Volunteers can log bulk assessments during a session (via a sheet/modal) or log ad-hoc assessments directly on a Student's Profile page.

## 5. AI Agent Directives (CRITICAL)
* **NO HARDCODED MOCK DATA:** All user states must be derived dynamically from `supabase.auth.getUser()`. Never hardcode names, emails, or center IDs in the UI components.
* **RLS Reliance:** Data fetching must rely entirely on database-level RLS policies. Do not pass `center_id` filters in the Supabase client queries unless strictly needed for joins or dropdowns.
* **Styling:** NEVER write raw CSS; use Tailwind utility classes exclusively. Build for mobile-first.
* **Notifications:** Use modern `sonner` toasts for success/error states. DO NOT use native browser `alert()` dialogs.
* **Optimistic UI:** Ensure grids, toggles, and request buttons update local state optimistically before awaiting the database response.