import { useState } from "react";
import { 
  useOpportunities, 
  useCreateOpportunity, 
  useUpdateOpportunity, 
  useDeleteOpportunity,
  useAccounts
} from "@/modules/crm/hooks/useCRM";
import { useCRUD } from "@/core/rbac/usePermissions";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/shadcn/select";
import { MoreHorizontal, Pencil, Trash2, Target, DollarSign, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/shadcn/dropdown-menu";
import { format } from "date-fns";
import { Badge } from "@/ui/shadcn/badge";
import { PlanLimitBanner } from "@/ui/plan-limit-banner";
import { ExportButton } from "@/ui/export-button";
import { useSearch } from "@/core/hooks/useSearch";
import { SearchBar } from "@/ui/search-bar";
import { FilterBar } from "@/ui/filter-bar";

const OPP_FILTERS = [
  {
    key: "stage",
    label: "Stage",
    options: [
      { label: "New", value: "new" },
      { label: "Qualified", value: "qualified" },
      { label: "Proposal", value: "proposal" },
      { label: "Negotiation", value: "negotiation" },
      { label: "Closed Won", value: "closed_won" },
      { label: "Closed Lost", value: "closed_lost" },
    ],
  },
  {
    key: "amount_range",
    label: "Amount",
    options: [
      { label: "Under ₹1L", value: "under_1l" },
      { label: "₹1L – ₹10L", value: "1l_10l" },
      { label: "Above ₹10L", value: "above_10l" },
    ],
  },
];

const OPP_CUSTOM_FILTERS = {
  amount_range: (item: OpportunityRow, value: string) => {
    const amt = item.amount ?? 0;
    if (value === "under_1l") return amt < 100000;
    if (value === "1l_10l") return amt >= 100000 && amt <= 1000000;
    if (value === "above_10l") return amt > 1000000;
    return true;
  },
};

// Exactly matches Schema Enums
export type OpportunityStage = 
  | "new" 
  | "qualified" 
  | "proposal" 
  | "negotiation" 
  | "closed_won" 
  | "closed_lost";

export interface OpportunityRow {
  id: string;
  name: string;
  account_id: string | null;
  amount: number | null;
  stage: OpportunityStage;
  close_date: string | null;
  probability: number | null;
  description: string | null;
  created_at: string;
}

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

const STAGE_COLORS: Record<string, string> = {
  new: "bg-secondary text-secondary-foreground",
  qualified: "bg-info/15 text-info",
  proposal: "bg-warning/15 text-warning",
  negotiation: "bg-primary/15 text-primary",
  closed_won: "bg-success/15 text-success",
  closed_lost: "bg-destructive/15 text-destructive",
};

export default function OpportunitiesPage() {
  const { data: opportunities = [], isLoading } = useOpportunities();
  const { data: accounts = [] } = useAccounts();
  const createOpp = useCreateOpportunity();
  const updateOpp = useUpdateOpportunity();
  const deleteOpp = useDeleteOpportunity();
  const { canDelete } = useCRUD();

  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, filteredData, resultCount, totalCount, filterDefs } = useSearch<OpportunityRow>(opportunities as unknown as OpportunityRow[], {
    searchFields: ["name", "stage"],
    filterDefs: OPP_FILTERS,
    customFilters: OPP_CUSTOM_FILTERS,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<OpportunityRow | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    account_id: "",
    amount: "",
    stage: "new" as OpportunityStage,
    close_date: "",
    probability: "20",
    description: "",
  });

  const openCreateDialog = () => {
    setEditingOpp(null);
    setFormData({
      name: "",
      account_id: "",
      amount: "",
      stage: "new",
      close_date: "",
      probability: "20",
      description: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (opp: OpportunityRow) => {
    setEditingOpp(opp);
    setFormData({
      name: opp.name,
      account_id: opp.account_id || "",
      amount: opp.amount ? opp.amount.toString() : "",
      stage: opp.stage,
      close_date: opp.close_date ? format(new Date(opp.close_date), "yyyy-MM-dd") : "",
      probability: opp.probability ? opp.probability.toString() : "",
      description: opp.description || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      ...formData,
      amount: formData.amount ? parseFloat(formData.amount) : undefined,
      probability: formData.probability ? parseInt(formData.probability) : undefined,
      close_date: formData.close_date || undefined,
    };

    if (editingOpp) {
      await updateOpp.mutateAsync({ id: editingOpp.id, ...payload });
    } else {
      await createOpp.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const columns = [
    {
      key: "name",
      header: "Opportunity Name",
      cell: (row: OpportunityRow) => (
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-full">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      cell: (row: OpportunityRow) => (
        <Badge className={STAGE_COLORS[row.stage] || "bg-secondary text-secondary-foreground"}>
          {STAGE_LABELS[row.stage] || row.stage}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: "Value",
      cell: (row: OpportunityRow) => (
        <span className="font-medium text-foreground">
          {formatCurrency(row.amount)}
        </span>
      ),
    },
    {
      key: "close_date",
      header: "Close Date",
      cell: (row: OpportunityRow) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>
            {row.close_date && !isNaN(new Date(row.close_date).getTime())
              ? format(new Date(row.close_date), "MMM d, yyyy")
              : "-"}
          </span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (row: OpportunityRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(row)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {canDelete() && (
            <DropdownMenuItem
              onClick={() => deleteOpp.mutate(row.id)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
        <PlanLimitBanner resource="opportunities" className="mb-4" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Opportunities</h1>
            <p className="text-muted-foreground">Manage your deals</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search opportunities..." resultCount={resultCount} totalCount={totalCount} />
            <ExportButton data={filteredData} filename="siswit-opportunities" sheetName="Opportunities" isLoading={isLoading} />
          </div>
          <FilterBar filters={filterDefs} activeFilters={activeFilters} onFilterChange={setFilter} onClearAll={clearFilters} />
        </div>

        <DataTable
          data={filteredData as OpportunityRow[]}
          columns={columns}
          loading={isLoading}
          onAdd={openCreateDialog}
          addLabel="Add Opportunity"
          searchable={false}
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingOpp ? "Edit Opportunity" : "New Opportunity"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Opportunity Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Software License Q1"
                />
              </div>

              <div className="grid gap-2">
                <Label>Account</Label>
                <Select value={formData.account_id} onValueChange={(v) => setFormData({ ...formData, account_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Value ($)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      className="pl-9"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Close Date</Label>
                  <Input
                    type="date"
                    value={formData.close_date}
                    onChange={(e) => setFormData({ ...formData, close_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Stage</Label>
                  <Select
                    value={formData.stage}
                    onValueChange={(v) => setFormData({ ...formData, stage: v as OpportunityStage })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STAGE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key as OpportunityStage}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Probability (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                    placeholder="20"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={createOpp.isPending || updateOpp.isPending}>
                {editingOpp ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
