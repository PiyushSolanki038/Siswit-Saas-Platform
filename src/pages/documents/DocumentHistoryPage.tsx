import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAutoDocuments, useDocumentESignatures } from "@/hooks/useDocuments";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileStack,
  FileText,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusConfig: Record<string, { icon: React.ElementType; bg: string; text: string; label: string }> = {
  draft: { icon: FileText, bg: "bg-gray-100", text: "text-gray-800", label: "Draft" },
  pending_review: { icon: Clock, bg: "bg-yellow-100", text: "text-yellow-800", label: "Pending Review" },
  approved: { icon: CheckCircle2, bg: "bg-emerald-100", text: "text-emerald-800", label: "Approved" },
  sent: { icon: Send, bg: "bg-sky-100", text: "text-sky-800", label: "Sent for Signature" },
  signed: { icon: CheckCircle2, bg: "bg-green-100", text: "text-green-800", label: "Signed" },
  rejected: { icon: XCircle, bg: "bg-red-100", text: "text-red-800", label: "Rejected" },
  expired: { icon: Clock, bg: "bg-orange-100", text: "text-orange-800", label: "Expired" },
  published: { icon: CheckCircle2, bg: "bg-blue-100", text: "text-blue-800", label: "Published" },
  archived: { icon: FileStack, bg: "bg-gray-100", text: "text-gray-800", label: "Archived" },
};

const DocumentHistoryPage = () => {
  const navigate = useNavigate();
  const { data: documents = [], isLoading } = useAutoDocuments();
  const { data: signatures = [] } = useDocumentESignatures();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const typeOptions = useMemo(() => {
    return Array.from(new Set(documents.map((document) => document.type))).sort();
  }, [documents]);

  const pendingSignatureCountByDocument = useMemo(() => {
    return signatures.reduce<Record<string, number>>((accumulator, signature) => {
      if (signature.status !== "pending") {
        return accumulator;
      }
      accumulator[signature.document_id] = (accumulator[signature.document_id] || 0) + 1;
      return accumulator;
    }, {});
  }, [signatures]);

  const filteredDocuments = documents.filter((document) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      (document.name || "").toLowerCase().includes(query) || (document.id || "").toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || document.status === statusFilter;
    const matchesType = typeFilter === "all" || document.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleExportList = () => {
    const headers = ["id", "name", "type", "status", "created_at"];
    const lines = filteredDocuments.map((document) =>
      [document.id, document.name, document.type, document.status, document.created_at]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = globalThis.document.createElement("a");
    link.href = url;
    link.download = "document-history.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocument = (id: string) => {
    const document = documents.find((item) => item.id === id);
    if (!document) {
      return;
    }

    const payload = document.content || JSON.stringify(document, null, 2);
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = globalThis.document.createElement("a");
    link.href = url;
    link.download = `${(document.name || "untitled").replace(/\s+/g, "-").toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document History</h1>
          <p className="text-muted-foreground">Track generated documents and signing progress.</p>
        </div>
        <Button variant="outline" onClick={handleExportList}>
          <Download className="mr-2 h-4 w-4" />
          Export List
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.keys(statusConfig).map((status) => (
              <SelectItem key={status} value={status}>
                {statusConfig[status].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {typeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                <span className="capitalize">{type}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            <FileStack className="mx-auto mb-4 h-12 w-12 animate-pulse text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">Loading documents...</h3>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="py-12 text-center">
            <FileStack className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold text-foreground">No documents found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-4 text-left font-medium text-muted-foreground">Document</th>
                  <th className="p-4 text-left font-medium text-muted-foreground">Type</th>
                  <th className="p-4 text-left font-medium text-muted-foreground">Status</th>
                  <th className="p-4 text-left font-medium text-muted-foreground">Created</th>
                  <th className="p-4 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocuments.map((document) => {
                  const status = statusConfig[document.status] || statusConfig.draft;
                  const StatusIcon = status.icon;
                  const pendingCount = pendingSignatureCountByDocument[document.id] || 0;

                  return (
                    <tr key={document.id} className="transition-colors hover:bg-secondary/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <FileStack className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{document.name || "Untitled"}</div>
                            <div className="text-sm text-muted-foreground">{document.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-block rounded-full bg-secondary px-2 py-1 text-xs font-medium capitalize text-secondary-foreground">
                          {document.type}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${status.bg} ${status.text}`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                          {pendingCount > 0 ? (
                            <span className="text-xs text-muted-foreground">{pendingCount} pending signer(s)</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3.5 w-3.5" />
                          {document.created_at ? format(new Date(document.created_at), "MMM d, yyyy") : "—"}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/documents/${document.id}/esign`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDownloadDocument(document.id)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/documents/${document.id}/esign`)}>
                            E-Sign
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentHistoryPage;
