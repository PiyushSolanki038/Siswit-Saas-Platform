"use client";

import { useEffect, useState } from "react";
import { FileText, Search, Send, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/ui/shadcn/card";
import { Input } from "@/ui/shadcn/input";
import { Badge } from "@/ui/shadcn/badge";
import { Button } from "@/ui/shadcn/button";
import { supabase } from "@/core/api/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";
import { usePortalScope } from "@/workspaces/portal/hooks/usePortalScope";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: Clock },
  pending_approval: { label: "Pending Approval", color: "bg-warning/15 text-warning", icon: Clock },
  approved: { label: "Approved", color: "bg-info/15 text-info", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-destructive/15 text-destructive", icon: XCircle },
  sent: { label: "Sent", color: "bg-primary/20 text-primary", icon: Send },
  accepted: { label: "Accepted", color: "bg-success/15 text-success", icon: CheckCircle },
  expired: { label: "Expired", color: "bg-secondary text-secondary-foreground", icon: XCircle },
};

interface CustomerQuote {
  id: string;
  quote_number: string | null;
  status: string | null;
  total_amount: number | null;
  created_at: string | null;
  accounts: { name: string } | null;
}

export default function CustomerQuotesPage() {
  const { organizationId, organizationLoading, portalEmail, contactId, accountId, isReady } = usePortalScope();
  const [searchQuery, setSearchQuery] = useState("");
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      setIsLoading(true);

      if (!organizationId || !portalEmail) {
        setQuotes([]);
        setIsLoading(false);
        return;
      }

      let query = supabase
        .from("quotes")
        .select("*, accounts:accounts(name)")
        .eq("organization_id", organizationId);
        
      if (contactId) {
        query = query.eq("contact_id", contactId);
      } else if (accountId) {
        query = query.eq("account_id", accountId);
      } else {
        // Force empty result if no ID scope is available
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (!error && data) {
        setQuotes(data as unknown as CustomerQuote[]);
      }
      setIsLoading(false);
    };

    if (!organizationLoading) {
      void fetchQuotes();
    }
  }, [organizationId, organizationLoading, portalEmail, accountId, contactId]);

  const filteredQuotes = quotes?.filter((quote) => {
    const matchesSearch =
      quote.quote_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.accounts?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);
  };

  if (organizationLoading || isLoading || !isReady) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Quotes</h1>
          <p className="text-muted-foreground">View and manage your quotes</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quotes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredQuotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No quotes found</h3>
              <p className="text-muted-foreground">You don't have any quotes yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((quote) => {
                  const status = STATUS_CONFIG[quote.status || "draft"] || STATUS_CONFIG.draft;
                  const StatusIcon = status.icon;

                  return (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">{quote.quote_number || "N/A"}</TableCell>
                      <TableCell>{quote.accounts?.name || "N/A"}</TableCell>
                      <TableCell>{formatCurrency(quote.total_amount)}</TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{quote.created_at ? new Date(quote.created_at).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={quote.id}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
