import { useState } from "react";
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead } from "@/modules/crm/hooks/useCRM";
import { useCRUD } from "@/core/rbac/usePermissions";
import { DataTable } from "@/modules/crm/components/DataTable";
import { Badge } from "@/ui/shadcn/badge";
import { Button } from "@/ui/shadcn/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/ui/shadcn/dialog";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/shadcn/select";
import { Textarea } from "@/ui/shadcn/textarea";
import { LEAD_STATUS_COLORS } from "@/core/types/crm";
import type { Lead, LeadStatus, LeadSource } from "@/core/types/crm";
import { format } from "date-fns";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/shadcn/dropdown-menu";
import { PlanLimitBanner } from "@/ui/plan-limit-banner";
import { ExportButton } from "@/ui/export-button";
import { useSearch } from "@/core/hooks/useSearch";
import { SearchBar } from "@/ui/search-bar";
import { FilterBar } from "@/ui/filter-bar";
import type { Lead as LeadType } from "@/core/types/crm";

const LEAD_FILTERS = [
  {
    key: "status",
    label: "Status",
    options: [
      { label: "New", value: "new" },
      { label: "Contacted", value: "contacted" },
      { label: "Qualified", value: "qualified" },
      { label: "Unqualified", value: "unqualified" },
    ],
  },
  {
    key: "source",
    label: "Source",
    options: [
      { label: "Website", value: "website" },
      { label: "Referral", value: "referral" },
      { label: "Cold Call", value: "cold_call" },
      { label: "Social Media", value: "social_media" },
      { label: "Other", value: "other" },
    ],
  },
];

export default function LeadsPage() {
  const { data: leads = [], isLoading } = useLeads();
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const { canDelete } = useCRUD();

  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, filteredData, resultCount, totalCount, filterDefs } = useSearch<LeadType>(leads, {
    searchFields: ["first_name", "last_name", "email", "company", "phone"],
    filterDefs: LEAD_FILTERS,
  });
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({ first_name: "", last_name: "", email: "", phone: "", company: "", job_title: "", status: "new" as LeadStatus, source: "other" as LeadSource, description: "" });

  const openCreateDialog = () => { setEditingLead(null); setFormData({ first_name: "", last_name: "", email: "", phone: "", company: "", job_title: "", status: "new", source: "other", description: "" }); setDialogOpen(true); };
  const openEditDialog = (lead: Lead) => { setEditingLead(lead); setFormData({ first_name: lead.first_name, last_name: lead.last_name, email: lead.email || "", phone: lead.phone || "", company: lead.company || "", job_title: lead.job_title || "", status: lead.status, source: lead.source || "other", description: lead.description || "" }); setDialogOpen(true); };

  const handleSubmit = async () => {
    if (editingLead) { await updateLead.mutateAsync({ id: editingLead.id, ...formData }); }
    else { await createLead.mutateAsync(formData); }
    setDialogOpen(false);
  };

  const columns = [
    { key: "name", header: "Name", cell: (lead: Lead) => <span className="font-medium">{lead.first_name} {lead.last_name}</span> },
    { key: "company", header: "Company" },
    { key: "email", header: "Email" },
    { key: "status", header: "Status", cell: (lead: Lead) => <Badge className={LEAD_STATUS_COLORS[lead.status]}>{lead.status}</Badge> },
    { key: "source", header: "Source", cell: (lead: Lead) => lead.source?.replace("_", " ") },
    { key: "created_at", header: "Created", cell: (lead: Lead) => format(new Date(lead.created_at), "MMM d, yyyy") },
    { key: "actions", header: "", cell: (lead: Lead) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openEditDialog(lead)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
          {canDelete() && <DropdownMenuItem onClick={() => deleteLead.mutate(lead.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    )},
  ];

  return (
    <div className="space-y-6">
        <PlanLimitBanner resource="leads" className="mb-4" />
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold">Leads</h1><p className="text-muted-foreground">Manage your sales leads</p></div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search leads..." resultCount={resultCount} totalCount={totalCount} />
            <ExportButton data={filteredData} filename="siswit-leads" sheetName="Leads" isLoading={isLoading} />
          </div>
          <FilterBar filters={filterDefs} activeFilters={activeFilters} onFilterChange={setFilter} onClearAll={clearFilters} />
        </div>
        <DataTable data={filteredData} columns={columns} loading={isLoading} onAdd={openCreateDialog} addLabel="Add Lead" searchable={false} />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingLead ? "Edit Lead" : "Add Lead"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>First Name</Label><Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} /></div>
                <div><Label>Last Name</Label><Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div><Label>Company</Label><Input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Status</Label><Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as LeadStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">New</SelectItem><SelectItem value="contacted">Contacted</SelectItem><SelectItem value="qualified">Qualified</SelectItem><SelectItem value="unqualified">Unqualified</SelectItem></SelectContent></Select></div>
                <div><Label>Source</Label><Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v as LeadSource })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="website">Website</SelectItem><SelectItem value="referral">Referral</SelectItem><SelectItem value="cold_call">Cold Call</SelectItem><SelectItem value="social_media">Social Media</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
              </div>
              <div><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={handleSubmit} disabled={createLead.isPending || updateLead.isPending}>{editingLead ? "Update" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
