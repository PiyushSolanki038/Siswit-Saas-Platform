import { useState, type ReactNode } from "react";
import { Lock, ArrowLeft, Sparkles, ShieldAlert } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import { usePlanLimits } from "@/core/hooks/usePlanLimits";
import { UpgradePrompt } from "@/ui/upgrade-prompt";
import { useAuth } from "@/core/auth/useAuth";
import { isTenantUserRole } from "@/core/types/roles";
import type { ModuleType } from "@/core/types/modules";
import { useNavigate } from "react-router-dom";

interface ModuleGateProps {
  module: ModuleType;
  children: ReactNode;
  /** Optional custom label for the module (defaults to uppercased moduleId) */
  moduleLabel?: string;
}

const MODULE_LABELS: Record<ModuleType, string> = {
  crm: "Customer Relationship Management (CRM)",
  cpq: "Configure, Price, Quote (CPQ)",
  clm: "Contract Lifecycle Management (CLM)",
  erp: "Enterprise Resource Planning (ERP)",
  documents: "Document Automation",
};

const MODULE_DESCRIPTIONS: Record<ModuleType, string> = {
  crm: "Manage leads, contacts, accounts, opportunities, and pipeline with advanced CRM tools.",
  cpq: "Create products, build quotes, configure pricing, and close deals faster.",
  clm: "Draft, manage, and e-sign contracts with full lifecycle tracking.",
  erp: "Manage inventory, procurement, production, and finance in one place.",
  documents: "Automate document generation, templates, and digital signatures.",
};

/**
 * ModuleGate
 * 
 * Wraps module pages. If the organization's subscription does not include
 * the specified module, renders a premium "Module Locked" page instead
 * of the children. Otherwise, renders children normally.
 * 
 * For employees, shows "ask your admin" messaging.
 * For admins/owners, shows upgrade options.
 */
export function ModuleGate({ module, children, moduleLabel }: ModuleGateProps) {
  const { hasModule } = useOrganization();
  const { role } = useAuth();
  const { planType } = usePlanLimits();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const navigate = useNavigate();

  const isEmployee = isTenantUserRole(role);

  // If module is enabled, render children directly
  if (hasModule(module)) {
    return <>{children}</>;
  }

  // Module is locked — render the premium locked page
  const label = moduleLabel || MODULE_LABELS[module] || module.toUpperCase();
  const description = MODULE_DESCRIPTIONS[module] || "This module is not included in your current plan.";

  return (
    <>
      <div className="relative flex flex-col items-center justify-center min-h-[70vh] text-center px-6 animate-in fade-in duration-500">
        {/* Atmospheric glows */}
        <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-purple-600/8 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] bg-blue-600/5 blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-lg space-y-8">
          {/* Lock Icon */}
          <div className="mx-auto w-24 h-24 rounded-[2rem] bg-card/40 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl">
            <Lock className="w-10 h-10 text-muted-foreground/50" />
          </div>

          {/* Title */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {label}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
              {description}
            </p>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-wider">
            <Lock className="w-3 h-3" />
            Not included in your plan
          </div>

          {/* Employee vs Admin messaging */}
          {isEmployee ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-card/50 backdrop-blur-sm border border-white/10">
                <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0" />
                <p className="text-sm text-muted-foreground text-left">
                  This module requires a plan upgrade. Please contact your{" "}
                  <span className="text-foreground font-semibold">organization admin</span>{" "}
                  to upgrade the subscription plan.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                className="min-w-[140px] rounded-xl font-bold border-white/10 hover:bg-white/5"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                onClick={() => setUpgradeOpen(true)}
                className="min-w-[180px] rounded-xl font-bold"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                View Upgrade Plans
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                className="min-w-[140px] rounded-xl font-bold border-white/10 hover:bg-white/5"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
          )}
        </div>
      </div>

      {!isEmployee && (
        <UpgradePrompt
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          currentPlan={planType}
        />
      )}
    </>
  );
}
