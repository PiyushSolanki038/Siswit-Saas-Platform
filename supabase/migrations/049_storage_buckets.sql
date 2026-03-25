-- ==========================================================
-- Supabase Storage Setup for SISWIT File Uploads
-- Run this in Supabase SQL Editor
-- ==========================================================

-- 1. Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,  -- 50MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-scans',
  'contract-scans',
  false,
  52428800,  -- 50MB
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================================
-- 2. RLS Policies for 'documents' bucket
-- ==========================================================

-- SELECT: org members can read their own org's files
CREATE POLICY "documents_select_org_members" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- INSERT: owner/admin/manager can upload
CREATE POLICY "documents_insert_managers" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

-- DELETE: owner/admin can delete
CREATE POLICY "documents_delete_admins" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- ==========================================================
-- 3. RLS Policies for 'contract-scans' bucket
-- ==========================================================

-- SELECT: org members can read their own org's files
CREATE POLICY "contract_scans_select_org_members" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'contract-scans'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- INSERT: owner/admin/manager can upload
CREATE POLICY "contract_scans_insert_managers" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'contract-scans'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'manager')
    )
  );

-- DELETE: owner/admin can delete
CREATE POLICY "contract_scans_delete_admins" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'contract-scans'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );
