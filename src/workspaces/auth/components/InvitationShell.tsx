import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import heroBg from "@/assets/hero-bg.jpg";
import { cn } from "@/core/utils/utils";
import { Input } from "@/ui/shadcn/input";

interface InvitationShellProps {
  badge: string;
  title: string;
  description: string;
  children: ReactNode;
  sideHeadline?: string;
}

export interface InvitationSummaryItem {
  icon: LucideIcon;
  label: string;
  value: string;
}

interface InvitationSummaryCardProps {
  organizationName: string;
  subtitle: string;
  items?: InvitationSummaryItem[];
  email?: string;
  emailLabel?: string;
}

interface InvitationFormRowProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

interface InvitationStatusPanelProps {
  icon: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
  centered?: boolean;
}

const invitationInputClassName =
  "h-12 rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-[#a388ff] focus-visible:ring-offset-0 read-only:text-white/80 read-only:placeholder:text-white/50";

function getInitials(value: string): string {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "SI";
}

export function InvitationShell({
  badge,
  title,
  description,
  children,
  sideHeadline = "Create your workspace and onboard people the right way.",
}: InvitationShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060513] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-12%] h-[26rem] w-[26rem] rounded-full bg-[#2740ff]/20 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-8%] h-[30rem] w-[30rem] rounded-full bg-[#8b2cff]/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(111,78,240,0.18),transparent_38%),linear-gradient(180deg,#0a081d_0%,#060513_100%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1400px] items-center justify-center">
        <div className="w-full overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(34,27,65,0.96),rgba(13,10,29,0.92))] shadow-[0_30px_90px_rgba(4,4,18,0.7)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[0.98fr_1fr]">
            <aside className="hidden p-7 lg:block">
              <div className="relative min-h-[760px] overflow-hidden rounded-[28px] border border-white/10 bg-[#1c1f8c] shadow-[0_24px_64px_rgba(15,8,44,0.45)]">
                <img src={heroBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(76,101,255,0.86)_0%,rgba(62,31,193,0.82)_48%,rgba(126,20,220,0.92)_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(191,230,255,0.35),transparent_18%),radial-gradient(circle_at_70%_68%,rgba(227,95,255,0.22),transparent_28%)]" />
                <div className="absolute left-[18%] top-[36%] h-24 w-24 rotate-12 rounded-[28px] border border-white/[0.18] bg-white/10 shadow-[0_14px_36px_rgba(173,214,255,0.25)] backdrop-blur-sm" />
                <div className="absolute right-[16%] top-[34%] h-20 w-20 -rotate-12 rounded-[24px] border border-white/[0.16] bg-white/10 shadow-[0_14px_36px_rgba(173,214,255,0.22)] backdrop-blur-sm" />
                <div className="absolute bottom-[18%] left-[42%] h-16 w-16 rotate-6 rounded-[22px] border border-white/[0.14] bg-white/10 backdrop-blur-sm" />

                <div className="relative z-10 flex h-full flex-col justify-between p-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex rounded-full border border-white/25 bg-black/20 px-4 py-2 text-sm font-semibold tracking-[0.28em] text-white">
                      SISWIT
                    </span>
                    <Link
                      to="/"
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/[0.18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to website
                    </Link>
                  </div>

                  <div className="max-w-[340px] space-y-5">
                    <p className="text-[3rem] leading-none text-white/10">+</p>
                    <p className="text-4xl font-semibold leading-[1.05] tracking-tight text-white">
                      {sideHeadline}
                    </p>
                    <span className="block h-1.5 w-14 rounded-full bg-white/90" />
                  </div>
                </div>
              </div>
            </aside>

            <section className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
              <div className="mx-auto w-full max-w-[38rem]">
                <div className="mb-6 flex items-center justify-between lg:hidden">
                  <span className="inline-flex rounded-full border border-white/[0.14] bg-white/[0.06] px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-white">
                    SISWIT
                  </span>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to website
                  </Link>
                </div>

                <div className="space-y-3">
                  <p className="inline-flex rounded-2xl border border-[#8f5cff]/20 bg-[#8f5cff]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[#ddbaff]">
                    {badge}
                  </p>
                  <div className="space-y-2">
                    <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-[2.85rem]">
                      {title}
                    </h1>
                    <p className="max-w-[32rem] text-lg leading-7 text-white/60">{description}</p>
                  </div>
                </div>

                <div className="mt-8">{children}</div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InvitationSummaryCard({
  organizationName,
  subtitle,
  items = [],
  email,
  emailLabel = "Email",
}: InvitationSummaryCardProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(91,75,146,0.24),rgba(29,20,57,0.66))] p-5 shadow-[0_20px_50px_rgba(7,6,22,0.22)] sm:p-6">
      <p className="text-lg font-medium text-white/90">You have been invited to join:</p>

      <div className="mt-5 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-[linear-gradient(135deg,rgba(255,255,255,0.28),rgba(160,113,255,0.2))] text-sm font-semibold tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
          {getInitials(organizationName)}
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-[1.75rem] font-semibold tracking-tight text-white">{organizationName}</h2>
          <p className="text-sm text-white/60">{subtitle}</p>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="mt-5 space-y-3">
          {items.map(({ icon: Icon, label, value }) => (
            <div key={`${label}-${value}`} className="flex items-start gap-3 text-sm text-white/80">
              <div className="mt-0.5 rounded-full border border-white/10 bg-white/[0.06] p-1.5 text-[#d9bcff]">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="leading-6">
                <span className="mr-2 text-white/50">{label}</span>
                <span className="font-semibold text-white">{value}</span>
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {email ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-[88px_minmax(0,1fr)] sm:items-center">
          <span className="text-sm text-white/50">{emailLabel}</span>
          <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] px-4 text-sm text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <Mail className="h-4 w-4 shrink-0 text-[#d8b3ff]" />
            <span className="truncate">{email}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function InvitationFormRow({ label, hint, children }: InvitationFormRowProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-center">
      <div className="flex items-center gap-2 text-sm text-white/70">
        <span>{label}</span>
        {hint ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#71b6ff]">{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function InvitationInput({ className, ...props }: ComponentPropsWithoutRef<typeof Input>) {
  return <Input className={cn(invitationInputClassName, className)} {...props} />;
}

export function InvitationStatusPanel({
  icon,
  title,
  description,
  actions,
  centered = false,
}: InvitationStatusPanelProps) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(84,70,141,0.18),rgba(20,15,40,0.58))] p-6 shadow-[0_20px_50px_rgba(7,6,22,0.22)] sm:p-7",
        centered && "text-center",
      )}
    >
      <div className={cn("space-y-4", centered && "mx-auto max-w-md")}>
        <div className={cn("inline-flex rounded-full border border-white/10 bg-white/[0.08] p-3", centered && "mx-auto")}>
          {icon}
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="text-sm leading-6 text-white/60">{description}</p>
        </div>
        {actions ? <div className={cn("flex flex-wrap gap-3", centered && "justify-center")}>{actions}</div> : null}
      </div>
    </div>
  );
}
