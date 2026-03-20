-- Migration to create contact_inquiries table for the public contact form

CREATE TABLE IF NOT EXISTS public.contact_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    interest TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', -- e.g., 'new', 'contacted', 'resolved'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit a contact inquiry (Public Insert)
CREATE POLICY contact_inquiries_insert_policy ON public.contact_inquiries
    FOR INSERT 
    WITH CHECK (true);

-- Only allow authenticated admins to view/manage inquiries (Service Role handles this usually, but let's be safe)
CREATE POLICY contact_inquiries_select_admin_policy ON public.contact_inquiries
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.organization_memberships
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    ));

-- Grant access to public for inserts
GRANT INSERT ON public.contact_inquiries TO anon, authenticated;
