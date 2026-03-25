import { useState, useEffect } from "react";
import { 
  Bell,
  CheckCircle2,
  Info,
  Calendar,
  Clock,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/ui/shadcn/badge";
import { Card, CardContent } from "@/ui/shadcn/card";
import { cn } from "@/core/utils/utils";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { formatDistanceToNow } from "date-fns";

export default function EmployeeAlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
        if (!user) return;
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from("activities")
                .select("id, subject, type, created_at, is_completed")
                .eq("owner_id", user.id)
                .order("created_at", { ascending: false })
                .limit(20);

            if (error) throw error;

            if (data) {
                const mappedAlerts = data.map(a => {
                    let icon = Info;
                    let type = "info";
                    const lowerType = a.type?.toLowerCase() || "";
                    const module = a.type?.toUpperCase() || "ACTIVITY";

                    if (lowerType === "call") icon = Clock;
                    if (lowerType === "meeting") icon = Calendar;
                    if (lowerType === "task") icon = AlertCircle;
                    
                    if (a.is_completed) {
                        icon = CheckCircle2;
                        type = "success";
                    }

                    return {
                        id: a.id,
                        type,
                        title: a.subject || "Activity Update",
                        description: `Personal ${a.type || "task"} activity updated in the system.`,
                        timestamp: a.created_at ? `${formatDistanceToNow(new Date(a.created_at))} ago` : "Recently",
                        module,
                        icon
                    };
                });
                setAlerts(mappedAlerts);
            }
        } catch (err) {
            console.error("Error fetching employee alerts:", err);
        } finally {
            setLoading(false);
        }
    };

    fetchAlerts();
  }, [user]);

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "critical": return "border-destructive/40 bg-destructive/10 text-destructive";
      case "warning": return "border-orange-500/40 bg-orange-500/10 text-orange-500";
      case "success": return "border-emerald-500/40 bg-emerald-500/10 text-emerald-500";
      default: return "border-purple-500/40 bg-purple-500/10 text-purple-400";
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-foreground pb-10">
      {/* ATMOSPHERIC DECOR */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-purple-600/5 blur-[100px] pointer-events-none" />
      
      <section className="relative z-10">
        <h1 className="text-3xl font-bold tracking-tight">Your Alerts</h1>
        <p className="text-muted-foreground mt-1 text-sm">Personal notifications and system updates for you.</p>
      </section>

      <div className="space-y-4 relative z-10">
        {alerts.map((alert) => (
          <article 
            key={alert.id}
            className={cn(
              "group relative flex items-start gap-4 p-5 rounded-[2.5rem] border bg-card/10 backdrop-blur-md transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
              getTypeStyles(alert.type)
            )}
          >
            <div className="mt-1 h-12 w-12 shrink-0 rounded-2xl bg-background/50 backdrop-blur-sm flex items-center justify-center shadow-lg border border-white/5">
              <alert.icon className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">{alert.title}</h3>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0 bg-white/5 border-white/10 text-foreground/70">
                    {alert.module}
                  </Badge>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{alert.timestamp}</span>
              </div>
              <p className="text-sm opacity-80 leading-relaxed text-foreground/60">
                {alert.description}
              </p>
            </div>
          </article>
        ))}

        {alerts.length === 0 && (
          <Card className="border-dashed border-2 py-20 flex flex-col items-center justify-center text-center bg-transparent rounded-[3rem]">
            <CardContent className="flex flex-col items-center justify-center p-10">
              <div className="bg-white/5 p-6 rounded-3xl mb-6">
                <Bell className="h-12 w-12 text-muted-foreground/30" />
              </div>
              <h3 className="font-bold text-xl">All caught up!</h3>
              <p className="text-muted-foreground max-w-xs mx-auto mt-2 text-sm">
                No new personal alerts found in your activity stream.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
