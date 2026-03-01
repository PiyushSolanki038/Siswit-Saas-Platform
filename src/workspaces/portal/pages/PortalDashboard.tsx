"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/core/auth/useAuth";
import { supabase } from "@/core/api/client";
import {
  FileText,
  FileSignature,
  FileStack,
  Quote,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface QuickAction {
  icon: typeof Quote;
  title: string;
  description: string;
  route: string;
}

const quickActions: QuickAction[] = [
  {
    icon: Quote,
    title: "View My Quotes",
    description: "Check status of your quotes",
    route: "/portal/quotes",
  },
  {
    icon: FileSignature,
    title: "My Contracts",
    description: "View active contracts",
    route: "/portal/contracts",
  },
  {
    icon: FileStack,
    title: "My Documents",
    description: "Access your documents",
    route: "/portal/documents",
  },
  {
    icon: FileText,
    title: "Pending Signatures",
    description: "Documents waiting for your signature",
    route: "/portal/pending-signatures",
  },
];

const PortalDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dataLoading, setDataLoading] = useState(true);
  const [stats, setStats] = useState({
    quotes: 0,
    contracts: 0,
    documents: 0,
    pendingSignatures: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.email) return;
      setDataLoading(true);

      try {
        const userEmail = user.email;
        const userId = user.id;

        // Fetch quotes for this user
        const quotesRes = await supabase
          .from("quotes")
          .select("id", { count: "exact" })
          .eq("customer_email", userEmail);

        // Fetch contracts for this user
        const contractsRes = await supabase
          .from("contracts")
          .select("id", { count: "exact" })
          .eq("customer_email", userEmail);

        // Fetch documents for this user
        const docsRes = await supabase
          .from("auto_documents")
          .select("id", { count: "exact" })
          .eq("created_by", userId);

        // Fetch pending signatures (using contract_esignatures table)
        const pendingRes = await supabase
          .from("contract_esignatures")
          .select("id", { count: "exact" })
          .eq("signer_email", userEmail)
          .eq("status", "pending");

        setStats({
          quotes: quotesRes.count ?? 0,
          contracts: contractsRes.count ?? 0,
          documents: docsRes.count ?? 0,
          pendingSignatures: pendingRes.count ?? 0,
        });
      } catch {
        // Silently handle error fetching stats
      } finally {
        setDataLoading(false);
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user]);

  if (authLoading || (dataLoading && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const firstName =
    user.user_metadata?.first_name ||
    user.email?.split("@")[0] ||
    "User";

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-16 space-y-8">
        {/* HERO */}
        <section className="container mx-auto px-4 md:px-6">
          <div className="rounded-2xl p-5 md:p-8 bg-gradient-to-br from-primary/10 to-background border border-border">
            <h1 className="text-2xl md:text-3xl font-bold">
              Welcome back, {firstName} 👋
            </h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Manage your quotes, contracts, and documents all in one place.
            </p>
          </div>
        </section>

        {/* STATS */}
        <section className="container mx-auto px-4 md:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="p-4 md:p-5 rounded-xl bg-card border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Quote className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold">{stats.quotes}</div>
            <div className="text-xs md:text-sm text-muted-foreground">
              My Quotes
            </div>
          </div>

          <div className="p-4 md:p-5 rounded-xl bg-card border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-accent/10">
                <FileSignature className="w-5 h-5 text-accent" />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold">{stats.contracts}</div>
            <div className="text-xs md:text-sm text-muted-foreground">
              Active Contracts
            </div>
          </div>

          <div className="p-4 md:p-5 rounded-xl bg-card border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-chart-4/10">
                <FileStack className="w-5 h-5 text-chart-4" />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold">{stats.documents}</div>
            <div className="text-xs md:text-sm text-muted-foreground">
              Documents
            </div>
          </div>

          <div className="p-4 md:p-5 rounded-xl bg-card border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <FileText className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <div className="text-xl md:text-2xl font-bold">{stats.pendingSignatures}</div>
            <div className="text-xs md:text-sm text-muted-foreground">
              Pending Signatures
            </div>
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section className="container mx-auto px-4 md:px-6">
          <h2 className="text-lg md:text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <button
                key={action.title}
                onClick={() => navigate(action.route)}
                className="p-4 rounded-xl border bg-card flex items-center gap-3 hover:shadow-md transition group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <action.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-sm">{action.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {action.description}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default PortalDashboard;
