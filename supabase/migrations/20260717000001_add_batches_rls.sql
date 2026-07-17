-- Enable RLS for batches table
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Center_Scoped_Visibility_Batches" ON public.batches;

-- Create policy for batches mirroring sessions
CREATE POLICY "Center_Scoped_Visibility_Batches" ON public.batches
FOR ALL
USING (
  (auth.jwt() ->> 'role') IN ('Admin', 'Board Member')
  OR 
  center_id = (auth.jwt() ->> 'assigned_center_id')::UUID
);
