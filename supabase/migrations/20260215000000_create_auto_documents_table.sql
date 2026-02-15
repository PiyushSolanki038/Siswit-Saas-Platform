-- Create Auto Documents Table with Proper RLS

-- Create document type and status enums if they don't exist
DO $$ BEGIN
  CREATE TYPE public.document_type AS ENUM ('proposal', 'invoice', 'agreement', 'report', 'policy', 'manual', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.document_status AS ENUM ('draft', 'pending_review', 'approved', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.document_format AS ENUM ('pdf', 'docx', 'doc', 'xlsx', 'txt', 'html');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create auto_documents table
CREATE TABLE IF NOT EXISTS public.auto_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type document_type DEFAULT 'other',
  status document_status DEFAULT 'draft',
  content TEXT,
  template_id UUID,
  related_entity_type TEXT,
  related_entity_id TEXT,
  file_path TEXT,
  file_name TEXT,
  format document_format,
  file_size BIGINT,
  generated_from TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_auto_documents_owner_id ON public.auto_documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_auto_documents_created_by ON public.auto_documents(created_by);
CREATE INDEX IF NOT EXISTS idx_auto_documents_status ON public.auto_documents(status);
CREATE INDEX IF NOT EXISTS idx_auto_documents_created_at ON public.auto_documents(created_at);

-- Enable RLS
ALTER TABLE public.auto_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for auto_documents
-- Users can view their own documents
DROP POLICY IF EXISTS "Users can view their own auto_documents" ON public.auto_documents;
CREATE POLICY "Users can view their own auto_documents"
  ON public.auto_documents FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = created_by);

-- Users can create documents for themselves
DROP POLICY IF EXISTS "Users can create auto_documents" ON public.auto_documents;
CREATE POLICY "Users can create auto_documents"
  ON public.auto_documents FOR INSERT
  WITH CHECK (auth.uid() = owner_id AND auth.uid() = created_by);

-- Users can update their own documents
DROP POLICY IF EXISTS "Users can update their own auto_documents" ON public.auto_documents;
CREATE POLICY "Users can update their own auto_documents"
  ON public.auto_documents FOR UPDATE
  USING (auth.uid() = owner_id OR auth.uid() = created_by)
  WITH CHECK (auth.uid() = owner_id);

-- Users can delete their own documents
DROP POLICY IF EXISTS "Users can delete their own auto_documents" ON public.auto_documents;
CREATE POLICY "Users can delete their own auto_documents"
  ON public.auto_documents FOR DELETE
  USING (auth.uid() = owner_id);
