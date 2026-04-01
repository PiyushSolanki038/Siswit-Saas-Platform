-- ============================================================
-- SISWITINFRA UNIFIED PLATFORM - PRODUCTION DATABASE SCHEMA
-- ============================================================
-- Multi-Tenant SaaS Platform with CLM, CRM, CPQ, ERP, Documents
-- Drop all tables and recreate fresh
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CORE PLATFORM TABLES (SaaS Owner)
-- ============================================================

-- Drop existing tables in correct order
DROP TABLE IF EXISTS platform_admins CASCADE;
DROP TABLE IF EXISTS tenant_invitations CASCADE;
DROP TABLE IF EXISTS tenant_users CASCADE;
DROP TABLE IF EXISTS tenant_subscriptions CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Platform Admins (SaaS owner staff who manage the platform)
CREATE TABLE platform_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,  -- References auth.users(id)
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT NOT NULL DEFAULT 'platform_admin' CHECK (role = 'platform_admin'),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenants (Customer Organizations - B2B Customers)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'suspended', 'cancelled', 'trial')),
    plan_type TEXT NOT NULL DEFAULT 'foundation' CHECK (plan_type IN ('foundation', 'growth', 'commercial', 'enterprise')),
    
    -- Company details
    company_name TEXT,
    company_email TEXT,
    company_phone TEXT,
    company_address TEXT,
    company_city TEXT,
    company_state TEXT,
    company_country TEXT,
    company_zip TEXT,
    company_website TEXT,
    company_tax_id TEXT,
    
    -- Branding (white-label)
    logo_url TEXT,
    favicon_url TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    
    -- Subscription limits
    subscription_start_date DATE,
    subscription_end_date DATE,
    max_users INTEGER DEFAULT 5,
    max_storage_mb INTEGER DEFAULT 1000,
    max_contacts INTEGER DEFAULT 1000,
    max_contracts INTEGER DEFAULT 100,
    
    -- Settings
    timezone TEXT DEFAULT 'UTC',
    date_format TEXT DEFAULT 'YYYY-MM-DD',
    currency TEXT DEFAULT 'USD',
    language TEXT DEFAULT 'en',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Subscriptions (Which modules are enabled)
CREATE TABLE tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Module toggles (what the tenant paid for)
    module_crm BOOLEAN DEFAULT true,
    module_clm BOOLEAN DEFAULT false,
    module_cpq BOOLEAN DEFAULT true,
    module_erp BOOLEAN DEFAULT false,
    module_documents BOOLEAN DEFAULT true,
    
    -- Plan details
    plan_type TEXT NOT NULL DEFAULT 'foundation',
    status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled', 'past_due')),
    
    -- Billing
    billing_email TEXT,
    billing_contact_name TEXT,
    billing_address TEXT,
    payment_method TEXT,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    
    -- Limits from plan
    max_users INTEGER DEFAULT 5,
    max_storage_mb INTEGER DEFAULT 1000,
    max_contacts INTEGER DEFAULT 1000,
    max_contracts INTEGER DEFAULT 100,
    
    -- Features (JSONB for additional features)
    features JSONB DEFAULT '{}',
    
    -- Trial
    trial_start_date DATE,
    trial_end_date DATE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- Tenant Users (Links auth.users to tenants with roles)
CREATE TABLE tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,  -- References auth.users(id)
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'client')),
    department TEXT,
    job_title TEXT,
    phone TEXT,
    avatar_url TEXT,
    
    -- Access control
    is_active BOOLEAN DEFAULT true,
    is_approved BOOLEAN DEFAULT false,  -- Needs admin approval
    email_verified BOOLEAN DEFAULT false,
    
    -- Permissions
    can_create_users BOOLEAN DEFAULT false,
    can_manage_billing BOOLEAN DEFAULT false,
    can_export_data BOOLEAN DEFAULT false,
    
    -- Activity tracking
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, user_id)
);

-- Tenant Invitations (Invite users to join tenant)
CREATE TABLE tenant_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    department TEXT,
    invited_by_user_id UUID NOT NULL,
    invitation_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    message TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CRM MODULE TABLES
