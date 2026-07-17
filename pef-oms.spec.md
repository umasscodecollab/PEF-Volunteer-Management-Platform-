# PEF Operations Management System (OMS) Specification

## 1. Purpose & Vision
A simple, mobile-first, and low-data system for PEF to manage volunteers and sessions. It must reduce manual coordination time, improve attendance reliability, and provide audit-ready reports[cite: 1].

## 2. Roles & Access (Least Privilege)
* **Org Admin:** Full control across all centers[cite: 1].
* **Board Director:** Org-wide read-only access and export capabilities[cite: 1].
* **Center Lead:** Manages volunteers, schedules, and approvals for a specific center[cite: 1].
* **Volunteer:** Checks in, logs sessions, asks for leave, and views schedules[cite: 1].
* **Trainer/Content Lead:** Curates and uploads lesson resources[cite: 1].

## 3. Core Data Model (Supabase PostgreSQL)
* **users:** `id`, `role`, `email`, `volunteer_code`, `phone`, `city`, `languages`, `skills`, `availability`, `status`, `id_verification_status`, `consent_accepted`, `assigned_center_id`, `center_scope`[cite: 1].
* **centers:** `id`, `name`, `location`, `timezone`[cite: 1].
* **batches:** `id`, `center_id`, `name`, `grade`, `subject`, `schedule_rrule`, `start_time`, `end_time`[cite: 1].
* **sessions:** `id`, `batch_id`, `date`, `start_time`, `end_time`, `facilitator_id`, `backup_id`, `status`, `notes`[cite: 1].
* **attendance:** `id`, `session_id`, `volunteer_id`, `checkin_time`, `checkout_time`, `method`, `geo_location`[cite: 1].
* **leaves:** `id`, `volunteer_id`, `start_date`, `end_date`, `reason`, `status`, `approver_id`[cite: 1].
* **resources:** `id`, `title`, `tags`, `file_url`, `version`, `center_scope`[cite: 1].
* **announcements:** `id`, `audience_filter`, `channels`, `template_id`, `sent_at`[cite: 1].
* **audit_logs:** `id`, `actor_id`, `action`, `entity`, `entity_id`, `before_state`, `after_state`, `timestamp`[cite: 1].

## 4. Key Workflows
* **Onboarding:** Application -> Screening -> Orientation -> Active[cite: 1].
* **Scheduling:** Leads create recurring batches; volunteers claim slots[cite: 1].
* **Attendance:** QR check-in/out with post-session logs[cite: 1].
* **Leave:** Single/multi-day requests with auto-backfill suggestions[cite: 1].

## 5. Non-Functional Requirements
* **Usability:** Mobile-first responsive UI, transitioning to desktop calendar views[cite: 1].
* **Compliance:** DPDP Act (India) aligned[cite: 1].