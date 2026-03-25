import { FileText, Plus, Eye, Edit, Trash2, Send, CheckCircle, XCircle, Clock, PenTool, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Badge } from "@/ui/shadcn/badge";
import { useParams, Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/shadcn/dropdown-menu";
import { useContracts, useUpdateContract, useDeleteContract } from "@/modules/clm/hooks/useCLM";
import { useCRUD } from "@/core/rbac/usePermissions";
import { PlanLimitBanner } from "@/ui/plan-limit-banner";
import { ExportButton } from "@/ui/export-button";
import { useSearch } from "@/core/hooks/useSearch";
import { SearchBar } from "@/ui/search-bar";
import { FilterBar } from "@/ui/filter-bar";

const CONTRACT_FILTERS = [
  {
    key: "status",
    label: "Status",
    options: [
      { label: "Draft", value: "draft" },
      { label: "Pending Review", value: "pending_review" },
      { label: "Approved", value: "approved" },
      { label: "Sent for Signature", value: "sent" },
      { label: "Signed", value: "signed" },
      { label: "Expired", value: "expired" },
      { label: "Cancelled", value: "cancelled" },
    ],
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: Clock },
  pending_review: { label: "Pending Review", color: "bg-warning/20 text-warning-foreground", icon: Clock },
  pending_approval: { label: "Pending Approval", color: "bg-warning/20 text-warning-foreground", icon: Clock },
  approved: { label: "Approved", color: "bg-info/20 text-info-foreground", icon: CheckCircle },
  sent: { label: "Sent for Signature", color: "bg-primary/20 text-primary", icon: Send },
  signed: { label: "Signed", color: "bg-success/20 text-success-foreground", icon: PenTool },
  expired: { label: "Expired", color: "bg-destructive/20 text-destructive", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground", icon: XCircle },
};

export default function ContractsListPage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();

  const { data: contracts = [], isLoading } = useContracts();
  const updateContract = useUpdateContract();
  const deleteContract = useDeleteContract();
  const { canDelete } = useCRUD();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, filteredData, resultCount, totalCount, filterDefs } = useSearch<any>(contracts, {
    searchFields: ["name", "contract_number", "status"],
    filterDefs: CONTRACT_FILTERS,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
  };

  return (
    <div className="space-y-6">
      <PlanLimitBanner resource="contracts" className="mb-4" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contracts</h1>
          <p className="text-muted-foreground">Manage contract lifecycle from creation to signature</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/${tenantSlug}/app/clm/scan`}><Upload className="h-4 w-4 mr-2" />Scan Contract</Link>
          </Button>
          <Button asChild>
            <Link to={`/${tenantSlug}/app/clm/contracts/new`}><Plus className="h-4 w-4 mr-2" />Create Contract</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search contracts..." resultCount={resultCount} totalCount={totalCount} />
          <ExportButton data={filteredData} filename="siswit-contracts" sheetName="Contracts" isLoading={isLoading} />
        </div>
        <FilterBar filters={filterDefs} activeFilters={activeFilters} onFilterChange={setFilter} onClearAll={clearFilters} />
      </div>

      {/* Contracts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contract #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="h-16 animate-pulse bg-muted/20" />
                  </TableRow>
                ))
              ) : filteredData?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No contracts found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData?.map((contract: any) => {
                  const statusConfig = STATUS_CONFIG[contract.status || "draft"] || STATUS_CONFIG.draft;
                  const StatusIcon = statusConfig.icon;
                  return (
                    <TableRow key={contract.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/${tenantSlug}/app/clm/contracts/${contract.id}`)}>
                      <TableCell className="font-medium">{contract.contract_number || "—"}</TableCell>
                      <TableCell>{contract.name}</TableCell>
                      <TableCell>{contract.accounts?.name || "—"}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(contract.value || 0)}</TableCell>
                      <TableCell>{contract.start_date ? format(new Date(contract.start_date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>{contract.end_date ? format(new Date(contract.end_date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>
                        <Badge className={statusConfig.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">Actions</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/${tenantSlug}/app/clm/contracts/${contract.id}`)}>
                              <Eye className="h-4 w-4 mr-2" />View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/${tenantSlug}/app/clm/contracts/${contract.id}/edit`)}>
                              <Edit className="h-4 w-4 mr-2" />Edit
                            </DropdownMenuItem>
                            {contract.status === "approved" && (
                              <DropdownMenuItem onClick={() => navigate(`/${tenantSlug}/app/clm/contracts/${contract.id}/sign`)}>
                                <PenTool className="h-4 w-4 mr-2" />Send for Signature
                              </DropdownMenuItem>
                            )}
                            {contract.status === "draft" && (
                              <DropdownMenuItem onClick={() => updateContract.mutate({ id: contract.id, status: "pending_review" })}>
                                <Send className="h-4 w-4 mr-2" />Submit for Review
                              </DropdownMenuItem>
                            )}
                            {contract.status === "pending_review" && (
                              <DropdownMenuItem onClick={() => updateContract.mutate({ id: contract.id, status: "approved" })}>
                                <CheckCircle className="h-4 w-4 mr-2" />Approve
                              </DropdownMenuItem>
                            )}
                            {canDelete() && (
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteContract.mutate(contract.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />Delete
                            </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
