import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
} from "@/modules/crm/hooks/useCRM";

import { DataTable } from "@/modules/crm/components/DataTable";

import { Button } from "@/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/shadcn/dialog";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Textarea } from "@/ui/shadcn/textarea";

import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Globe,
  Building2,
  MapPin,
  FileText,
  Mail,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/ui/shadcn/dropdown-menu";

// matches accounts table
export interface AccountRow {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  annual_revenue: number | null;
  employee_count: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  description: string | null;
  created_at: string;
}

export default function AccountsPage() {
  const navigate = useNavigate();

  // data hooks
  const { data: accounts = [], isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  // ui state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);

  // form state
  const [formData, setFormData] = useState({
    name: "",
    industry: "",
    website: "",
    phone: "",
    email: "",
    annual_revenue: "",
    employee_count: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postal_code: "",
    description: "",
  });

  // open create dialog
  const openCreateDialog = () => {
    setEditingAccount(null);
    setFormData({
      name: "",
      industry: "",
      website: "",
      phone: "",
      email: "",
      annual_revenue: "",
      employee_count: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postal_code: "",
      description: "",
    });
    setDialogOpen(true);
  };

  // open edit dialog
  const openEditDialog = (acc: AccountRow) => {
    setEditingAccount(acc);
    setFormData({
      name: acc.name,
      industry: acc.industry || "",
      website: acc.website || "",
      phone: acc.phone || "",
      email: acc.email || "",
      annual_revenue: acc.annual_revenue?.toString() || "",
      employee_count: acc.employee_count?.toString() || "",
      address: acc.address || "",
      city: acc.city || "",
      state: acc.state || "",
      country: acc.country || "",
      postal_code: acc.postal_code || "",
      description: acc.description || "",
    });
    setDialogOpen(true);
  };

  // submit handler
  const handleSubmit = async () => {
    const annualRevenue = formData.annual_revenue
      ? parseFloat(formData.annual_revenue)
      : undefined;
    const employeeCount = formData.employee_count
      ? parseInt(formData.employee_count)
      : undefined;

    const payload = {
      ...formData,
      annual_revenue: annualRevenue,
      employee_count: employeeCount,
    };

    if (editingAccount) {
      await updateAccount.mutateAsync({ id: editingAccount.id, ...payload });
    } else {
      await createAccount.mutateAsync(payload);
    }

    setDialogOpen(false);
  };

  // table columns
  const columns = [
    {
      key: "name",
      header: "Account",
      cell: (acc: AccountRow) => (
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-primary/10">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-medium">{acc.name}</div>
            <div className="text-xs text-muted-foreground">
              {acc.industry || "-"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      cell: (acc: AccountRow) => (
        <div className="text-sm text-muted-foreground space-y-1">
          {acc.phone && <div>{acc.phone}</div>}
          {acc.email && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> {acc.email}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "location",
      header: "Location",
      cell: (acc: AccountRow) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          {(acc.city || acc.country) && <MapPin className="h-3 w-3" />}
          {[acc.city, acc.state, acc.country].filter(Boolean).join(", ") || "-"}
        </div>
      ),
    },
    {
      key: "website",
      header: "Website",
      cell: (acc: AccountRow) =>
        acc.website ? (
          <a
            href={
              acc.website.startsWith("http")
                ? acc.website
                : `https://${acc.website}`
            }
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:underline"
          >
            <Globe className="h-3 w-3" /> Visit
          </a>
        ) : (
          "-"
        ),
    },
    {
      key: "actions",
      header: "",
      cell: (acc: AccountRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(acc)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                navigate(`/dashboard/cpq/quotes/new?account_id=${acc.id}`)
              }
            >
              <FileText className="mr-2 h-4 w-4" /> Create Quote
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => deleteAccount.mutate(acc.id)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">
            Manage your customer accounts
          </p>
        </div>

        <DataTable
          data={accounts as AccountRow[]}
          columns={columns}
          loading={isLoading}
          onAdd={openCreateDialog}
          addLabel="Add Account"
          searchPlaceholder="Search accounts..."
        />

        {/* account form */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? "Edit Account" : "Add Account"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* basic info */}
              <Section title="Basic Info">
                <Grid cols={2}>
                  <InputField
                    label="Account Name *"
                    placeholder="Acme Corp"
                    value={formData.name}
                    onChange={(v) => setFormData({ ...formData, name: v })}
                  />
                  <InputField
                    label="Industry"
                    placeholder="Technology"
                    value={formData.industry}
                    onChange={(v) =>
                      setFormData({ ...formData, industry: v })
                    }
                  />
                </Grid>
              </Section>

              {/* company size */}
              <Section title="Company Size">
                <Grid cols={2}>
                  <InputField
                    label="Annual Revenue"
                    type="number"
                    placeholder="100000"
                    value={formData.annual_revenue}
                    onChange={(v) =>
                      setFormData({ ...formData, annual_revenue: v })
                    }
                  />
                  <InputField
                    label="Employees"
                    type="number"
                    placeholder="50"
                    value={formData.employee_count}
                    onChange={(v) =>
                      setFormData({ ...formData, employee_count: v })
                    }
                  />
                </Grid>
              </Section>

              {/* contact */}
              <Section title="Contact Info">
                <Grid cols={3}>
                  <Input
                    placeholder="acme.com"
                    value={formData.website}
                    onChange={(e) =>
                      setFormData({ ...formData, website: e.target.value })
                    }
                  />
                  <Input
                    placeholder="+1 234 567 890"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                  <Input
                    placeholder="info@acme.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </Grid>
              </Section>

              {/* address */}
              <Section title="Address">
                <Input
                  placeholder="123 Main Street"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
                <Grid cols={4}>
                  <Input placeholder="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                  <Input placeholder="State" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
                  <Input placeholder="Zip Code" value={formData.postal_code} onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })} />
                  <Input placeholder="Country" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
                </Grid>
              </Section>

              {/* notes */}
              <Section title="Description">
                <Textarea
                  rows={4}
                  placeholder="Additional notes..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </Section>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  createAccount.isPending || updateAccount.isPending
                }
              >
                {editingAccount ? "Update Account" : "Create Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}

// section wrapper
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

// responsive grid helper
function Grid({ cols, children }: { cols: 2 | 3 | 4; children: ReactNode }) {
  return (
    <div
      className={`grid gap-4 ${
        cols === 2
          ? "grid-cols-1 md:grid-cols-2"
          : cols === 3
          ? "grid-cols-1 md:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      }`}
    >
      {children}
    </div>
  );
}

// input with label + placeholder
function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
