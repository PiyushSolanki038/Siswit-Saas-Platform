import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAutoDocuments,
  useCreateDocumentTemplate,
  useDeleteDocumentTemplate,
  useDocumentTemplates,
  useUpdateDocumentTemplate,
} from "@/hooks/useDocuments";
import type { DocumentTemplate, DocumentType } from "@/types/documents";
import { toast } from "sonner";
import { Clock, Copy, Edit, FileStack, FileText, MoreVertical, Plus, Search, Trash2, User } from "lucide-react";

const templateTypes: DocumentType[] = ["proposal", "invoice", "agreement", "report", "policy", "manual", "other"];

const emptyFormState = {
  name: "",
  type: "other" as DocumentType,
  description: "",
  content: "",
  is_public: false,
};

const DocumentTemplatesPage = () => {
  const navigate = useNavigate();
  const { data: templates = [], isLoading } = useDocumentTemplates();
  const { data: documents = [] } = useAutoDocuments();
  const createTemplateMutation = useCreateDocumentTemplate();
  const updateTemplateMutation = useUpdateDocumentTemplate();
  const deleteTemplateMutation = useDeleteDocumentTemplate();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | DocumentType>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyFormState);

  const usageByTemplate = useMemo(() => {
    return documents.reduce<Record<string, number>>((accumulator, document) => {
      if (!document.template_id) {
        return accumulator;
      }
      accumulator[document.template_id] = (accumulator[document.template_id] || 0) + 1;
      return accumulator;
    }, {});
  }, [documents]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        template.name.toLowerCase().includes(query) ||
        (template.description || "").toLowerCase().includes(query);
      const matchesType = selectedType === "all" || template.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [searchQuery, selectedType, templates]);

  const handleOpenCreateDialog = () => {
    setEditingTemplateId(null);
    setFormData(emptyFormState);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (template: DocumentTemplate) => {
    setEditingTemplateId(template.id);
    setFormData({
      name: template.name,
      type: template.type,
      description: template.description || "",
      content: template.content || "",
      is_public: Boolean(template.is_public),
    });
    setIsDialogOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!formData.name.trim()) {
      toast.error("Template name is required.");
      return;
    }
    if (!formData.content.trim()) {
      toast.error("Template content is required.");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      description: formData.description.trim() || undefined,
      content: formData.content,
      is_public: formData.is_public,
      is_active: true,
    };

    try {
      if (editingTemplateId) {
        await updateTemplateMutation.mutateAsync({
          id: editingTemplateId,
          ...payload,
        });
      } else {
        await createTemplateMutation.mutateAsync(payload);
      }

      setIsDialogOpen(false);
    } catch {
      // Error toast is handled in the mutation hook.
    }
  };

  const handleDuplicateTemplate = async (template: DocumentTemplate) => {
    try {
      await createTemplateMutation.mutateAsync({
        name: `${template.name} Copy`,
        type: template.type,
        description: template.description,
        content: template.content,
        variables: template.variables,
        is_public: Boolean(template.is_public),
        is_active: template.is_active ?? true,
      });
    } catch {
      // Error toast is handled in the mutation hook.
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const shouldDelete = globalThis.confirm("Delete this template? This action cannot be undone.");
    if (!shouldDelete) {
      return;
    }
    try {
      await deleteTemplateMutation.mutateAsync(templateId);
    } catch {
      // Error toast is handled in the mutation hook.
    }
  };

  function formatRelativeTime(updated_at: string): string {
    const now = new Date();
    const updated = new Date(updated_at);
    const diffMs = now.getTime() - updated.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document Templates</h1>
          <p className="text-muted-foreground">Manage reusable templates used to generate production documents.</p>
        </div>
        <Button variant="hero" onClick={handleOpenCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={selectedType === "all" ? "default" : "outline"}
            onClick={() => setSelectedType("all")}
          >
            All
          </Button>
          {templateTypes.map((type) => (
            <Button
              key={type}
              size="sm"
              variant={selectedType === type ? "default" : "outline"}
              onClick={() => setSelectedType(type)}
              className="capitalize"
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          Loading templates...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">No templates found</h3>
          <p className="mb-4 text-muted-foreground">Try changing filters or create a new template.</p>
          <Button variant="outline" onClick={() => { setSearchQuery(""); setSelectedType("all"); }}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-card-hover"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="opacity-0 transition-opacity group-hover:opacity-100">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenEditDialog(template)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteTemplate(template.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <h3 className="mb-2 font-semibold text-foreground">{template.name}</h3>
              <span className="mb-4 inline-block rounded-full bg-secondary px-2 py-1 text-xs font-medium capitalize text-secondary-foreground">
                {template.type}
              </span>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileStack className="h-4 w-4" />
                  <span>{usageByTemplate[template.id] || 0} documents generated</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Updated {formatRelativeTime(template.updated_at)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{template.is_public ? "Shared template" : "Private template"}</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenEditDialog(template)}>
                  <Edit className="mr-1 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate(`/dashboard/documents/create?templateId=${template.id}`)}
                >
                  Use Template
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTemplateId ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>
              Configure template content and visibility for document generation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="templateName">Name</Label>
              <Input
                id="templateName"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Template name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="templateType">Type</Label>
              <select
                id="templateType"
                value={formData.type}
                onChange={(event) => setFormData((prev) => ({ ...prev, type: event.target.value as DocumentType }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background"
              >
                {templateTypes.map((type) => (
                  <option key={type} value={type}>
+                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="templateDescription">Description</Label>
              <Input
                id="templateDescription"
                value={formData.description}
                onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="What this template is used for"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="templateContent">Template Content</Label>
              <Textarea
                id="templateContent"
                rows={10}
                value={formData.content}
                onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="Enter template body with placeholders if needed"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="templatePublic"
                checked={formData.is_public}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_public: checked === true }))
                }
              />
              <Label htmlFor="templatePublic">Make this template visible to all users</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {editingTemplateId ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentTemplatesPage;
