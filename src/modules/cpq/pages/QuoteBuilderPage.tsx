import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { Package, Plus, Trash2, Calculator, Save, Send, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { useProducts, useCreateQuote, useQuote, useUpdateQuote, useQuoteItems } from "@/modules/cpq/hooks/useCPQ";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/shadcn/select";
import { Separator } from "@/ui/shadcn/separator";

interface LocalQuoteItem {
  id?: string;
  product_id: string;
  product_name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  total: number;
}

export default function QuoteBuilderPage() {
  const navigate = useNavigate();
  const { id: quoteId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const opportunityId = searchParams.get("opportunity_id");
  const accountId = searchParams.get("account_id");
  const isEditMode = !!quoteId;

  const defaultValidDate = useMemo(() => {
    const next = new Date();
    next.setDate(next.getDate() + 30);
    return next.toISOString().split("T")[0];
  }, []);

  const [quoteData, setQuoteData] = useState({
    account_id: accountId || "",
    contact_id: "",
    opportunity_id: opportunityId || "",
    valid_until: defaultValidDate,
    terms: "Net 30 days",
    notes: "",
    discount_percent: 0,
    tax_percent: 18,
  });

  const [items, setItems] = useState<LocalQuoteItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");

  const { data: existingQuote, isLoading: isLoadingQuote } = useQuote(isEditMode ? quoteId! : "");
  const { data: existingItems, isLoading: isLoadingItems } = useQuoteItems(isEditMode ? quoteId! : "");
  const { data: products } = useProducts();
  const createQuoteMutation = useCreateQuote();
  const updateQuoteMutation = useUpdateQuote();

  useEffect(() => {
    if (isEditMode && existingQuote && !isLoadingQuote) {
      setQuoteData({
        account_id: existingQuote.account_id || "",
        contact_id: existingQuote.contact_id || "",
        opportunity_id: existingQuote.opportunity_id || "",
        valid_until: existingQuote.valid_until || defaultValidDate,
        terms: existingQuote.terms || "Net 30 days",
        notes: existingQuote.notes || "",
        discount_percent: existingQuote.discount_percent || 0,
        tax_percent: existingQuote.tax_percent || 18,
      });
    }
  }, [defaultValidDate, isEditMode, existingQuote, isLoadingQuote]);

  useEffect(() => {
    if (isEditMode && existingItems && !isLoadingItems) {
      setItems(existingItems.map(item => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        total: item.total,
      })));
    }
  }, [isEditMode, existingItems, isLoadingItems]);

  const { data: accounts } = useQuery({
    queryKey: ["accounts-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, billing_address, billing_city, billing_state, billing_zip, billing_country")
        .or(`owner_id.eq.${user.id},created_by.eq.${user.id}`)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-list", quoteData.account_id, user?.id], 
    queryFn: async () => {
      if (!quoteData.account_id || !user?.id) return [];
      const { data, error } = await supabase
        .from("contacts").select("id, first_name, last_name").eq("account_id", quoteData.account_id).order("first_name");
      if (error) throw error;
      return data;
    },
    enabled: !!quoteData.account_id && !!user,
  });

  const { data: opportunities } = useQuery({
    queryKey: ["opportunities-list", quoteData.account_id, user?.id],
    queryFn: async () => {
      if (!quoteData.account_id || !user?.id) return [];
      const { data, error } = await supabase
        .from("opportunities").select("id, name, amount").eq("account_id", quoteData.account_id).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!quoteData.account_id,
  });

  const selectedAccountDetails = accounts?.find(a => a.id === quoteData.account_id);

  const handleAccountChange = (newAccountId: string) => {
    setQuoteData(prev => ({ ...prev, account_id: newAccountId, contact_id: "", opportunity_id: "" }));
  };

  const grossTotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalItemDiscounts = items.reduce((sum, item) => {
    return sum + (item.quantity * item.unit_price * (item.discount_percent / 100));
  }, 0);
  
  const subtotal = grossTotal - totalItemDiscounts; 
  const quoteDiscountAmount = subtotal * (quoteData.discount_percent / 100);
  const afterQuoteDiscount = subtotal - quoteDiscountAmount;
  const taxAmount = afterQuoteDiscount * (quoteData.tax_percent / 100);
  const grandTotal = afterQuoteDiscount + taxAmount;

  const addProduct = () => {
    const product = products?.find((p) => p.id === selectedProduct);
    if (!product) return;

    const newItem: LocalQuoteItem = {
      product_id: product.id,
      product_name: product.name,
      description: product.description || "",
      quantity: 1,
      unit_price: product.unit_price,
      discount_percent: 0,
      total: product.unit_price,
    };

    setItems([...items, newItem]);
    setSelectedProduct("");
  };

  const updateItem = (index: number, field: keyof LocalQuoteItem, value: LocalQuoteItem[keyof LocalQuoteItem]) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    const qty = item.quantity;
    const price = item.unit_price;
    const disc = item.discount_percent;
    item.total = qty * price * (1 - disc / 100);

    updated[index] = item;
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSaveQuote = (status: "draft" | "pending_approval") => {
    const quotePayload = {
      account_id: quoteData.account_id || undefined,
      contact_id: quoteData.contact_id || undefined,
      opportunity_id: quoteData.opportunity_id || undefined,
      status,
      valid_until: quoteData.valid_until || undefined,
      terms: quoteData.terms,
      notes: quoteData.notes,
      subtotal,
      discount_percent: quoteData.discount_percent,
      discount_amount: quoteDiscountAmount,
      tax_percent: quoteData.tax_percent,
      tax_amount: taxAmount,
      total: grandTotal,
    };

    if (isEditMode && quoteId) {
      updateQuoteMutation.mutate(
        { id: quoteId, ...quotePayload },
        { onSuccess: () => navigate(`/dashboard/cpq/quotes/${quoteId}`) }
      );
    } else {
      createQuoteMutation.mutate(
        { ...quotePayload, items },
        { onSuccess: (quote) => navigate(`/dashboard/cpq/quotes/${quote.id}`) }
      );
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
  };

  return (
    <div className="container mx-auto p-1 md:p-6 space-y-6">
      {/* Header - Stacked on mobile */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{isEditMode ? "Edit Quote" : "Create Quote"}</h1>
            <p className="text-sm text-muted-foreground">Build a professional quote for your customer</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="flex-1 sm:flex-none" 
            onClick={() => handleSaveQuote("draft")} 
            disabled={createQuoteMutation.isPending || updateQuoteMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{isEditMode ? "Save Changes" : "Save Draft"}</span>
            <span className="sm:hidden">Draft</span>
          </Button>
          <Button 
            className="flex-1 sm:flex-none" 
            onClick={() => handleSaveQuote("pending_approval")} 
            disabled={(createQuoteMutation.isPending || updateQuoteMutation.isPending) || (!isEditMode && items.length === 0)}
          >
            <Send className="h-4 w-4 mr-2" />
            <span>Submit</span>
          </Button>
        </div>
      </div>

      {isLoadingQuote || isLoadingItems ? (
        <div className="animate-pulse space-y-6"><div className="h-64 bg-muted rounded" /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Quote Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Account</Label>
                    <Select value={quoteData.account_id} onValueChange={handleAccountChange}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts?.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {selectedAccountDetails && (
                      <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded-md">
                        <p className="font-medium">Bill To: {selectedAccountDetails.billing_address}</p>
                        <p>{selectedAccountDetails.billing_city}, {selectedAccountDetails.billing_state}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Contact</Label>
                    <Select value={quoteData.contact_id} onValueChange={(v) => setQuoteData({ ...quoteData, contact_id: v })} disabled={!quoteData.account_id}>
                      <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                      <SelectContent>
                        {contacts?.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Opportunity</Label>
                    <Select value={quoteData.opportunity_id} onValueChange={(v) => setQuoteData({ ...quoteData, opportunity_id: v })} disabled={!quoteData.account_id}>
                      <SelectTrigger><SelectValue placeholder="Select opportunity" /></SelectTrigger>
                      <SelectContent>
                        {opportunities?.map((opp) => <SelectItem key={opp.id} value={opp.id}>{opp.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Valid Until</Label>
                    <Input type="date" value={quoteData.valid_until} onChange={(e) => setQuoteData({ ...quoteData, valid_until: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Products & Services</CardTitle></CardHeader>
              <CardContent className="space-y-4 px-2 sm:px-6">
                <div className="flex gap-2">
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Add product..." /></SelectTrigger>
                    <SelectContent>
                      {products?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} - {formatCurrency(p.unit_price)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addProduct} disabled={!selectedProduct} size="icon"><Plus className="h-4 w-4" /></Button>
                </div>
                <Separator />
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-2 opacity-20" />No products added</div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <div key={index} className="p-3 sm:p-4 rounded-lg border bg-card space-y-3">
                        <div className="flex justify-between items-start">
                          <h4 className="font-medium text-sm sm:text-base">{item.product_name}</h4>
                          <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 -mt-1"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
                            <Input type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">Price</Label>
                            <Input type="number" value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">Disc %</Label>
                            <Input type="number" value={item.discount_percent} onChange={(e) => updateItem(index, "discount_percent", parseFloat(e.target.value) || 0)} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">Total</Label>
                            <div className="h-9 flex items-center font-bold text-xs sm:text-sm">{formatCurrency(item.total)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar / Bottom Summary */}
          <div className="space-y-6">
            <Card className="lg:sticky lg:top-6">
              <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Summary</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Gross Amount</span>
                    <span>{formatCurrency(grossTotal)}</span>
                  </div>
                  {totalItemDiscounts > 0 && (
                    <div className="flex justify-between text-sm text-destructive italic">
                      <span>Product Discounts</span>
                      <span>-{formatCurrency(totalItemDiscounts)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-sm font-medium">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Addl. Disc %</Label>
                      <Input type="number" value={quoteData.discount_percent} onChange={(e) => setQuoteData({ ...quoteData, discount_percent: parseFloat(e.target.value) || 0 })} className="h-7 w-14 text-xs" />
                    </div>
                    <span className="text-sm text-destructive">-{formatCurrency(quoteDiscountAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Tax (GST) %</Label>
                      <Input type="number" value={quoteData.tax_percent} onChange={(e) => setQuoteData({ ...quoteData, tax_percent: parseFloat(e.target.value) || 0 })} className="h-7 w-14 text-xs" />
                    </div>
                    <span className="text-sm">+{formatCurrency(taxAmount)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold text-primary">
                    <span>Grand Total</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
                <div className="space-y-2 pt-2">
                  <Button className="w-full h-11" onClick={() => handleSaveQuote("pending_approval")} disabled={(createQuoteMutation.isPending || updateQuoteMutation.isPending) || (!isEditMode && items.length === 0)}>Submit Quote</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

