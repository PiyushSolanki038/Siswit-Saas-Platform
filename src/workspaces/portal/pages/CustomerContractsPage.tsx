"use client";

import { useEffect, useState } from "react";
import { FileSignature, Search, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/ui/shadcn/card";
import { Input } from "@/ui/shadcn/input";
import { Badge } from "@/ui/shadcn/badge";
import { Button } from "@/ui/shadcn/button";
import { supabase } from "@/core/api/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";
import { usePortalScope } from "@/workspaces/portal/hooks/usePortalScope";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  pending_review: { label: "Pending Review", color: "bg-warning/15 text-warning" },
  active: { label: "Active", color: "bg-success/15 text-success" },
  expired: { label: "Expired", color: "bg-secondary text-secondary-foreground" },
  cancelled: { label: "Cancelled", color: "bg-destructive/15 text-destructive" },
};

interface CustomerContract {
  id: string;
  contract_number: string | null;
  status: string | null;
  total_value: number | null;
  start_date: string | null;
  end_date: string | null;
  accounts: { name: string } | null;
}

export default function CustomerContractsPage() {
  const { organizationId, organizationLoading, portalEmail, isReady } = usePortalScope();
  const [searchQuery, setSearchQuery] = useState("");
  const [contracts, setContracts] = useState<CustomerContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchContracts = async () => {
      setIsLoading(true);

      if (!organizationId || !portalEmail) {
        setContracts([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("contracts")
        .select("*, accounts:accounts(name)")
        .eq("organization_id", organizationId)
        .eq("customer_email", portalEmail)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setContracts(data as any);
      }
      setIsLoading(false);
    };

    if (!organizationLoading) {
      void fetchContracts();
    }
  }, [organizationId, organizationLoading, portalEmail]);

  const filteredContracts = contracts?.filter((contract) => {
    const matchesSearch =
      contract.contract_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.accounts?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

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
          <h1 className="text-2xl font-bold">My Contracts</h1>
          <p className="text-muted-foreground">View and manage your contracts</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contracts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredContracts.length === 0 ? (
            <div className="text-center py-12">
              <FileSignature className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No contracts found</h3>
              <p className="text-muted-foreground">You don't have any contracts yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract #</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((contract) => {
                  const status = STATUS_CONFIG[contract.status || "draft"] || STATUS_CONFIG.draft;

                  return (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.contract_number || "N/A"}</TableCell>
                      <TableCell>{contract.accounts?.name || "N/A"}</TableCell>
                      <TableCell>${contract.total_value?.toLocaleString() || "0"}</TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{contract.start_date ? new Date(contract.start_date).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell>{contract.end_date ? new Date(contract.end_date).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={contract.id}>
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
