// CPQ (Configure Price Quote) Type Definitions
import type { Quote as SharedQuote } from "./shared";

export type QuoteStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'accepted' | 'expired' | 'cancelled';

export interface QuoteAccount {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface QuoteContact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}

export interface QuoteOpportunity {
  id: string;
  name: string;
}

export type { Product, QuoteItem } from "./shared";
export type Quote = SharedQuote<QuoteStatus, QuoteAccount, QuoteContact, QuoteOpportunity>;

// Status colors
export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  pending_approval: 'bg-warning/15 text-warning',
  approved: 'bg-success/15 text-success',
  rejected: 'bg-destructive/15 text-destructive',
  sent: 'bg-info/15 text-info',
  accepted: 'bg-primary/15 text-primary',
  expired: 'bg-secondary text-secondary-foreground',
  cancelled: 'bg-destructive/15 text-destructive',
};
