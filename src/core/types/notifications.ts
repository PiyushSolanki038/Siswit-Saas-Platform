export type NotificationType =
  | 'contract_signed'
  | 'contract_expiring'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'document_shared'
  | 'esignature_requested'
  | 'esignature_completed'
  | 'plan_limit_warning'
  | 'plan_limit_reached'
  | 'purchase_order_approved'
  | 'member_joined';

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}
