# Database Architecture & Data Models
This document outlines the core tables and relationships for the volunteer management platform. 

## 1. Users & Profiles
*   `users` (auth schema): Managed by Supabase Auth.
*   `volunteer_profiles`: Extends auth user with `assigned_center_id` and role-specific details.

## 2. Centers & Students
*   `centers`: Physical locations (e.g., "Test Mumbai Center 2").
*   `students`: Contains `id`, `name`, and `center_id`. 
    *   *Note: Students are NOT hardcoded to a specific volunteer. They belong to a center and are enrolled into sessions.*

## 3. Scheduling & Attendance (Unified Architecture)
*   `sessions`: Represents a class/shift. 
    *   **Fields:** `id`, `center_id`, `date`, `batch_id` (for recurring series).
    *   **Shift Request Logic:** A session with a `null` `facilitator_id` represents an open shift.
    *   **Urgency:** The `is_urgent` (boolean) flag allows Leads to broadcast vacancies.
*   `student_attendance`: The enrollment and attendance record for a session.
    *   **Fields:** `session_id`, `student_id`, `status` ('Present', 'Absent', 'Unmarked').

## 4. Assessment Tracking
*   `assessments`: Logs student performance for specific exams.
    *   `id`: UUID, Primary Key
    *   `student_id`: UUID (Foreign Key -> students)
    *   `session_id`: UUID (Foreign Key -> sessions, nullable)
    *   `exam_type`: TEXT (CHECK: 'Diagnostic', 'Monthly', 'Mid-Year', 'End-of-Year')
    *   `score_achieved`: NUMERIC (Nullable)
    *   `max_score`: NUMERIC
    *   `status`: TEXT (CHECK: 'Completed', 'Incomplete', 'Not Assessed') - Defaults to 'Completed'
    *   `date_administered`: DATE
    *   `recorded_by`: UUID (Foreign Key -> auth.users)
    *   `notes`: TEXT (Nullable)