-- Allow SELECT for all users to support client-side admin view
-- This is necessary because we are using a client-side admin panel without a dedicated admin auth role in Supabase.
-- In a real production environment with sensitive data, we would use a Service Role or a specific Admin Role.

CREATE POLICY "Enable read access for all users" ON "public"."orders"
AS PERMISSIVE FOR SELECT
TO public
USING (true);
