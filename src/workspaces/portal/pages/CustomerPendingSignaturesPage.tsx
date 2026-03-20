"use client";

import { useEffect, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/ui/shadcn/card";
import { Badge } from "@/ui/shadcn/badge";
import { Button } from "@/ui/shadcn/button";
import { supabase } from "@/core/api/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";
import { usePortalScope } from "@/workspaces/portal/hooks/usePortalScope";

interface PendingSignature {
  id: string;
  signer_name: string | null;
  signer_email: string | null;
  created_at: string | null;
  contracts: {
    contract_number: string | null;
  } | null;
}

export default function CustomerPendingSignaturesPage() {
  const { organizationId, organizationLoading, portalEmail, contactId, accountId, isReady } = usePortalScope();
  const [signatures, setSignatures] = useState<PendingSignature[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSignatures = async () => {
      setIsLoading(true);

      if (!organizationId || !portalEmail) {
        setSignatures([]);
        setIsLoading(false);
        return;
      }

      let query = supabase
        .from("contracts")
        .select("id")
        .eq("organization_id", organizationId);
        
      if (contactId) query = query.eq("contact_id", contactId);
      else if (accountId) query = query.eq("account_id", accountId);
      else query = query.eq("customer_email", portalEmail);

      const { data: userContracts } = await query;

      const contractIds = userContracts?.map((contract) => contract.id) || [];

      if (contractIds.length === 0) {
        setSignatures([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("contract_esignatures")
        .select("*, contracts:contracts(contract_number)")
        .in("contract_id", contractIds)
        .eq("signer_email", portalEmail)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setSignatures(data as unknown as PendingSignature[]);
      }
      setIsLoading(false);
    };

    if (!organizationLoading) {
      void fetchSignatures();
    }
  }, [organizationId, organizationLoading, portalEmail, accountId, contactId]);

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
          <h1 className="text-2xl font-bold">Pending Signatures</h1>
          <p className="text-muted-foreground">Documents waiting for your signature</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          {signatures.length === 0 ? (
            <div className="text-center py-12">
              <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pending signatures</h3>
              <p className="text-muted-foreground">You don't have any documents waiting for your signature.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Signer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signatures.map((sig) => (
                  <TableRow key={sig.id}>
                    <TableCell className="font-medium">
                      {sig.contracts?.contract_number || "N/A"}
                    </TableCell>
                    <TableCell>{sig.signer_name || sig.signer_email}</TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        Pending
                      </Badge>
                    </TableCell>
                    <TableCell>{sig.created_at ? new Date(sig.created_at).toLocaleDateString() : "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={sig.id}>
                          View & Sign
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
