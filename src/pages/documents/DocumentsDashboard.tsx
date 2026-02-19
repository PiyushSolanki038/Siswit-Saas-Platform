import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/crm/StatsCard";
import { useAutoDocuments, useDocumentESignatures } from "@/hooks/useDocuments";
import { DOCUMENT_STATUS_COLORS } from "@/types/documents";
import { ArrowRight, CheckCircle2, FilePlus, FileStack, FileText, History, Send, Zap } from "lucide-react";

const quickActions = [
  {
    icon: FilePlus,
    title: "Create Document",
    description: "Generate a new document from template",
    path: "/dashboard/documents/create",
    color: "from-primary to-primary/60",
  },
  {
    icon: FileText,
    title: "Manage Templates",
    description: "Edit and create document templates",
    path: "/dashboard/documents/templates",
    color: "from-accent to-accent/60",
  },
  {
    icon: History,
    title: "View History",
    description: "Document generation history and logs",
    path: "/dashboard/documents/history",
    color: "from-chart-3 to-chart-3/60",
  },
  {
    icon: Send,
    title: "Pending Signatures",
    description: "Documents awaiting signature",
    path: "/dashboard/documents/pending",
    color: "from-chart-4 to-chart-4/60",
  },
];

const DocumentsDashboard = () => {
  const { data: documents = [], isLoading: isDocumentsLoading } = useAutoDocuments();
  const { data: signatures = [], isLoading: isSignaturesLoading } = useDocumentESignatures();
  const isLoading = isDocumentsLoading || isSignaturesLoading;

  const pendingSignatures = signatures.filter((signature) => signature.status === "pending");
  const signedDocuments = documents.filter((document) => document.status === "signed").length;
  const automationRate =
    documents.length > 0
      ? Math.round((documents.filter((document) => document.generated_from === "template" || document.generated_from === "ai").length / documents.length) * 100)
      : 0;

  const stats = [
    { title: "Documents Generated", value: documents.length.toString(), change: "+0%", icon: FileStack },
    { title: "Pending Signatures", value: pendingSignatures.length.toString(), change: "Live", icon: Send },
    { title: "Signed Documents", value: signedDocuments.toString(), change: "Live", icon: CheckCircle2 },
    { title: "Automation Rate", value: `${automationRate}%`, change: "+0%", icon: Zap },
  ];

  const recentDocuments = documents.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Document Automation</h1>
          <p className="text-muted-foreground">Create, manage, and deliver documents at scale.</p>
        </div>
        <Link to="/dashboard/documents/create">
          <Button variant="hero">
            <FilePlus className="mr-2 h-4 w-4" />
            Create Document
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            trend={{ value: Number.parseInt(stat.change, 10) || 0, isPositive: stat.change.startsWith("+") || stat.change === "Live" }}
          />
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              to={action.path}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-card-hover"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${action.color} transition-transform group-hover:scale-110`}>
                <action.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-foreground">{action.title}</div>
                <div className="truncate text-sm text-muted-foreground">{action.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent Documents</h2>
          <Link to="/dashboard/documents/history">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading documents...</div>
          ) : recentDocuments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileStack className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <div>No documents yet. Create one to get started.</div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentDocuments.map((document) => (
                <div key={document.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-secondary/50 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileStack className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">{document.name || "Untitled Document"}</div>
                      <div className="text-sm text-muted-foreground">
                        {document.type} • {document.created_at ? formatDistanceToNow(new Date(document.created_at), { addSuffix: true }) : "Unknown"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${DOCUMENT_STATUS_COLORS[document.status]}`}>
                      {document.status}
                    </span>
                    <Link to={`/dashboard/documents/${document.id}/esign`}>
                      <Button size="sm" variant="outline">
                        <Send className="mr-1 h-3.5 w-3.5" />
                        E-Sign
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Document Workflow</h2>
        <div className="grid gap-4 sm:grid-cols-5">
          {[
            { step: "1", label: "Create", icon: FilePlus, desc: "Generate from template" },
            { step: "2", label: "Review", icon: FileText, desc: "Content verification" },
            { step: "3", label: "Approve", icon: CheckCircle2, desc: "Internal approval" },
            { step: "4", label: "Sign", icon: Send, desc: "E-signature collection" },
            { step: "5", label: "Store", icon: FileStack, desc: "Secure archival" },
          ].map((item, index) => (
            <div key={item.step} className="relative">
              <div className="rounded-xl border border-border bg-card p-4 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full gradient-primary">
                  <item.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="mb-1 font-semibold text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              {index < 4 ? (
                <div className="absolute right-[-8px] top-1/2 hidden -translate-y-1/2 sm:block">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DocumentsDashboard;
