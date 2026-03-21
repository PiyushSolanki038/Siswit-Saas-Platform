-- 037_drop_bad_crm_policies.sql
-- Migration 017 incorrectly added secondary RLS policies (e.g., `leads_select_policy`)
-- to the CRM tables. These policies contained direct SELECTs on `auth.users`, which
-- the `authenticated` role doesn't have permissions to query, causing 42501 (Forbidden)
-- errors to be thrown across the entire app.
-- 
-- We drop all of these "_policy" suffixed rogue policies, letting the correct
-- policies from 015 and 034 (e.g., `leads_select`) take full control without crashing.

SET search_path = public, extensions;

-- Drop Leads 017 policies
DROP POLICY IF EXISTS "leads_select_policy" ON leads;
DROP POLICY IF EXISTS "leads_insert_policy" ON leads;
DROP POLICY IF EXISTS "leads_update_policy" ON leads;
DROP POLICY IF EXISTS "leads_delete_policy" ON leads;

-- Drop Accounts 017 policies
DROP POLICY IF EXISTS "accounts_select_policy" ON accounts;
DROP POLICY IF EXISTS "accounts_insert_policy" ON accounts;
DROP POLICY IF EXISTS "accounts_update_policy" ON accounts;
DROP POLICY IF EXISTS "accounts_delete_policy" ON accounts;

-- Drop Contacts 017 policies
DROP POLICY IF EXISTS "contacts_select_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_update_policy" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_policy" ON contacts;

-- Drop Opportunities 017 policies
DROP POLICY IF EXISTS "opportunities_select_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_insert_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_update_policy" ON opportunities;
DROP POLICY IF EXISTS "opportunities_delete_policy" ON opportunities;

-- Drop Activities 017 policies
DROP POLICY IF EXISTS "activities_select_policy" ON activities;
DROP POLICY IF EXISTS "activities_insert_policy" ON activities;
DROP POLICY IF EXISTS "activities_update_policy" ON activities;
DROP POLICY IF EXISTS "activities_delete_policy" ON activities;

-- Drop Quotes 017 policies
DROP POLICY IF EXISTS "quotes_select_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_insert_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_update_policy" ON quotes;
DROP POLICY IF EXISTS "quotes_delete_policy" ON quotes;

-- Drop Quote Line Items 017 policies
DROP POLICY IF EXISTS "quote_line_items_select_policy" ON quote_line_items;
DROP POLICY IF EXISTS "quote_line_items_insert_policy" ON quote_line_items;
DROP POLICY IF EXISTS "quote_line_items_update_policy" ON quote_line_items;
DROP POLICY IF EXISTS "quote_line_items_delete_policy" ON quote_line_items;
