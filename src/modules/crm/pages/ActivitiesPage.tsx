import { useState } from "react";
import { 
  useActivities, 
  useCreateActivity, 
  useUpdateActivity, 
  useDeleteActivity 
} from "@/modules/crm/hooks/useCRM"; // Ensure these hooks exist or create them similar to useAccounts
import { DataTable } from "@/modules/crm/components/DataTable";
import { Button } from "@/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/ui/shadcn/dialog";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Textarea } from "@/ui/shadcn/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/shadcn/select";
import { 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Calendar, 
  CheckCircle2, 
  Circle,
  Phone,
  Mail,
  Users,
  StickyNote,
  CheckSquare
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/shadcn/dropdown-menu";
import { format } from "date-fns";
import { Badge } from "@/ui/shadcn/badge";
import { Checkbox } from "@/ui/shadcn/checkbox";

// --- TYPES ---
// Matches Schema: public.Enums.activity_type
export type ActivityType = "call" | "email" | "meeting" | "task" | "note";

export interface ActivityRow {
  id: string;
  subject: string;
  type: ActivityType;
  description: string | null;
  due_date: string | null;
  is_completed: boolean | null;
  priority: string | null;
  created_at: string;
}

// Icons for each activity type
const TYPE_ICONS: Record<ActivityType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  task: CheckSquare,
  note: StickyNote,
};

const TYPE_COLORS: Record<ActivityType, string> = {
  call: "bg-info/15 text-info",
  email: "bg-primary/15 text-primary",
  meeting: "bg-primary/15 text-primary",
  task: "bg-success/15 text-success",
  note: "bg-warning/15 text-warning",
};

export default function ActivitiesPage() {
  const { data: activities = [], isLoading } = useActivities();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityRow | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    subject: "",
    type: "call" as ActivityType,
    description: "",
    due_date: "",
    priority: "medium",
    is_completed: false,
  });

  const openCreateDialog = () => {
    setEditingActivity(null);
    setFormData({
      subject: "",
      type: "call",
      description: "",
      due_date: "",
      priority: "medium",
      is_completed: false,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (row: ActivityRow) => {
    setEditingActivity(row);
    setFormData({
      subject: row.subject,
      type: row.type,
      description: row.description || "",
      due_date: row.due_date ? format(new Date(row.due_date), "yyyy-MM-dd") : "",
      priority: row.priority || "medium",
      is_completed: row.is_completed || false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      ...formData,
      due_date: formData.due_date || undefined,
    };

    if (editingActivity) {
      await updateActivity.mutateAsync({ id: editingActivity.id, ...payload });
    } else {
      await createActivity.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const toggleComplete = async (row: ActivityRow) => {
    // Quick toggle for the checkbox in the table
    await updateActivity.mutateAsync({ 
      id: row.id, 
      is_completed: !row.is_completed 
    });
  };

  const columns = [
    {
      key: "status",
      header: "",
      cell: (row: ActivityRow) => (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleComplete(row);
          }}
          className="text-muted-foreground hover:text-primary transition-colors"
        >
          {row.is_completed ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>
      ),
    },
    {
      key: "subject",
      header: "Subject",
      cell: (row: ActivityRow) => (
        <span className={row.is_completed ? "line-through text-muted-foreground" : "font-medium"}>
          {row.subject}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (row: ActivityRow) => {
        const Icon = TYPE_ICONS[row.type] || Circle;
        return (
          <Badge className={`flex items-center gap-1 w-fit ${TYPE_COLORS[row.type] || "bg-secondary text-secondary-foreground"}`}>
            <Icon className="h-3 w-3" />
            <span className="capitalize">{row.type}</span>
          </Badge>
        );
      },
    },
    {
      key: "priority",
      header: "Priority",
      cell: (row: ActivityRow) => (
        <span className={`text-xs uppercase font-bold ${
          row.priority === 'high' ? 'text-destructive' : 
          row.priority === 'low' ? 'text-muted-foreground' : 'text-warning'
        }`}>
          {row.priority || "MEDIUM"}
        </span>
      ),
    },
    {
      key: "due_date",
      header: "Due Date",
      cell: (row: ActivityRow) => {
        if (!row.due_date) return <span className="text-muted-foreground">-</span>;
        try {
          const date = new Date(row.due_date);
          const isOverdue = date < new Date() && !row.is_completed;
          return (
            <div className={`flex items-center gap-2 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              <Calendar className="h-3 w-3" />
              <span>{format(date, "MMM d, yyyy")}</span>
            </div>
          );
        } catch {
          return "-";
        }
      },
    },
    {
      key: "actions",
      header: "",
      cell: (row: ActivityRow) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(row)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => deleteActivity.mutate(row.id)}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Activities</h1>
          <p className="text-muted-foreground">Track your tasks, calls, and meetings</p>
        </div>

        <DataTable
          data={activities as unknown as ActivityRow[]}
          columns={columns}
          loading={isLoading}
          onAdd={openCreateDialog}
          addLabel="Add Activity"
          searchPlaceholder="Search activities..."
        />

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingActivity ? "Edit Activity" : "New Activity"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Subject</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. Call with John"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v) => setFormData({ ...formData, type: v as ActivityType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData({ ...formData, priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2 my-2">
                <Checkbox 
                  id="completed" 
                  checked={formData.is_completed}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, is_completed: checked as boolean })
                  }
                />
                <Label htmlFor="completed" className="font-normal cursor-pointer">
                  Mark as completed
                </Label>
              </div>

              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createActivity.isPending || updateActivity.isPending}>
                {editingActivity ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
