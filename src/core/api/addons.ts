import { supabase } from "@/core/api/client";

export interface AddonPurchase {
  id: string;
  organization_id: string;
  addon_key: string;
  quantity: number;
  purchase_date: string;
  expiry_date: string | null;
  status: string;
}

export async function purchaseAddon(
  organizationId: string,
  addonKey: string,
  quantity: number = 1
): Promise<{ success: boolean; purchase?: AddonPurchase; error?: string }> {
  const { data, error } = await (supabase.rpc as any)("purchase_addon", {
    p_organization_id: organizationId,
    p_addon_key: addonKey,
    p_quantity: quantity,
  });

  if (error) {
    console.error("Failed to purchase addon:", error);
    return { success: false, error: error.message };
  }

  return { success: true, purchase: data?.purchase };
}

export async function getOrganizationAddons(
  organizationId: string
): Promise<AddonPurchase[]> {
  const { data, error } = await (supabase as any)
    .from("addon_purchases")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (error) {
    console.error("Failed to fetch addons:", error);
    return [];
  }

  return data || [];
}