-- ============================================================

-- Drop CRM tables
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS opportunities CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- Accounts (Companies/Organizations)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Basic info
    name TEXT NOT NULL,
    domain TEXT,
    industry TEXT,
    website TEXT,
    phone TEXT,
    
    -- Address
    billing_address TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_country TEXT,
    billing_zip TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_country TEXT,
    shipping_zip TEXT,
    
    -- Business info
    annual_revenue DECIMAL(15,2),
    number_of_employees INTEGER,
    ownership TEXT,
    ticker_symbol TEXT,
    
    -- System
    owner_id UUID,
    account_manager_id UUID,
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts (People)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Basic info
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    mobile_phone TEXT,
    job_title TEXT,
    department TEXT,
    
    -- Account link
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    
    -- Address
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    zip TEXT,
    
    -- Social
    linkedin_url TEXT,
    twitter_handle TEXT,
    
    -- System
    owner_id UUID,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads (Potential customers)
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Basic info
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    title TEXT,
    website TEXT,
    
    -- Lead info
    lead_source TEXT,
    lead_status TEXT DEFAULT 'new' CHECK (lead_status IN ('new', 'contacted', 'qualified', 'unqualified', 'converted', 'recycled')),
    rating TEXT DEFAULT 'none' CHECK (rating IN ('hot', 'warm', 'cold', 'none')),
    
    -- Conversion tracking
    converted_to_contact_id UUID,
    converted_to_account_id UUID,
    converted_to_opportunity_id UUID,
    converted_at TIMESTAMPTZ,
    
    -- System
    owner_id UUID,
    assigned_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opportunities (Sales Pipeline)
CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Basic info
    name TEXT NOT NULL,
    
    -- Relationships
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Deal info
    amount DECIMAL(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    probability INTEGER DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
    expected_revenue DECIMAL(15,2),
    
    -- Stage
    stage TEXT DEFAULT 'prospecting' CHECK (stage IN (
        'prospecting', 'qualification', 'needs_analysis', 'value_proposition',
        'decision_makers', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
    )),
    stage_changed_at TIMESTAMPTZ,
    
    -- Dates
    close_date DATE,
    next_step TEXT,
    
    -- Type
    type TEXT DEFAULT 'new_business' CHECK (type IN ('new_business', 'existing_business', 'renewal', 'expansion')),
    lead_source TEXT,
    
    -- System
    owner_id UUID,
    is_closed BOOLEAN DEFAULT false,
    is_won BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities (Tasks, Calls, Meetings, Emails)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Basic info
    subject TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'task', 'note', 'deadline')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'in_progress')),
    
    -- Due dates
    due_date TIMESTAMPTZ,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    completed_at TIMESTAMPTZ,
    
    -- Related records
    related_to_type TEXT CHECK (related_to_type IN ('account', 'contact', 'lead', 'opportunity', 'contract', 'quote', 'task')),
    related_to_id UUID,
    
    -- Participants
    attendees JSONB DEFAULT '[]',
    assigned_to_id UUID,
    
    -- System
    owner_id UUID,
    is_all_day BOOLEAN DEFAULT false,
    is_private BOOLEAN DEFAULT false,
    
    -- Reminders
    reminder_minutes_before INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CPQ MODULE TABLES
-- ============================================================

-- Drop CPQ tables
DROP TABLE IF EXISTS quote_line_items CASCADE;
DROP TABLE IF EXISTS quotes CASCADE;
DROP TABLE IF EXISTS price_book_entries CASCADE;
DROP TABLE IF EXISTS price_books CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;

