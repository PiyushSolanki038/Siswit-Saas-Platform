import { useState } from "react";
import { useBillingInfo, useCreateBillingCustomer } from "@/workspaces/organization/hooks/useBilling";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function OrganizationBillingPage() {
  const { data: billingInfo, isLoading } = useBillingInfo();
  const createCustomer = useCreateBillingCustomer();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const navigate = useNavigate();

  const handleSetupBilling = async () => {
    if (!email || !name) {
      toast.error("Please fill in all fields");
      return;
    }
    await createCustomer.mutateAsync({ email, name });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and billing</p>
      </div>

      {/* Current Plan */}
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold capitalize">{billingInfo?.plan_type || "Free"}</p>
            <p className="text-muted-foreground">{billingInfo?.status || "N/A"}</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/organization/plans")}>
            Change Plan
          </Button>
        </div>
      </div>

      {/* Billing Details */}
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Billing Details</h2>

        {billingInfo?.customer_id ? (
          <div className="space-y-2">
            <p><strong>Customer ID:</strong> {billingInfo.customer_id}</p>
            <p><strong>Email:</strong> {billingInfo.billing_email}</p>
            <p><strong>Contact:</strong> {billingInfo.billing_contact_name}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Billing Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@company.com"
              />
            </div>
            <div>
              <Label htmlFor="name">Billing Contact Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <Button
              onClick={handleSetupBilling}
              disabled={createCustomer.isPending}
            >
              {createCustomer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CreditCard className="mr-2 h-4 w-4" />
              Setup Billing
            </Button>
          </div>
        )}
      </div>

      {/* Subscription Dates */}
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Subscription Period</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Start Date</p>
            <p>{billingInfo?.subscription_start_date || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">End Date</p>
            <p>{billingInfo?.subscription_end_date || "N/A"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
