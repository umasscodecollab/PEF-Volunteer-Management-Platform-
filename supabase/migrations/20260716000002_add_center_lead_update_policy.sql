-- Add RLS policy to allow Center Leads to update volunteers within their assigned center
-- and allow Admins to update any user.
CREATE POLICY "Allow Center Leads and Admins to update users" ON "public"."users"
FOR UPDATE TO "authenticated"
USING (
  -- Center Lead can update users assigned to the same center
  EXISTS (
    SELECT 1 FROM public.users AS lead
    WHERE lead.id = auth.uid()
    AND lead.role = 'Center Lead'
    AND lead.assigned_center_id = users.assigned_center_id
  )
  OR
  -- Admin can update any user
  EXISTS (
    SELECT 1 FROM public.users AS admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'Admin'
  )
)
WITH CHECK (
  -- Check logic is identical to using logic
  EXISTS (
    SELECT 1 FROM public.users AS lead
    WHERE lead.id = auth.uid()
    AND lead.role = 'Center Lead'
    AND lead.assigned_center_id = users.assigned_center_id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.users AS admin
    WHERE admin.id = auth.uid()
    AND admin.role = 'Admin'
  )
);
