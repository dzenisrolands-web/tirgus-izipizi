-- Migration 0023: Move super admin privilege to app_metadata
--
-- BEFORE running this SQL, run the companion API script to set
-- app_metadata.is_super_admin = true on all existing super admins.
-- This SQL then downgrades their profiles.role from 'super_admin' to 'buyer'.
--
-- The API script (run via Node or Supabase dashboard functions):
--
--   1. List all profiles with role = 'super_admin'
--   2. For each, call:
--        supabase.auth.admin.updateUserById(userId, {
--          app_metadata: { is_super_admin: true }
--        })
--   3. Then run this SQL to clean up profiles.role
--
-- After this migration, profiles.role only contains 'buyer' or 'seller'.
-- Super admin status is solely in auth.users.raw_app_meta_data.

-- Step 1: Downgrade super_admin profiles to 'buyer'
-- (If a super admin also has a sellers row, they keep 'seller' role)
UPDATE profiles
   SET role = CASE
     WHEN id IN (SELECT user_id FROM sellers WHERE user_id IS NOT NULL)
     THEN 'seller'
     ELSE 'buyer'
   END
 WHERE role = 'super_admin';
