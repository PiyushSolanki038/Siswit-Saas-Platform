import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Textarea } from "@/ui/shadcn/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/shadcn/select";
import { useAuth } from "@/core/auth/useAuth";
import { useAccounts, useContacts } from "@/modules/crm/hooks/useCRM";
import { useCreateAutoDocument, useDocumentTemplates } from "@/modules/documents/hooks/useDocuments";
import { useModuleScope } from "@/core/hooks/useModuleScope";
import type { DocumentType } from "@/core/types/documents";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  FileStack,
  FileText,
  Loader2,
  User,
} from "lucide-react";
import { FileUpload } from "@/ui/file-upload";

const steps = [
  { id: 1, title: "Select Template", icon: FileText },
  { id: 2, title: "Enter Details", icon: Building2 },
  { id: 3, title: "Review & Generate", icon: Check },
];

const DocumentCreatePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { organizationId } = useModuleScope();
  const { data: templates = [], isLoading: isTemplatesLoading } = useDocumentTemplates();
  const { data: accounts = [] } = useAccounts();
  const createDocumentMutation = useCreateAutoDocument();

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    documentName: "",
    accountId: "",
    accountName: "",
    contactId: "",
    contactName: "",
    contactEmail: "",
    effectiveDate: "",
    expiryDate: "",
    notes: "",
    filePath: "",
    fileName: "",
    fileSize: "",
  } as Record<string, string>);

  const { data: contacts = [] } = useContacts(formData.accountId || undefined);

  useEffect(() => {
    const preselectedTemplateId = searchParams.get("templateId");
    if (preselectedTemplateId) {
      setSelectedTemplateId(preselectedTemplateId);
    }
  }, [searchParams]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId),
    [selectedTemplateId, templates],
  );

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAccountChange = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId);
    setFormData((prev) => ({
      ...prev,
      accountId,
      accountName: account?.name || "",
      contactId: "",
      contactName: "",
      contactEmail: "",
    }));
  };

  const handleContactChange = (contactId: string) => {
    const contact = contacts.find((item) => item.id === contactId);
    const contactName = contact ? `${contact.first_name} ${contact.last_name}`.trim() : "";
    setFormData((prev) => ({
      ...prev,
      contactId,
      contactName,
      contactEmail: contact?.email || "",
    }));
  };

  const handleGenerateDocument = async () => {
    if (!user) {
      toast.error("You must be logged in to create documents.");
      return;
    }
    if (!selectedTemplate) {
      toast.error("Please select a template.");
      return;
    }
    if (!formData.documentName.trim()) {
      toast.error("Please enter a document name.");
      return;
    }
    if (!formData.accountId) {
      toast.error("Please select an account.");
      return;
    }

    setIsGenerating(true);

    try {
      const createdDocument = await createDocumentMutation.mutateAsync({
        name: formData.documentName.trim(),
        type: (selectedTemplate.type as DocumentType) || "other",
        status: "draft",
        template_id: selectedTemplate.id,
        related_entity_type: "account",
        related_entity_id: formData.accountId,
        generated_from: "template",
        content: JSON.stringify({
          templateName: selectedTemplate.name,
          accountId: formData.accountId,
          accountName: formData.accountName,
          contactId: formData.contactId || null,
          contactName: formData.contactName,
          contactEmail: formData.contactEmail,
          effectiveDate: formData.effectiveDate || null,
          expiryDate: formData.expiryDate || null,
          notes: formData.notes || null,
        }),
        file_path: formData.filePath || undefined,
        file_name: formData.fileName || undefined,
        file_size: formData.fileSize ? parseInt(formData.fileSize) : undefined,
      });

      navigate(`/dashboard/documents/${createdDocument.id}/esign`);
    } catch {
      // Error is surfaced through mutation toast.
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link to="/dashboard/documents" className="mb-4 inline-flex items-center text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Documents
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Create New Document</h1>
        <p className="text-muted-foreground">Generate a document from templates and send it for e-signature.</p>
      </div>

      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center gap-3 ${currentStep >= step.id ? "text-primary" : "text-muted-foreground"}`}>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  currentStep > step.id
                    ? "bg-primary text-primary-foreground"
                    : currentStep === step.id
                      ? "border-2 border-primary bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.id ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              <span className="hidden font-medium sm:block">{step.title}</span>
            </div>
            {index < steps.length - 1 ? (
              <div className={`mx-4 h-0.5 w-12 sm:w-24 ${currentStep > step.id ? "bg-primary" : "bg-border"}`} />
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        {currentStep === 1 ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Select a Template</h2>
            {isTemplatesLoading ? (
              <div className="py-10 text-center text-muted-foreground">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-muted-foreground">No templates found. Create one first to generate a document.</p>
                <Link to="/dashboard/documents/templates">
                  <Button variant="outline" className="mt-4">
                    Go to Templates
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      selectedTemplateId === template.id
                        ? "border-primary bg-primary/5 shadow-card"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">{template.name}</div>
                        <span className="mt-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          {template.type}
                        </span>
                        <p className="mt-2 text-sm text-muted-foreground">{template.description || "No description provided."}</p>
                      </div>
                      {selectedTemplateId === template.id ? (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Enter Document Details</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="documentName">Document Name</Label>
                <Input
                  id="documentName"
                  placeholder="Enter document name"
                  value={formData.documentName}
                  onChange={(event) => handleInputChange("documentName", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Account / Company</Label>
                <Select value={formData.accountId} onValueChange={handleAccountChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Contact</Label>
                <Select value={formData.contactId} onValueChange={handleContactChange} disabled={!formData.accountId}>
                  <SelectTrigger>
                    <SelectValue placeholder={formData.accountId ? "Select contact" : "Select account first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name} {contact.email ? `(${contact.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective Date</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(event) => handleInputChange("effectiveDate", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(event) => handleInputChange("expiryDate", event.target.value)}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  placeholder="Enter any additional notes or instructions"
                  value={formData.notes}
                  onChange={(event) => handleInputChange("notes", event.target.value)}
                />
              </div>

              <div className="sm:col-span-2 border-t border-border pt-6 mt-2">
                <FileUpload
                  bucket="documents"
                  organizationId={organizationId || ""}
                  onUploadComplete={(result) => {
                    handleInputChange("filePath", result.path);
                    handleInputChange("fileName", result.name);
                    handleInputChange("fileSize", result.size.toString());
                  }}
                  label="Attach File (Optional)"
                  existingFile={formData.filePath ? { name: formData.fileName, url: "#" } : null}
                  onDelete={() => {
                    handleInputChange("filePath", "");
                    handleInputChange("fileName", "");
                    handleInputChange("fileSize", "");
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {currentStep === 3 ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-foreground">Review & Generate</h2>

            <div className="space-y-4 rounded-xl border border-border p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                  <FileStack className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{formData.documentName || "Untitled Document"}</h3>
                  <p className="text-muted-foreground">Template: {selectedTemplate?.name || "Not selected"}</p>
                </div>
              </div>

              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Account</div>
                    <div className="font-medium text-foreground">{formData.accountName || "Not specified"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Contact</div>
                    <div className="font-medium text-foreground">{formData.contactName || "Not specified"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Effective Date</div>
                    <div className="font-medium text-foreground">{formData.effectiveDate || "Not specified"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Expiry Date</div>
                    <div className="font-medium text-foreground">{formData.expiryDate || "Not specified"}</div>
                  </div>
                </div>
              </div>

              {formData.notes ? (
                <div className="border-t border-border pt-4">
                  <div className="mb-1 text-sm text-muted-foreground">Notes</div>
                  <p className="text-foreground">{formData.notes}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex justify-between border-t border-border pt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentStep((prev) => prev - 1)}
            disabled={currentStep === 1 || isGenerating}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {currentStep < 3 ? (
            <Button
              onClick={() => setCurrentStep((prev) => prev + 1)}
              disabled={(currentStep === 1 && !selectedTemplateId) || (currentStep === 1 && isTemplatesLoading)}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button variant="hero" onClick={handleGenerateDocument} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileStack className="mr-2 h-4 w-4" />
                  Generate & Open E-Sign
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentCreatePage;
