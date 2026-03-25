// CLM (Contract Lifecycle Management) Type Definitions

export type ContractStatus = 'draft' | 'pending_review' | 'pending_approval' | 'approved' | 'sent' | 'signed' | 'expired' | 'cancelled';
export type ESignatureStatus = 'pending' | 'signed' | 'rejected' | 'expired';

export interface ContractTemplate {
  id: string;
  name: string;
  type: string;
  content: string;
  is_active?: boolean;
  is_public?: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  contract_number?: string;
  name: string;
  template_id?: string;
  opportunity_id?: string;
  quote_id?: string;
  account_id?: string;
  contact_id?: string;
  status: ContractStatus;
  content?: string;
  start_date?: string;
  end_date?: string;
  value?: number;
  signed_at?: string;
  signed_by?: string;
  owner_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  accounts?: { name: string } | null;
  contacts?: { first_name: string | null; last_name: string | null } | null;
}

export interface ESignature {
  id: string;
  contract_id: string;
  recipient_email: string;
  recipient_name: string;
  status: ESignatureStatus;
  signed_at?: string;
  rejection_reason?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ContractScan {
  id: string;
  contract_id: string;
  file_path?: string;
  file_url?: string;
  file_name?: string;
  content_type?: string;
  file_size?: number;
  ocr_text?: string;
  scan_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Status colors
export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  pending_review: 'bg-warning/15 text-warning',
  pending_approval: 'bg-warning/15 text-warning',
  approved: 'bg-success/15 text-success',
  sent: 'bg-info/15 text-info',
  signed: 'bg-primary/15 text-primary',
  expired: 'bg-secondary text-secondary-foreground',
  cancelled: 'bg-destructive/15 text-destructive',
};

export const ESIGNATURE_STATUS_COLORS: Record<ESignatureStatus, string> = {
  pending: 'bg-warning/15 text-warning',
  signed: 'bg-success/15 text-success',
  rejected: 'bg-destructive/15 text-destructive',
  expired: 'bg-secondary text-secondary-foreground',
};

export interface CLMDashboardStats {
  totalContracts: number;
  totalTemplates: number;
  draftContracts: number;
  pendingContracts: number;
  signedContracts: number;
  expiredContracts: number;
  totalValue: number;
  signRate: string;
  contractsByStatus: Record<string, number>;
  recentContracts: Contract[];
}

