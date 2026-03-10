-- ============================================================================
-- Migration 026: Enforce non-null organization/tenant scope on child tables
-- ============================================================================

-- contract_esignatures <- contracts
UPDATE public.contract_esignatures ce
SET
  organization_id = c.organization_id,
  tenant_id = COALESCE(c.tenant_id, c.organization_id)
FROM public.contracts c
WHERE ce.contract_id = c.id
  AND (ce.organization_id IS NULL OR ce.tenant_id IS NULL);

UPDATE public.contract_esignatures
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.contract_esignatures
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- contract_scans <- contracts
UPDATE public.contract_scans cs
SET
  organization_id = c.organization_id,
  tenant_id = COALESCE(c.tenant_id, c.organization_id)
FROM public.contracts c
WHERE cs.contract_id = c.id
  AND (cs.organization_id IS NULL OR cs.tenant_id IS NULL);

UPDATE public.contract_scans
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.contract_scans
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- contract_versions <- contracts
UPDATE public.contract_versions cv
SET
  organization_id = c.organization_id,
  tenant_id = COALESCE(c.tenant_id, c.organization_id)
FROM public.contracts c
WHERE cv.contract_id = c.id
  AND (cv.organization_id IS NULL OR cv.tenant_id IS NULL);

UPDATE public.contract_versions
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.contract_versions
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- document_esignatures <- auto_documents
UPDATE public.document_esignatures de
SET
  organization_id = d.organization_id,
  tenant_id = COALESCE(d.tenant_id, d.organization_id)
FROM public.auto_documents d
WHERE de.document_id = d.id
  AND (de.organization_id IS NULL OR de.tenant_id IS NULL);

UPDATE public.document_esignatures
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.document_esignatures
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- document_versions <- auto_documents
UPDATE public.document_versions dv
SET
  organization_id = d.organization_id,
  tenant_id = COALESCE(d.tenant_id, d.organization_id)
FROM public.auto_documents d
WHERE dv.document_id = d.id
  AND (dv.organization_id IS NULL OR dv.tenant_id IS NULL);

UPDATE public.document_versions
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.document_versions
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- document_permissions <- auto_documents
UPDATE public.document_permissions dp
SET
  organization_id = d.organization_id,
  tenant_id = COALESCE(d.tenant_id, d.organization_id)
FROM public.auto_documents d
WHERE dp.document_id = d.id
  AND (dp.organization_id IS NULL OR dp.tenant_id IS NULL);

UPDATE public.document_permissions
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.document_permissions
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- quote_line_items <- quotes
UPDATE public.quote_line_items qli
SET
  organization_id = q.organization_id,
  tenant_id = COALESCE(q.tenant_id, q.organization_id)
FROM public.quotes q
WHERE qli.quote_id = q.id
  AND (qli.organization_id IS NULL OR qli.tenant_id IS NULL);

UPDATE public.quote_line_items
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.quote_line_items
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- purchase_order_items <- purchase_orders
UPDATE public.purchase_order_items poi
SET
  organization_id = po.organization_id,
  tenant_id = COALESCE(po.tenant_id, po.organization_id)
FROM public.purchase_orders po
WHERE poi.purchase_order_id = po.id
  AND (poi.organization_id IS NULL OR poi.tenant_id IS NULL);

UPDATE public.purchase_order_items
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.purchase_order_items
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;

-- production_order_items <- production_orders
UPDATE public.production_order_items poi
SET
  organization_id = po.organization_id,
  tenant_id = COALESCE(po.tenant_id, po.organization_id)
FROM public.production_orders po
WHERE poi.production_order_id = po.id
  AND (poi.organization_id IS NULL OR poi.tenant_id IS NULL);

UPDATE public.production_order_items
SET tenant_id = organization_id
WHERE tenant_id IS NULL
  AND organization_id IS NOT NULL;

ALTER TABLE public.production_order_items
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN tenant_id SET NOT NULL;
