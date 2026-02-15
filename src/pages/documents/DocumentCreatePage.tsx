import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, ArrowRight, ArrowLeft, Check, FileStack,
  Building2, User, Briefcase, Calendar, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCreateAutoDocument } from "@/hooks/useDocuments";
import type { DocumentType } from "@/types/documents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const templates = [
  { id: "1", name: "Sales Agreement", category: "agreement", description: "Standard sales contract for products and services" },
  { id: "2", name: "Quote Proposal", category: "proposal", description: "Professional quote template with pricing breakdown" },
  { id: "3", name: "Non-Disclosure Agreement", category: "agreement", description: "Mutual NDA for business partnerships" },
  { id: "4", name: "Service Level Agreement", category: "agreement", description: "SLA template for service providers" },
  { id: "5", name: "Invoice Template", category: "invoice", description: "Standard invoice with line items" },
];

const steps = [
  { id: 1, title: "Select Template", icon: FileText },
  { id: 2, title: "Enter Details", icon: Building2 },
  { id: 3, title: "Review & Generate", icon: Check },
];

const DocumentCreatePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createDocumentMutation = useCreateAutoDocument();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    documentName: "",
    accountName: "",
    contactName: "",
    contactEmail: "",
    effectiveDate: "",
    expiryDate: "",
    notes: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerateDocument = async () => {
    // Check authentication
    if (!user) {
      toast.error("You must be logged in to create documents");
      return;
    }

    // Validate required fields
    if (!formData.documentName) {
      toast.error("Please enter a document name");
      return;
    }
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }
    if (!formData.accountName) {
      toast.error("Please select an account");
      return;
    }

    setIsGenerating(true);

    try {
      const selectedTemplateData = templates.find((t) => t.id === selectedTemplate);
      
      // Log for debugging
      console.log("Creating document with user:", user.id);
      
      // Create document with the collected data
      await createDocumentMutation.mutateAsync({
        name: formData.documentName,
        type: (selectedTemplateData?.category as DocumentType) || "other",
        status: "draft",
        content: JSON.stringify({
          templateName: selectedTemplateData?.name,
          accountName: formData.accountName,
          contactName: formData.contactName,
          contactEmail: formData.contactEmail,
          effectiveDate: formData.effectiveDate,
          expiryDate: formData.expiryDate,
          notes: formData.notes,
        }),
      });

      // Navigate to documents list after successful creation
      setTimeout(() => {
        navigate("/dashboard/documents");
      }, 1000);
    } catch (error: any) {
      console.error("Error generating document:", error);
      
      // Provide specific error messages
      if (error?.message?.includes("row-level security")) {
        toast.error("Permission denied: Unable to create document. Please ensure you're properly authenticated.");
      } else if (error?.message?.includes("auto_documents")) {
        toast.error("Document service not available. Please contact support.");
      } else {
        toast.error("Failed to generate document. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <Link to="/dashboard/documents" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Documents
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Create New Document</h1>
          <p className="text-muted-foreground">Generate a document from a template with auto-filled data</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center gap-3 ${currentStep >= step.id ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentStep > step.id 
                    ? "bg-primary text-primary-foreground" 
                    : currentStep === step.id 
                    ? "bg-primary/20 text-primary border-2 border-primary" 
                    : "bg-muted text-muted-foreground"
                }`}>
                  {currentStep > step.id ? <Check className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                </div>
                <span className="font-medium hidden sm:block">{step.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-12 sm:w-24 h-0.5 mx-4 ${currentStep > step.id ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Select a Template</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedTemplate === template.id
                        ? "border-primary bg-primary/5 shadow-card"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-foreground">{template.name}</div>
                        <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground mt-1">
                          {template.category}
                        </span>
                        <p className="text-sm text-muted-foreground mt-2">{template.description}</p>
                      </div>
                      {selectedTemplate === template.id && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Enter Document Details</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="documentName">Document Name</Label>
                  <Input
                    id="documentName"
                    placeholder="Enter document name"
                    value={formData.documentName}
                    onChange={(e) => handleInputChange("documentName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account">Account / Company</Label>
                  <Select onValueChange={(value) => handleInputChange("accountName", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acme">Acme Corporation</SelectItem>
                      <SelectItem value="techstart">TechStart Inc</SelectItem>
                      <SelectItem value="global">Global Solutions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    placeholder="Enter contact name"
                    value={formData.contactName}
                    onChange={(e) => handleInputChange("contactName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="Enter contact email"
                    value={formData.contactEmail}
                    onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="effectiveDate">Effective Date</Label>
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => handleInputChange("effectiveDate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => handleInputChange("expiryDate", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Enter any additional notes or instructions"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Review & Generate</h2>
              
              <div className="rounded-xl border border-border p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileStack className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{formData.documentName || "Untitled Document"}</h3>
                    <p className="text-muted-foreground">Template: {selectedTemplateData?.name}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Account</div>
                      <div className="font-medium text-foreground">{formData.accountName || "Not specified"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Contact</div>
                      <div className="font-medium text-foreground">{formData.contactName || "Not specified"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Effective Date</div>
                      <div className="font-medium text-foreground">{formData.effectiveDate || "Not specified"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <div className="text-sm text-muted-foreground">Expiry Date</div>
                      <div className="font-medium text-foreground">{formData.expiryDate || "Not specified"}</div>
                    </div>
                  </div>
                </div>

                {formData.notes && (
                  <div className="pt-4 border-t border-border">
                    <div className="text-sm text-muted-foreground mb-1">Notes</div>
                    <p className="text-foreground">{formData.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              disabled={currentStep === 1 || isGenerating}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            {currentStep < 3 ? (
              <Button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                disabled={currentStep === 1 && !selectedTemplate}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                variant="hero" 
                onClick={handleGenerateDocument}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileStack className="w-4 h-4 mr-2" />
                    Generate Document
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
