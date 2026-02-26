interface OrganizationProgressCardProps {
  value: number;
  label: string;
  caption: string;
}

export function OrganizationProgressCard({ value, label, caption }: OrganizationProgressCardProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <section className="org-panel h-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold">{label}</h3>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </div>

      <div className="mx-auto w-full max-w-[220px] py-2">
        <div
          className="relative mx-auto h-44 w-44 rounded-full"
          style={{
            background: `conic-gradient(hsl(var(--primary)) ${percent * 3.6}deg, hsl(var(--muted)) ${percent * 3.6}deg 360deg)`,
          }}
          aria-hidden
        >
          <div className="absolute inset-[18px] flex items-center justify-center rounded-full bg-card">
            <div className="text-center">
              <p className="font-mono text-4xl font-bold leading-none">{percent}%</p>
              <p className="mt-2 text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Complete
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted" />
          Pending
        </span>
      </div>
    </section>
  );
}

