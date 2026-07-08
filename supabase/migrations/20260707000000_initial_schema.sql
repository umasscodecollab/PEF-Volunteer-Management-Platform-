-- Create Centers Table
CREATE TABLE public.centers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Users Table (Extends auth.users)
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Center Lead', 'Volunteer', 'Board Member')),
    assigned_center_id UUID REFERENCES public.centers(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Sessions Table
CREATE TABLE public.sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    center_id UUID REFERENCES public.centers(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Attendance Table
CREATE TABLE public.attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Sessions (Center Scoped)
CREATE POLICY "Center_Scoped_Visibility" ON public.sessions
FOR ALL
USING (
  (auth.jwt() ->> 'role') IN ('Admin', 'Board Member')
  OR 
  center_id = (auth.jwt() ->> 'assigned_center_id')::UUID
);

-- RLS Policy: Attendance (Center Scoped)
CREATE POLICY "Attendance_Center_Scoped" ON public.attendance
FOR ALL
USING (
  (auth.jwt() ->> 'role') IN ('Admin', 'Board Member')
  OR 
  (SELECT center_id FROM public.sessions WHERE id = session_id) = (auth.jwt() ->> 'assigned_center_id')::UUID
);