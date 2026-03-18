"use client";

import { useEffect, useState } from "react";
import { FileStack, Search, Eye, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Badge } from "@/ui/shadcn/badge";
import { supabase } from "@/core/api/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";
import { usePortalScope } from "@/workspaces/portal/hooks/usePortalScope";

interface CustomerDocument {
  id: string;
  name: string | null;
  document_type: string | null;
  status: string | null;
  created_at: string | null;
}

export default function CustomerDocumentsPage() {
  const { organizationId, organizationLoading, userId, isReady } = usePortalScope();
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);

      if (!organizationId || !userId) {
        setDocuments([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("auto_documents")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("created_by", userId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setDocuments(data);
      }
      setIsLoading(false);
    };

    if (!organizationLoading) {
      void fetchDocuments();
    }
  }, [organizationId, organizationLoading, userId]);

  const filteredDocuments = documents?.filter((doc) => {
    const matchesSearch =
      doc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.document_type?.toLowerCase().includes(searchQuery.toLowerCase());
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
          <h1 className="text-2xl font-bold">My Documents</h1>
          <p className="text-muted-foreground">View and manage your documents</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileStack className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No documents found</h3>
              <p className="text-muted-foreground">You don't have any documents yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.name || "Unnamed"}</TableCell>
                    <TableCell>{doc.document_type || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.status || "Draft"}</Badge>
                    </TableCell>
                    <TableCell>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        View
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
