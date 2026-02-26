import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrganizationStatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  emphasis?: boolean;
}

export function OrganizationStatCard({ title, value, subtitle, emphasis = false }: OrganizationStatCardProps) {
  return (
    <article className={cn("org-stat-card", emphasis && "org-stat-card-primary")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-background/80">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-mono text-4xl font-bold leading-none">{value}</p>
      <p className="mt-3 text-xs text-muted-foreground">{subtitle}</p>
    </article>
  );
}

