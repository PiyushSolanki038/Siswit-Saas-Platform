import { useState } from "react";
import { FileText, Plus, Eye, Edit, Trash2, Send, CheckCircle, XCircle, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Badge } from "@/ui/shadcn/badge";
import { useQuotes, useUpdateQuoteStatus, useDeleteQuote } from "@/modules/cpq/hooks/useCPQ";
import { useCRUD } from "@/core/rbac/usePermissions";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/shadcn/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/shadcn/alert-dialog";
import type { QuoteStatus } from "@/core/types/cpq";
import { PlanLimitBanner } from "@/ui/plan-limit-banner";
import { ExportButton } from "@/ui/export-button";
import { useSearch } from "@/core/hooks/useSearch";
import { SearchBar } from "@/ui/search-bar";
import { FilterBar } from "@/ui/filter-bar";

const QUOTE_FILTERS = [
  {
    key: "status",
    label: "Status",
    options: [
      { label: "Draft", value: "draft" },
      { label: "Pending Approval", value: "pending_approval" },
      { label: "Approved", value: "approved" },
      { label: "Sent", value: "sent" },
      { label: "Accepted", value: "accepted" },
      { label: "Rejected", value: "rejected" },
      { label: "Expired", value: "expired" },
    ],
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: Clock },
  pending_approval: { label: "Pending Approval", color: "bg-warning/20 text-warning-foreground", icon: Clock },
  approved: { label: "Approved", color: "bg-info/20 text-info-foreground", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-destructive/20 text-destructive", icon: XCircle },
  sent: { label: "Sent", color: "bg-primary/20 text-primary", icon: Send },
  accepted: { label: "Accepted", color: "bg-success/20 text-success-foreground", icon: CheckCircle },
  expired: { label: "Expired", color: "bg-destructive/20 text-destructive", icon: XCircle },
};

export default function QuotesListPage() {
  const navigate = useNavigate();

  const { data: quotes, isLoading } = useQuotes();
  const updateStatusMutation = useUpdateQuoteStatus();
  const deleteMutation = useDeleteQuote();
  const { canDelete } = useCRUD();
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { searchQuery, setSearchQuery, activeFilters, setFilter, clearFilters, filteredData, resultCount, totalCount, filterDefs } = useSearch<any>(quotes ?? [], {
    searchFields: ["quote_number", "status"],
    filterDefs: QUOTE_FILTERS,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
  };

  const handleDelete = (id: string) => {
    setQuoteToDelete(id);
  };

  const handleStatusChange = (id: string, newStatus: QuoteStatus) => {
    updateStatusMutation.mutate({ id, status: newStatus });
  };

  return (
    <div className="space-y-6">
        <PlanLimitBanner resource="quotes" className="mb-4" />
        {/* Delete AlertDialog */}
        <AlertDialog open={!!quoteToDelete} onOpenChange={(open) => !open && setQuoteToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The quote will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (quoteToDelete) deleteMutation.mutate(quoteToDelete);
                  setQuoteToDelete(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Quotes</h1>
            <p className="text-muted-foreground">Manage and track all your quotes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link to="/dashboard/cpq/quotes/new"><Plus className="h-4 w-4 mr-2" />Create Quote</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search by quote number..." resultCount={resultCount} totalCount={totalCount} />
            <ExportButton data={filteredData} filename="siswit-quotes" sheetName="Quotes" isLoading={isLoading} />
          </div>
          <FilterBar filters={filterDefs} activeFilters={activeFilters} onFilterChange={setFilter} onClearAll={clearFilters} />
        </div>

        {/* Quotes Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-16 animate-pulse bg-muted/20" />
                    </TableRow>
                  ))
                ) : filteredData?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No quotes found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData?.map((quote: any) => {
                    const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft;
                    const StatusIcon = statusConfig.icon;
                    return (
                      <TableRow key={quote.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/cpq/quotes/${quote.id}`)}>
                        <TableCell className="font-medium">{quote.quote_number || "—"}</TableCell>
                        <TableCell>{quote.accounts?.name || "—"}</TableCell>
                        <TableCell>{quote.opportunities?.name || "—"}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(quote.total || 0)}</TableCell>
                        <TableCell>{quote.valid_until ? format(new Date(quote.valid_until), "MMM d, yyyy") : "—"}</TableCell>
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
                              <DropdownMenuItem onClick={() => navigate(`/dashboard/cpq/quotes/${quote.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/dashboard/cpq/quotes/${quote.id}/edit`)}>
                                <Edit className="h-4 w-4 mr-2" />Edit
                              </DropdownMenuItem>
                              {quote.status === "draft" && (
                                <DropdownMenuItem onClick={() => handleStatusChange(quote.id, "pending_approval")}>
                                  <Send className="h-4 w-4 mr-2" />Submit for Approval
                                </DropdownMenuItem>
                              )}
                              {quote.status === "pending_approval" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleStatusChange(quote.id, "approved")}>
                                    <CheckCircle className="h-4 w-4 mr-2" />Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(quote.id, "rejected")}>
                                    <XCircle className="h-4 w-4 mr-2" />Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(quote.status === "approved" || quote.status === "draft") && (
                                <DropdownMenuItem onClick={() => handleStatusChange(quote.id, "sent")}>
                                  <Send className="h-4 w-4 mr-2" />Mark as Sent
                                </DropdownMenuItem>
                              )}
                              {canDelete() && (
                              <DropdownMenuItem onClick={() => handleDelete(quote.id)} className="text-destructive">
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

