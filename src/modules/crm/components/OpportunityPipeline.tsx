import { useMemo } from "react";
import { Card, CardContent } from "@/ui/shadcn/card";
import { Badge } from "@/ui/shadcn/badge";
import { cn } from "@/core/utils/utils";
import type { Opportunity, OpportunityStage } from "@/core/types/crm";
import { OPPORTUNITY_STAGE_COLORS } from "@/core/types/crm";
import { useUpdateOpportunity } from "@/modules/crm/hooks/useCRM";
import { Building2, DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";

interface OpportunityPipelineProps {
  opportunities: Opportunity[];
  onOpportunityClick?: (opp: Opportunity) => void;
}

const STAGES: { key: OpportunityStage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "closed_won", label: "Closed Won" },
  { key: "closed_lost", label: "Closed Lost" },
];

export function OpportunityPipeline({ opportunities, onOpportunityClick }: OpportunityPipelineProps) {
  const updateOpportunity = useUpdateOpportunity();

  const groupedOpportunities = useMemo(() => {
    const groups: Record<OpportunityStage, Opportunity[]> = {
      new: [],
      qualified: [],
      proposal: [],
      negotiation: [],
      closed_won: [],
      closed_lost: [],
    };

    opportunities.forEach((opp) => {
      groups[opp.stage].push(opp);
    });

    return groups;
  }, [opportunities]);

  const handleDragStart = (e: React.DragEvent, opp: Opportunity) => {
    e.dataTransfer.setData("opportunityId", opp.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, stage: OpportunityStage) => {
    e.preventDefault();
    const opportunityId = e.dataTransfer.getData("opportunityId");
    if (opportunityId) {
      updateOpportunity.mutate({ id: opportunityId, stage });
    }
  };

  const stageTotal = (stage: OpportunityStage) => {
    return groupedOpportunities[stage].reduce((sum, opp) => sum + (opp.amount || 0), 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map((stage) => (
        <div
          key={stage.key}
          className="flex-shrink-0 w-72"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, stage.key)}
        >
          {/* Stage Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className={cn("w-3 h-3 rounded-full", OPPORTUNITY_STAGE_COLORS[stage.key])} />
            <h3 className="font-semibold text-sm">{stage.label}</h3>
            <Badge variant="secondary" className="ml-auto">
              {groupedOpportunities[stage.key].length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            {formatCurrency(stageTotal(stage.key))}
          </p>

          {/* Opportunities */}
          <div className="space-y-3 min-h-[200px] bg-muted/30 rounded-lg p-2">
            {groupedOpportunities[stage.key].map((opp) => (
              <Card
                key={opp.id}
                draggable
                onDragStart={(e) => handleDragStart(e, opp)}
                onClick={() => onOpportunityClick?.(opp)}
                className="cursor-grab active:cursor-grabbing hover:shadow-card-hover transition-shadow"
              >
                <CardContent className="p-3">
                  <h4 className="font-medium text-sm mb-2 line-clamp-1">{opp.name}</h4>
                  
                  {opp.account && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Building2 className="h-3 w-3" />
                      <span className="line-clamp-1">{opp.account.name}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <DollarSign className="h-3 w-3" />
                    <span>{formatCurrency(opp.amount || 0)}</span>
                    <span className="text-primary">({opp.probability}%)</span>
                  </div>
                  
                  {opp.close_date && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(opp.close_date), "MMM d, yyyy")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
