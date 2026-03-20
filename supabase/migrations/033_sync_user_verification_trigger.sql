-- Trigger that automatically synchronizes verification state from auth.users to organization_memberships.
-- This replaces the intermittent Edge Function calls from the frontend.

SET search_path = public, extensions;

CREATE OR REPLACE FUNCTION public.handle_user_verification_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if email was just confirmed
  IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) THEN
    -- Update all pending verification memberships for this user
    UPDATE public.organization_memberships
    SET 
      account_state = CASE 
        WHEN role = 'client' THEN 'pending_approval'::public.account_state
        ELSE 'active'::public.account_state
      END,
      is_email_verified = true,
      updated_at = NOW()
    WHERE user_id = NEW.id
      AND account_state = 'pending_verification';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop if exists to ensure clean idempotent rollout
DROP TRIGGER IF EXISTS trg_sync_user_verification ON auth.users;

-- Recreate trigger
CREATE TRIGGER trg_sync_user_verification
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_verification_sync();
