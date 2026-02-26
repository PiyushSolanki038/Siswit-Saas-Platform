import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useOrganizationOwnerData } from "@/hooks/useOrganizationOwnerData";

export default function OrganizationSettingsPage() {
  const { organization, loading } = useOrganizationOwnerData();

  if (loading && !organization) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <section className="org-panel">
        <h2 className="text-lg font-semibold">No organization loaded</h2>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Organization profile summary and upcoming configuration controls.</p>
      </section>

      <section className="org-panel space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={organization.name} readOnly />
          <Input value={organization.org_code ?? organization.slug} readOnly />
          <Input value={organization.company_email ?? ""} readOnly placeholder="Company email" />
          <Input value={organization.company_phone ?? ""} readOnly placeholder="Company phone" />
          <Input value={organization.company_website ?? ""} readOnly placeholder="Company website" className="md:col-span-2" />
          <Textarea
            value={organization.company_address ?? ""}
            readOnly
            placeholder="Company address"
            className="md:col-span-2"
            rows={4}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled>Save Changes (Soon)</Button>
          <Button variant="outline" disabled>
            Upload Logo (Soon)
          </Button>
        </div>
      </section>
    </div>
  );
}

