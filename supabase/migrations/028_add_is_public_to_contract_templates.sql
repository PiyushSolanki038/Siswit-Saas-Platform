-- ============================================================================
-- Migration 028: Add is_public to contract_templates
-- ============================================================================

ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

UPDATE public.contract_templates
SET is_public = false
WHERE is_public IS NULL;

ALTER TABLE public.contract_templates
  ALTER COLUMN is_public SET NOT NULL;
