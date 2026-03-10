import { useParams, useNavigate, Link } from "react-router-dom";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { ArrowLeft, Download, Send, CheckCircle, XCircle, Edit, ArrowRight, FileText, Clock, Building, User, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Badge } from "@/ui/shadcn/badge";
import { useQuote, useQuoteItems, useUpdateQuoteStatus } from "@/modules/cpq/hooks/useCPQ";
import { format } from "date-fns";
import { Separator } from "@/ui/shadcn/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/shadcn/table";
import { QuotePDFTemplate } from "@/modules/cpq/components/QuotePDFTemplate";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  pending_approval: { label: "Pending Approval", color: "bg-warning/20 text-warning-foreground" },
  approved: { label: "Approved", color: "bg-info/20 text-info-foreground" },
  rejected: { label: "Rejected", color: "bg-destructive/20 text-destructive" },
  sent: { label: "Sent", color: "bg-primary/20 text-primary" },
  accepted: { label: "Accepted", color: "bg-success/20 text-success-foreground" },
  expired: { label: "Expired", color: "bg-destructive/20 text-destructive" },
};

export default function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const componentRef = useRef<HTMLDivElement>(null);

  const { data: quote, isLoading } = useQuote(id || "");
  const { data: quoteItems } = useQuoteItems(id || "");
  const updateStatusMutation = useUpdateQuoteStatus();

  // PDF Print Logic
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Quote_${quote?.quote_number || "Draft"}`,
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Quote not found</h2>
        <Button variant="link" onClick={() => navigate("/dashboard/cpq/quotes")}>Go back to quotes</Button>
      </div>
    );
  }

  // Calculation Logic for UI Consistency
  const grossAmount = quoteItems?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) || 0;
  const totalItemDiscounts = quoteItems?.reduce((sum, item) => {
    return sum + (item.quantity * item.unit_price * ((item.discount_percent ?? 0) / 100));
  }, 0) || 0;

  const statusConfig = STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{quote.quote_number || "Quote"}</h1>
              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
            </div>
            <p className="text-muted-foreground">Created on {format(new Date(quote.created_at), "MMMM d, yyyy")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {quote.status === "draft" && (
            <>
              <Button variant="outline" onClick={() => navigate(`/dashboard/cpq/quotes/${id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" />Edit
              </Button>
              <Button onClick={() => updateStatusMutation.mutate({ id: id || "", status: "pending_approval" })}>
                <Send className="h-4 w-4 mr-2" />Submit for Approval
              </Button>
            </>
          )}
          {quote.status === "pending_approval" && (
            <>
              <Button variant="outline" onClick={() => updateStatusMutation.mutate({ id: id || "", status: "rejected" })}>
                <XCircle className="h-4 w-4 mr-2" />Reject
              </Button>
              <Button onClick={() => updateStatusMutation.mutate({ id: id || "", status: "approved" })}>
                <CheckCircle className="h-4 w-4 mr-2" />Approve
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Download className="h-4 w-4 mr-2" />Export PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader><CardTitle>Customer Information</CardTitle></CardHeader>
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
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Opportunity</p>
                    <p className="font-medium">{quote.opportunities?.name || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Valid Until</p>
                    <p className="font-medium">{quote.valid_until ? format(new Date(quote.valid_until), "MMMM d, yyyy") : "—"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
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
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right text-destructive">-{item.discount_percent ?? 0}%</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.total || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Updated Summary Sidebar */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader><CardTitle>Quote Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gross Amount</span>
                  <span>{formatCurrency(grossAmount)}</span>
                </div>

                {totalItemDiscounts > 0 && (
                  <div className="flex justify-between text-sm text-destructive italic">
                    <span className="text-muted-foreground">Product Discounts</span>
                    <span>-{formatCurrency(totalItemDiscounts)}</span>
                  </div>
                )}

                <Separator />

                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(quote.subtotal || 0)}</span>
                </div>

                <div className="flex justify-between text-sm text-destructive">
                  <span className="text-muted-foreground">Extra Discount ({quote.discount_percent}%)</span>
                  <span>-{formatCurrency(quote.discount_amount || 0)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({quote.tax_percent}%)</span>
                  <span>+{formatCurrency(quote.tax_amount || 0)}</span>
                </div>

                <Separator className="my-2" />

                <div className="flex justify-between text-lg font-bold">
                  <span>Grand Total</span>
                  <span className="text-primary">{formatCurrency(quote.total || 0)}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Created:</span>
                  <span>{format(new Date(quote.created_at), "MMM d, yyyy")}</span>
                </div>
              </div>

              {quote.status === "approved" && (
                <Button className="w-full" asChild>
                  <Link to={`/dashboard/clm/contracts/new?quote_id=${quote.id}`}>
                    <ArrowRight className="h-4 w-4 mr-2" />Convert to Contract
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden Print Template */}
      <div className="hidden">
        <QuotePDFTemplate
          ref={componentRef}
          quote={quote}
          items={quoteItems || []}
        />
      </div>
    </div>
  );
}