-- Product Categories
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    parent_category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    family TEXT,
    
    -- Pricing
    list_price DECIMAL(15,2),
    cost_price DECIMAL(15,2),
    margin_percent DECIMAL(5,2),
    currency TEXT DEFAULT 'USD',
    
    -- Inventory
    is_stockable BOOLEAN DEFAULT true,
    quantity_on_hand INTEGER DEFAULT 0,
    quantity_available INTEGER DEFAULT 0,
    quantity_reserved INTEGER DEFAULT 0,
    reorder_point INTEGER DEFAULT 0,
    
    -- Attributes
    weight DECIMAL(10,2),
    dimensions TEXT,
    color TEXT,
    size TEXT,
    
    -- System
    is_active BOOLEAN DEFAULT true,
    can_be_sold BOOLEAN DEFAULT true,
    can_be_purchased BOOLEAN DEFAULT true,
    product_image_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price Books
CREATE TABLE price_books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    currency TEXT DEFAULT 'USD',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price Book Entries (Product prices per price book)
CREATE TABLE price_book_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    price_book_id UUID NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    list_price DECIMAL(15,2),
    unit_price DECIMAL(15,2),
    discount_percent DECIMAL(5,2),
    discount_amount DECIMAL(15,2),
    currency TEXT DEFAULT 'USD',
    
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(price_book_id, product_id)
);

-- Quotes
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Quote info
    quote_number TEXT NOT NULL,
    name TEXT,
    version INTEGER DEFAULT 1,
    
    -- Relationships
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    price_book_id UUID REFERENCES price_books(id) ON DELETE SET NULL,
    
    -- Customer
    customer_email TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_review', 'pending_approval', 'approved', 
        'sent', 'viewed', 'accepted', 'declined', 'ordered', 'canceled'
    )),
    
    -- Dates
    quote_date DATE,
    expiration_date DATE,
    accepted_date DATE,
    
    -- Pricing
    currency TEXT DEFAULT 'USD',
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_percent DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Terms
    payment_terms TEXT,
    shipping_terms TEXT,
    notes TEXT,
    
    -- Approval
    approval_status TEXT DEFAULT 'not_submitted',
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    
    -- System
    owner_id UUID,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quote Line Items
CREATE TABLE quote_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    -- Product info (snapshot)
    product_name TEXT,
    product_sku TEXT,
    description TEXT,
    
    -- Quantities
    quantity INTEGER DEFAULT 1,
    quantity_shipped INTEGER DEFAULT 0,
    
    -- Pricing
    unit_price DECIMAL(15,2),
    list_price DECIMAL(15,2),
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_price DECIMAL(15,2),
    
    -- Date
    ship_date DATE,
    
    line_number INTEGER,
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLM MODULE TABLES
-- ============================================================

-- Drop CLM tables
DROP TABLE IF EXISTS contract_versions CASCADE;
DROP TABLE IF EXISTS contract_esignatures CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS contract_templates CASCADE;

-- Contract Templates
CREATE TABLE contract_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    type TEXT,
    description TEXT,
    category TEXT,
    content TEXT,  -- HTML/Markdown content with variables
    
    -- Variables/Placeholders
    variables JSONB DEFAULT '[]',
    
    -- System
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,  -- Can be used by clients
    
    -- Versioning
    version INTEGER DEFAULT 1,
    
    -- Folder
    folder TEXT,
    
    -- Signature settings
    require_signatures BOOLEAN DEFAULT true,
    signature_type TEXT DEFAULT 'electronic',
    
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Contract info
    contract_number TEXT NOT NULL,
    name TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    
    -- Relationships
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    template_id UUID REFERENCES contract_templates(id) ON DELETE SET NULL,
    
    -- Customer (for client contracts)
    customer_email TEXT,
    customer_name TEXT,
    customer_company TEXT,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_review', 'pending_approval', 'pending_signature',
        'active', 'expired', 'cancelled', 'terminated'
    )),
    
    -- Dates
    contract_date DATE,
    start_date DATE,
    end_date DATE,
    signed_date DATE,
    renewal_date DATE,
    auto_renew BOOLEAN DEFAULT false,
    
    -- Value
    value DECIMAL(15,2),
    currency TEXT DEFAULT 'USD',
    
    -- Terms
    payment_terms TEXT,
    termination_clause TEXT,
    notice_period_days INTEGER,
    
    -- Document
    document_url TEXT,
    content TEXT,
    
    -- System
    owner_id UUID,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract Versions
