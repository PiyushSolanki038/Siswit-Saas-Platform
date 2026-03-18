"use client";

import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Building, User, Calendar, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Badge } from "@/ui/shadcn/badge";
import { Separator } from "@/ui/shadcn/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";
import { supabase } from "@/core/api/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  pending_approval: { label: "Pending Approval", color: "bg-warning/20 text-warning-foreground" },
  approved: { label: "Approved", color: "bg-info/20 text-info-foreground" },
  rejected: { label: "Rejected", color: "bg-destructive/20 text-destructive" },
  sent: { label: "Sent", color: "bg-primary/20 text-primary" },
  accepted: { label: "Accepted", color: "bg-success/20 text-success-foreground" },
  expired: { label: "Expired", color: "bg-destructive/20 text-destructive" },
};

export default function CustomerQuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: quote, isLoading: isQuoteLoading } = useQuery({
    queryKey: ["portal-quote", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("ID required");
      const { data, error } = await supabase
        .from("quotes")
        .select("*, accounts:accounts(name), contacts:contacts(first_name, last_name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: quoteItems, isLoading: isItemsLoading } = useQuery({
    queryKey: ["portal-quote-items", id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("ID required");
      const { data, error } = await supabase
        .from("quote_line_items")
        .select("*")
        .eq("quote_id", id);
      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
  };

  if (isQuoteLoading || isItemsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Quote not found</h2>
        <Button variant="link" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[quote.status || "draft"] || STATUS_CONFIG.draft;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{quote.quote_number || "Quote Detail"}</h1>
              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
            </div>
            <p className="text-muted-foreground">Issued on {quote.created_at ? format(new Date(quote.created_at), "MMMM d, yyyy") : "—"}</p>
          </div>
        </div>
        <Button variant="outline" disabled>
          <Download className="h-4 w-4 mr-2" />Download PDF
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Account</p>
                    <p className="font-medium">{quote.accounts?.name || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Contact</p>
                    <p className="font-medium">{quote.contacts ? `${quote.contacts.first_name} ${quote.contacts.last_name}` : "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Valid Until</p>
                    <p className="font-medium">{quote.expiration_date ? format(new Date(quote.expiration_date), "MMMM d, yyyy") : "—"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quoteItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price || 0)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(quote.subtotal || 0)}</span>
                </div>
                {!!quote.discount_amount && quote.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span className="text-muted-foreground">Discount ({quote.discount_percent}%)</span>
                    <span>-{formatCurrency(quote.discount_amount || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({quote.tax_percent}%)</span>
                  <span>+{formatCurrency(quote.tax_amount || 0)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(quote.total_amount || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
