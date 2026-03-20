import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { FileText, Save, Send, ArrowLeft, Building, User, Calendar, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Textarea } from "@/ui/shadcn/textarea";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { useContractTemplates, useCreateContract } from "@/modules/clm/hooks/useCLM";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/shadcn/select";
import { toast } from "sonner";
import { Separator } from "@/ui/shadcn/separator";
import { Badge } from "@/ui/shadcn/badge";
import { type ContractStatus } from "@/core/types/clm";


export default function ContractBuilderPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const quoteId = searchParams.get("quote_id");


  const [contractData, setContractData] = useState({
    name: "",
    account_id: "",
    contact_id: "",
    quote_id: quoteId || "",
    template_id: "",
    start_date: "",
    end_date: "",
    value: 0,
    content: "",
  });

  // Fetch quote details if converting from quote - UPDATED: Filter by current user
  const { data: quote } = useQuery({
    queryKey: ["quote-for-contract", quoteId, user?.id],
    enabled: !!quoteId && !!user,
    queryFn: async () => {
      if (!quoteId || !user?.id) return null;
      const { data, error } = await supabase
        .from("quotes")
        .select("*, accounts(id, name), contacts(id, first_name, last_name), opportunities(name)")
        .eq("id", quoteId)
        .or(`owner_id.eq.${user.id},created_by.eq.${user.id}`)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Pre-fill from quote
  useEffect(() => {
    if (quote) {
      setContractData((prev) => ({
        ...prev,
        name: `Contract for ${quote.accounts?.name || "Customer"}`,
        account_id: quote.account_id || "",
        contact_id: quote.contact_id || "",
        value: quote.total_amount || 0,
      }));
    }
  }, [quote]);
  // Use standardized hooks
  const { data: templates } = useContractTemplates();
  const createContract = useCreateContract();

  // Legacy manual queries for accounts/contacts (keeping for now to avoid cross-module complexity, but scoping to current user/tenant)
  const { data: accounts } = useQuery({
    queryKey: ["accounts-list", tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts-list", contractData.account_id],
    enabled: !!contractData.account_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("account_id", contractData.account_id)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Apply template content
  const applyTemplate = (templateId: string) => {
    const template = templates?.find((t) => t.id === templateId);
    if (template) {
      setContractData((prev) => ({
        ...prev,
        template_id: templateId,
        content: template.content || "",
      }));
    }
  };

  const handleCreate = (status: ContractStatus) => {
    createContract.mutate({
      ...contractData,
      status,
      value: contractData.value || 0,
    }, {
      onSuccess: (data) => {
        toast.success("Contract created successfully");
        navigate(`/${tenantSlug}/app/clm/contracts/${data.id}`);
      }
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Contract</h1>
            <p className="text-muted-foreground">
              {quoteId ? "Converting approved quote to contract" : "Create a new contract from template"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleCreate("draft")} disabled={createContract.isPending || !contractData.name}>
            <Save className="h-4 w-4 mr-2" />Save Draft
          </Button>
          <Button onClick={() => handleCreate("pending_review")} disabled={createContract.isPending || !contractData.name}>
            <Send className="h-4 w-4 mr-2" />Submit for Review
          </Button>
        </div>
      </div>

      {/* Quote Info Banner */}
      {quote && (
        <Card className="bg-info/10 border-info/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <FileText className="h-8 w-8 text-info" />
                <div>
                  <p className="font-medium">Converting from Quote: {quote.quote_number}</p>
                  <p className="text-sm text-muted-foreground">{quote.accounts?.name} • {quote.opportunities?.name}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-lg">{formatCurrency(quote.total_amount || 0)}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Contract Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contract Details</CardTitle>
              <CardDescription>Basic information about the contract</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contract Name *</Label>
                <Input value={contractData.name} onChange={(e) => setContractData({ ...contractData, name: e.target.value })} placeholder="e.g., Annual SaaS License Agreement" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select value={contractData.account_id} onValueChange={(v) => setContractData({ ...contractData, account_id: v, contact_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map((acc) => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Contact</Label>
                  <Select value={contractData.contact_id} onValueChange={(v) => setContractData({ ...contractData, contact_id: v })} disabled={!contractData.account_id}>
                    <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                    <SelectContent>
                      {contacts?.map((c) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Contract Value</Label>
                  <Input type="number" value={contractData.value} onChange={(e) => setContractData({ ...contractData, value: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={contractData.start_date} onChange={(e) => setContractData({ ...contractData, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={contractData.end_date} onChange={(e) => setContractData({ ...contractData, end_date: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Contract Template</CardTitle>
              <CardDescription>Select a template or write custom content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <Select value={contractData.template_id} onValueChange={applyTemplate}>
                  <SelectTrigger><SelectValue placeholder="Select a template (optional)" /></SelectTrigger>
                  <SelectContent>
                    {templates?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <span>{t.name}</span>
                          <Badge variant="outline">{t.type}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contract Content</Label>
                <Textarea value={contractData.content} onChange={(e) => setContractData({ ...contractData, content: e.target.value })} placeholder="Enter contract terms and conditions..." rows={15} className="font-mono text-sm" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Contract Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Account</p>
                    <p className="font-medium">{accounts?.find((a) => a.id === contractData.account_id)?.name || "Not selected"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Contact</p>
                    <p className="font-medium">
                      {contacts?.find((c) => c.id === contractData.contact_id)
                        ? `${contacts.find((c) => c.id === contractData.contact_id)?.first_name} ${contacts.find((c) => c.id === contractData.contact_id)?.last_name}`
                        : "Not selected"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Value</p>
                    <p className="font-medium text-lg">{formatCurrency(contractData.value)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium">{contractData.start_date && contractData.end_date ? `${contractData.start_date} to ${contractData.end_date}` : "Not set"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Button className="w-full" onClick={() => handleCreate("pending_review")} disabled={createContract.isPending || !contractData.name}>
                  <Send className="h-4 w-4 mr-2" />Submit for Review
                </Button>
                <Button variant="outline" className="w-full" onClick={() => handleCreate("draft")} disabled={createContract.isPending || !contractData.name}>
                  <Save className="h-4 w-4 mr-2" />Save as Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

