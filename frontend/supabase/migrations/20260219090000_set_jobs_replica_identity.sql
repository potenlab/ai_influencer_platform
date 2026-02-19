-- Required for Supabase Realtime with RLS to deliver UPDATE payloads
-- that include user_id (so the subscription filter works correctly).
ALTER TABLE jobs REPLICA IDENTITY FULL;