CREATE TABLE contract_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    version_number INTEGER NOT NULL,
    content TEXT,
    change_summary TEXT,
    changed_by UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- E-Signatures
CREATE TABLE contract_esignatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    -- Signer
    signer_name TEXT NOT NULL,
    signer_email TEXT NOT NULL,
    signer_role TEXT,
    signer_company TEXT,
    
    -- Signature
    signature_data TEXT,  -- Base64 or signature URL
    ip_address TEXT,
    user_agent TEXT,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'viewed', 'signed', 'declined', 'expired'
    )),
    
    -- Timestamps
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    signed_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ERP MODULE TABLES
-- ============================================================

-- Drop ERP tables
DROP TABLE IF EXISTS financial_records CASCADE;
DROP TABLE IF EXISTS production_order_items CASCADE;
DROP TABLE IF EXISTS production_orders CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    code TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    
    -- Address
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    zip TEXT,
    
    -- Contact
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    
    -- Business
    payment_terms TEXT,
    tax_id TEXT,
    currency TEXT DEFAULT 'USD',
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    
    -- System
    is_active BOOLEAN DEFAULT true,
    is_preferred BOOLEAN DEFAULT false,
    
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Items
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Warehouse
    warehouse_location TEXT,
    bin_location TEXT,
    
    -- Quantities
    quantity_on_hand INTEGER DEFAULT 0,
    quantity_available INTEGER DEFAULT 0,
    quantity_reserved INTEGER DEFAULT 0,
    quantity_on_order INTEGER DEFAULT 0,
    
    -- Reorder
    reorder_point INTEGER DEFAULT 0,
    reorder_quantity INTEGER DEFAULT 0,
    reorder_maximum INTEGER DEFAULT 0,
    
    -- Costs
    average_cost DECIMAL(15,2),
    last_cost DECIMAL(15,2),
    
    -- Last count
    last_counted_at TIMESTAMPTZ,
    last_receipt_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Transactions
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'receipt', 'issue', 'adjustment', 'transfer', 'return', 'damaged', 'theft'
    )),
    
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    warehouse_from TEXT,
    warehouse_to TEXT,
    
    quantity INTEGER NOT NULL,
    quantity_before INTEGER,
    quantity_after INTEGER,
    
    reference_type TEXT,
    reference_id UUID,
    
    notes TEXT,
    created_by UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Orders
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    po_number TEXT NOT NULL,
    
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name TEXT,
    supplier_address TEXT,
    
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'submitted', 'approved', 'sent', 'acknowledged',
        'partial', 'received', 'cancelled', 'closed'
    )),
    
    order_date DATE,
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Pricing
    currency TEXT DEFAULT 'USD',
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    shipping_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) DEFAULT 0,
    
    -- Terms
    payment_terms TEXT,
    shipping_terms TEXT,
    notes TEXT,
    
    -- System
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase Order Items
CREATE TABLE purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    product_name TEXT,
    sku TEXT,
    description TEXT,
    
    quantity_ordered INTEGER DEFAULT 0,
    quantity_received INTEGER DEFAULT 0,
    quantity_invoiced INTEGER DEFAULT 0,
    
    unit_price DECIMAL(15,2),
    total_price DECIMAL(15,2),
    
    expected_date DATE,
    received_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Production Orders
CREATE TABLE production_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    order_number TEXT NOT NULL,
    
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT,
    
    quantity_to_produce INTEGER DEFAULT 0,
    quantity_produced INTEGER DEFAULT 0,
    quantity_scrapped INTEGER DEFAULT 0,
    
    status TEXT DEFAULT 'planned' CHECK (status IN (
        'planned', 'in_progress', 'on_hold', 'completed', 'cancelled'
    )),
    
    start_date DATE,
    end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    
    bill_of_materials_id UUID,
    
    notes TEXT,
    created_by UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Production Order Items (Materials needed)
