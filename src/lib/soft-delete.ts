import { supabase } from "@/integrations/supabase/client";

interface SoftDeleteInput {
  table: string;
  id: string;
  userId?: string | null;
}

interface RestoreInput {
  table: string;
  id: string;
}

/**
 * Soft delete convention:
 * - set `deleted_at`
 * - set `deleted_by`
 * - keep record for audit and recovery
 */
export async function softDeleteRecord(input: SoftDeleteInput): Promise<boolean> {
  const { error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(input.table as any)
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: input.userId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    console.error(`Soft delete error on table ${input.table} (ID: ${input.id}):`, error);
    throw new Error(error.message || `Failed to soft delete record in ${input.table}`);
  }

  return true;
}

export async function restoreSoftDeletedRecord(input: RestoreInput): Promise<boolean> {
  const { error } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from(input.table as any)
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) {
    console.error(`Restore soft delete error on table ${input.table} (ID: ${input.id}):`, error);
    throw new Error(error.message || `Failed to restore record in ${input.table}`);
  }

  return true;
}
