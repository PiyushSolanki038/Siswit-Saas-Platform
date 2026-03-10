// CRM Type Definitions
import type { TenantScoped } from "./base";
import type { Quote as SharedQuote } from "./shared";

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
export type LeadSource = 'website' | 'referral' | 'cold_call' | 'advertisement' | 'social_media' | 'trade_show' | 'other';
export type OpportunityStage = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
export type ActivityType = 'call' | 'email' | 'meeting' | 'task' | 'note';
export type QuoteStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'accepted' | 'expired';

export interface Account extends TenantScoped {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  annual_revenue?: number;
  employee_count?: number;
  description?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Contact extends TenantScoped {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  job_title?: string;
  department?: string;
  account_id?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  description?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  account?: Account;
}

export interface Lead extends TenantScoped {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  status: LeadStatus;
  source?: LeadSource;
  website?: string;
  industry?: string;
  annual_revenue?: number;
  employee_count?: number;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  description?: string;
  converted_at?: string;
  converted_account_id?: string;
  converted_contact_id?: string;
  converted_opportunity_id?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Opportunity extends TenantScoped {
  id: string;
  name: string;
  account_id?: string;
  contact_id?: string;
  stage: OpportunityStage;
  amount?: number;
  probability?: number;
  expected_revenue?: number;
  close_date?: string;
  lead_source?: LeadSource;
  description?: string;
  next_step?: string;
  is_closed?: boolean;
  is_won?: boolean;
  closed_at?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  account?: Account;
  contact?: Contact;
}

export interface Activity extends TenantScoped {
  id: string;
  type: ActivityType;
  subject: string;
  description?: string;
  due_date?: string;
  completed_at?: string;
  is_completed?: boolean;
  priority?: string;
  lead_id?: string;
  account_id?: string;
  contact_id?: string;
  opportunity_id?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type { Product, QuoteItem } from "./shared";
export type Quote = SharedQuote<QuoteStatus, Account, Contact, Opportunity>;



// Stage probabilities for auto-calculation
export const STAGE_PROBABILITIES: Record<OpportunityStage, number> = {
  new: 10,
  qualified: 25,
  proposal: 50,
  negotiation: 75,
  closed_won: 100,
  closed_lost: 0,
};

// Status colors
export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-info/15 text-info',
  contacted: 'bg-warning/15 text-warning',
  qualified: 'bg-success/15 text-success',
  unqualified: 'bg-destructive/15 text-destructive',
  converted: 'bg-primary/15 text-primary',
};

export const OPPORTUNITY_STAGE_COLORS: Record<OpportunityStage, string> = {
  new: 'bg-info',
  qualified: 'bg-info',
  proposal: 'bg-warning',
  negotiation: 'bg-primary',
  closed_won: 'bg-success',
  closed_lost: 'bg-destructive',
};

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  pending_approval: 'bg-warning/15 text-warning',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-destructive/15 text-destructive',
  sent: 'bg-info/15 text-info',
  accepted: 'bg-primary/15 text-primary',
  expired: 'bg-secondary text-secondary-foreground',
};
