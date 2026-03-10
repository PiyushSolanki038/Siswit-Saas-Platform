-- ============================================================================
-- Migration 027: Add missing CLM/Documents columns used by frontend payloads
-- ============================================================================

-- -----------------------------
-- CLM: contract_templates
-- -----------------------------
ALTER TABLE public.contract_templates
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

UPDATE public.contract_templates
SET is_active = CASE
  WHEN lower(coalesce(status, 'active')) IN ('inactive', 'disabled', 'archived') THEN false
  ELSE true
END
WHERE is_active IS NULL;

-- -----------------------------
-- CLM: contracts
-- -----------------------------
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS opportunity_id uuid,
  ADD COLUMN IF NOT EXISTS contact_id uuid;

DO $$
BEGIN
  ALTER TABLE public.contracts
    ADD CONSTRAINT contracts_opportunity_id_fkey
    FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  ALTER TABLE public.contracts
    ADD CONSTRAINT contracts_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- -----------------------------
-- CLM: contract_scans
-- -----------------------------
ALTER TABLE public.contract_scans
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS ocr_text text,
  ADD COLUMN IF NOT EXISTS scan_date timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.contract_scans
SET file_path = file_url
WHERE file_path IS NULL
  AND file_url IS NOT NULL;

UPDATE public.contract_scans
SET ocr_text = extracted_text
WHERE ocr_text IS NULL
  AND extracted_text IS NOT NULL;

UPDATE public.contract_scans
SET scan_date = created_at
WHERE scan_date IS NULL
  AND created_at IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.contract_scans
    ADD CONSTRAINT contract_scans_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- -----------------------------
-- Documents: document_templates
-- -----------------------------
ALTER TABLE public.document_templates
  ADD COLUMN IF NOT EXISTS variables jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- -----------------------------
-- Documents: auto_documents
-- -----------------------------
ALTER TABLE public.auto_documents
  ADD COLUMN IF NOT EXISTS related_entity_type text,
  ADD COLUMN IF NOT EXISTS related_entity_id uuid,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS generated_from text DEFAULT 'template';

UPDATE public.auto_documents
SET generated_from = 'template'
WHERE generated_from IS NULL;

-- -----------------------------
-- Documents: document_esignatures
-- -----------------------------
ALTER TABLE public.document_esignatures
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.document_esignatures
SET sent_at = created_at
WHERE sent_at IS NULL
  AND created_at IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.document_esignatures
    ADD CONSTRAINT document_esignatures_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- -----------------------------
-- Documents: document_versions
-- -----------------------------
ALTER TABLE public.document_versions
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS file_size bigint;

-- -----------------------------
-- Documents: document_permissions
-- -----------------------------
ALTER TABLE public.document_permissions
  ADD COLUMN IF NOT EXISTS shared_by uuid;

DO $$
BEGIN
  ALTER TABLE public.document_permissions
    ADD CONSTRAINT document_permissions_shared_by_fkey
    FOREIGN KEY (shared_by) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
