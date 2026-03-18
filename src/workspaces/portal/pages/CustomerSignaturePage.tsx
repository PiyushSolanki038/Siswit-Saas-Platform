"use client";

import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileSignature, CheckCircle2, Clock, XCircle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Badge } from "@/ui/shadcn/badge";
import { Separator } from "@/ui/shadcn/separator";
import { supabase } from "@/core/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CustomerSignaturePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: signature, isLoading } = useQuery({
    queryKey: ["portal-signature", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("Signature ID is required");
      const { data, error } = await supabase
        .from("contract_esignatures")
        .select("*, contracts:contracts(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const signMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const { error } = await supabase
        .from("contract_esignatures")
        .update({ status: "signed", signed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document signed successfully");
      queryClient.invalidateQueries({ queryKey: ["portal-signature", id] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const { error } = await supabase
        .from("contract_esignatures")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document signature rejected");
      queryClient.invalidateQueries({ queryKey: ["portal-signature", id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!signature) {
    return (
      <div className="text-center py-12">
        <FileSignature className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Signature request not found</h2>
        <Button variant="link" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  const isPending = signature.status === "pending";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Document Signature</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{signature.contracts?.name || "Contract"}</CardTitle>
              <CardDescription>Request sent on {signature.created_at ? format(new Date(signature.created_at), "PPP") : "—"}</CardDescription>
            </div>
            <Badge variant={isPending ? "outline" : "secondary"} className={signature.status === "signed" ? "bg-success/20 text-success-foreground" : ""}>
              {(signature.status || "pending").charAt(0).toUpperCase() + (signature.status || "pending").slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" /> Document Preview
            </h3>
            <div className="max-h-[400px] overflow-y-auto rounded border bg-background p-4 text-sm prose prose-sm dark:prose-invert">
              {signature.contracts?.content ? (
                <pre className="whitespace-pre-wrap font-sans">{signature.contracts.content}</pre>
              ) : (
                <p className="text-muted-foreground italic">No content preview available for this document.</p>
              )}
            </div>
          </div>

          <Separator />

          {isPending ? (
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Clock className="h-4 w-4" /> Pending your signature
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="text-destructive" onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending || signMutation.isPending}>
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
                <Button onClick={() => signMutation.mutate()} disabled={signMutation.isPending || rejectMutation.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Sign Document
                </Button>
              </div>
            </div>
          ) : signature.status === "signed" ? (
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 flex items-center gap-3 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <div>
                <p className="font-semibold">Document Signed</p>
                <p className="text-sm">You signed this document on {signature.signed_at ? format(new Date(signature.signed_at), "PPP p") : "—"}</p>
              </div>
            </div>
          ) : (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3 text-destructive">
              <XCircle className="h-5 w-5" />
              <div>
                <p className="font-semibold">Signature Rejected</p>
                <p className="text-sm">This signature request was rejected.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