CREATE TABLE production_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    production_order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    product_name TEXT,
    sku TEXT,
    
    quantity_required INTEGER DEFAULT 0,
    quantity_used INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Records
CREATE TABLE financial_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Record type
    record_type TEXT NOT NULL CHECK (record_type IN (
        'invoice', 'payment', 'expense', 'refund', 'credit_note', 'debit_note'
    )),
    
    -- Reference
    reference_number TEXT,
    invoice_number TEXT,
    
    -- Amount
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    exchange_rate DECIMAL(10,4) DEFAULT 1,
    amount_usd DECIMAL(15,2),
    
    -- Dates
    record_date DATE,
    due_date DATE,
    paid_date DATE,
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'paid', 'overdue', 'cancelled', 'refunded'
    )),
    
    -- Relationships
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    
    -- Category
    category TEXT,
    subcategory TEXT,
    
    -- Description
    description TEXT,
    notes TEXT,
    
    -- Payment
    payment_method TEXT,
    payment_reference TEXT,
    
    -- System
    created_by UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS MODULE TABLES
-- ============================================================

-- Drop Documents tables
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS document_signatures CASCADE;
DROP TABLE IF EXISTS auto_documents CASCADE;
DROP TABLE IF EXISTS document_templates CASCADE;

-- Document Templates
CREATE TABLE document_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('proposal', 'invoice', 'contract', 'report', 'letter', 'agreement', 'custom')),
    category TEXT,
    description TEXT,
    content TEXT,
    
    variables JSONB DEFAULT '[]',
    
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT false,
    
    folder TEXT,
    
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto Documents (Generated documents)
CREATE TABLE auto_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    type TEXT,
    
    -- Template
    template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
    template_name TEXT,
    
    -- Content
    content TEXT,
    html_content TEXT,
    pdf_url TEXT,
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'generating', 'generated', 'sent', 'viewed', 'signed', 'archived'
    )),
    
    -- Source
    generated_from_type TEXT,
    generated_from_id UUID,
    
    -- Recipients
    recipients JSONB DEFAULT '[]',
    
    -- Metadata
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Versions
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES auto_documents(id) ON DELETE CASCADE,
    
    version_number INTEGER NOT NULL,
    content TEXT,
    pdf_url TEXT,
    file_size INTEGER,
    
    change_summary TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Signatures
CREATE TABLE document_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES auto_documents(id) ON DELETE CASCADE,
    
    signer_name TEXT NOT NULL,
    signer_email TEXT NOT NULL,
    signer_role TEXT,
    
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'viewed', 'signed', 'declined', 'expired'
    )),
    
    signature_data TEXT,
    signature_url TEXT,
    ip_address TEXT,
    
    signed_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_book_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_line_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_esignatures ENABLE ROW LEVEL SECURITY;

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
-- ==================

-- Platform Admins can see all tenants
CREATE POLICY "platform_admins_see_all_tenants" ON tenants
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
    );

-- Platform Admins can see all subscriptions
CREATE POLICY "platform_admins_see_all_subscriptions" ON tenant_subscriptions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
    );

-- Platform Admins can see all users
CREATE POLICY "platform_admins_see_all_users" ON tenant_users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
    );

-- Tenant users can see their tenant data
CREATE POLICY "tenant_users_see_own_tenant" ON tenants
    FOR SELECT USING (
        id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

-- Tenant users can see their subscription
CREATE POLICY "tenant_users_see_own_subscription" ON tenant_subscriptions
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

-- Tenant users can see their tenant's users (if active)
CREATE POLICY "tenant_users_see_tenant_users" ON tenant_users
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

-- For business data tables - users can see their tenant's data
CREATE POLICY "tenant_data_access" ON accounts
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON contacts
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON leads
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON opportunities
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON activities
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON products
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON quotes
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON contracts
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON suppliers
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON financial_records
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON product_categories
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON price_books
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON inventory_items
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON inventory_transactions
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON purchase_orders
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON production_orders
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON document_templates
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON auto_documents
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON contract_templates
    FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY "tenant_data_access" ON price_book_entries
    FOR ALL USING (
        price_book_id IN (SELECT id FROM price_books WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true))
    );

