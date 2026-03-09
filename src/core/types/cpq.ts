// CPQ (Configure Price Quote) Type Definitions

export type QuoteStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'accepted' | 'expired' | 'cancelled';

export interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unit_price: number;
  cost_price?: number;
  sku?: string;
  is_active?: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  quote_number?: string;
  account_id?: string;
  contact_id?: string;
  opportunity_id?: string;
  status: QuoteStatus;
  valid_until?: string;
  terms?: string;
  notes?: string;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  total?: number;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  accounts?: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  contacts?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  };
  opportunities?: {
    id: string;
    name: string;
  };
}

export interface QuoteItem {
  id?: string;
  quote_id?: string;
  product_id: string;
  product_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  total?: number;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

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
