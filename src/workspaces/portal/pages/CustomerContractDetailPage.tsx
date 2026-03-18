"use client";

import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Download, Calendar, DollarSign, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Badge } from "@/ui/shadcn/badge";
import { Separator } from "@/ui/shadcn/separator";
import { supabase } from "@/core/api/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  pending_review: { label: "Pending Review", color: "bg-warning/20 text-warning-foreground" },
  active: { label: "Active", color: "bg-success/20 text-success-foreground" },
  signed: { label: "Signed", color: "bg-info/20 text-info-foreground" },
  expired: { label: "Expired", color: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground" },
};

export default function CustomerContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: contract, isLoading } = useQuery({
    queryKey: ["portal-contract", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("ID required");
      const { data, error } = await supabase
        .from("contracts")
        .select("*, accounts:accounts(name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value || 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Contract not found</h2>
        <Button variant="link" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[contract.status || "draft"] || STATUS_CONFIG.draft;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{contract.contract_number || contract.name || "Contract Detail"}</h1>
              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
            </div>
            <p className="text-muted-foreground">Effective {contract.start_date ? format(new Date(contract.start_date), "MMMM d, yyyy") : "TBD"}</p>
          </div>
        </div>
        <Button variant="outline" disabled>
          <Download className="h-4 w-4 mr-2" />Download PDF
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>General Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium">
                      {contract.start_date ? format(new Date(contract.start_date), "MMM d, yyyy") : "—"} to {contract.end_date ? format(new Date(contract.end_date), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="font-medium">{formatCurrency(contract.total_value || contract.value)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contract Terms</CardTitle></CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                {contract.content ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm">{contract.content}</pre>
                ) : (
                  <p className="text-muted-foreground italic">No content available for preview.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Status Detail</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Status</span>
                <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
              </div>
              <Separator />
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Updated:</span>
                <span>{contract.updated_at ? format(new Date(contract.updated_at), "MMM d, yyyy") : "—"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