CREATE POLICY "tenant_data_access" ON quote_line_items
    FOR ALL USING (
        quote_id IN (SELECT id FROM quotes WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true))
    );

CREATE POLICY "tenant_data_access" ON contract_versions
    FOR ALL USING (
        contract_id IN (SELECT id FROM contracts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true))
    );

CREATE POLICY "tenant_data_access" ON contract_esignatures
    FOR ALL USING (
        contract_id IN (SELECT id FROM contracts WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true))
    );

CREATE POLICY "tenant_data_access" ON purchase_order_items
    FOR ALL USING (
        purchase_order_id IN (SELECT id FROM purchase_orders WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true))
    );

CREATE POLICY "tenant_data_access" ON production_order_items
    FOR ALL USING (
        production_order_id IN (SELECT id FROM production_orders WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true))
    );

CREATE POLICY "tenant_data_access" ON document_versions
    FOR ALL USING (
        document_id IN (SELECT id FROM auto_documents WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true))
    );

CREATE POLICY "tenant_data_access" ON document_signatures
    FOR ALL USING (
        document_id IN (SELECT id FROM auto_documents WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true))
    );

-- Client Portal Access (read-only for their own data)
-- ==================

-- Clients can see their quotes
CREATE POLICY "clients_see_own_quotes" ON quotes
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND role = 'client' AND is_active = true)
        AND customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Clients can see their contracts
CREATE POLICY "clients_see_own_contracts" ON contracts
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND role = 'client' AND is_active = true)
        AND customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert a sample tenant (replace UUIDs as needed)
-- INSERT INTO tenants (id, name, slug, company_name, plan_type, status)
-- VALUES (
--     '00000000-0000-0000-0000-000000000001',
--     'Demo Company',
--     'demo-company',
--     'Demo Company Inc.',
--     'enterprise',
--     'active'
-- );

-- Insert subscription for demo tenant
-- INSERT INTO tenant_subscriptions (
--     tenant_id, plan_type, status, module_crm, module_clm, module_cpq, module_erp, module_documents
-- ) VALUES (
--     '00000000-0000-0000-0000-000000000001',
--     'enterprise',
--     'active',
--     true, true, true, true, true
-- );

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Tenant indexes
CREATE INDEX idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX idx_tenant_users_email ON tenant_users(email);
CREATE INDEX idx_tenants_slug ON tenants(slug);

-- CRM indexes
CREATE INDEX idx_accounts_tenant_id ON accounts(tenant_id);
CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX idx_contacts_account_id ON contacts(account_id);
CREATE INDEX idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX idx_opportunities_tenant_id ON opportunities(tenant_id);
CREATE INDEX idx_opportunities_account_id ON opportunities(account_id);
CREATE INDEX idx_activities_tenant_id ON activities(tenant_id);

-- CPQ indexes
CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_quotes_tenant_id ON quotes(tenant_id);
CREATE INDEX idx_quotes_customer_email ON quotes(customer_email);
CREATE INDEX idx_quote_line_items_quote_id ON quote_line_items(quote_id);

-- CLM indexes
CREATE INDEX idx_contracts_tenant_id ON contracts(tenant_id);
CREATE INDEX idx_contracts_customer_email ON contracts(customer_email);
CREATE INDEX idx_contract_esignatures_signer_email ON contract_esignatures(signer_email);

-- ERP indexes
CREATE INDEX idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX idx_inventory_items_product_id ON inventory_items(product_id);
CREATE INDEX idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
CREATE INDEX idx_financial_records_tenant_id ON financial_records(tenant_id);
CREATE INDEX idx_financial_records_record_date ON financial_records(record_date);

-- Documents indexes
CREATE INDEX idx_auto_documents_tenant_id ON auto_documents(tenant_id);
CREATE INDEX idx_document_signatures_email ON document_signatures(signer_email);

-- ============================================================
-- COMPLETE!
-- ============================================================
