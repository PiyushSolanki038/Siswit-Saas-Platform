import { Building2, Users, ArrowRight, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectedRole = "employee" | "customer" | null;

interface RoleSelectionProps {
  selectedRole: SelectedRole;
  onSelectRole: (role: SelectedRole) => void;
  onContinue: () => void;
}

const roles = [
  {
    id: "employee" as const,
    title: "Employee",
    description: "Access internal tools & dashboards",
    icon: Building2,
    features: [
      "Dashboard Access",
      "CPQ / CLM / CRM",
      "Manage Quotes",
      "Contracts",
    ],
    note: "Admin approval",
  },
  {
    id: "customer" as const,
    title: "Customer / Client",
    description: "View quotes & sign contracts",
    icon: Users,
    features: [
      "Browse Services",
      "View Pricing",
      "Digital Contracts",
      "Support",
    ],
    note: "Instant access",
  },
];

export function RoleSelection({
  selectedRole,
  onSelectRole,
  onContinue,
}: RoleSelectionProps) {
  return (
    <div className="flex flex-col h-full max-h-[100vh]">
      
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Choose Your Role
        </h1>
        <p className="text-sm text-muted-foreground">
          How will you use Siriusinfra?
        </p>
      </div>

      {/* Roles (scrollable area) */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {roles.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.id;

          return (
            <button
              key={role.id}
              onClick={() => onSelectRole(role.id)}
              className={cn(
                "relative w-full rounded-xl border p-4 text-left transition",
                "hover:border-primary/50",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-card"
              )}
            >
              {/* Radio */}
              <div
                className={cn(
                  "absolute top-3 right-3 w-4 h-4 rounded-full border flex items-center justify-center",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30"
                )}
              >
                {isSelected && (
                  <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                )}
              </div>

              <div className="flex gap-3">
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-sm">
                      {role.title}
                    </h3>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full",
                        role.id === "employee"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-emerald-500/10 text-emerald-600"
                      )}
                    >
                      {role.note}
                    </span>
                  </div>

                  <p className="text-s text-muted-foreground mb-4">
                    {role.description}
                  </p>

                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                    {role.features.map((feature, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-1.5 text-[14px] text-muted-foreground"
                      >
                        {role.id === "employee" ? (
                          <Shield className="w-3 h-3 text-primary" />
                        ) : (
                          <Zap className="w-3 h-3 text-primary" />
                        )}
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <button
        onClick={onContinue}
        disabled={!selectedRole}
        className={cn(
          "mt-2 h-11 rounded-lg font-medium flex items-center justify-center gap-2",
          selectedRole
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}