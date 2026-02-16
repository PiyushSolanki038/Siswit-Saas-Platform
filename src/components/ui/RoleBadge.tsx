import { AppRole } from "@/types/roles"; // Ensure this matches your actual path
import { Badge } from "@/components/ui/badge";
import { Building2, UserCheck, Shield, Clock } from "lucide-react"; 

interface RoleBadgeProps {
  role: AppRole | null; // Allow null to prevent crashes
  size?: "sm" | "md";
}

export function RoleBadge({ role, size = "md" }: RoleBadgeProps) {
  // 1. Safety Check: If no role exists yet, show a 'Pending' or return null
  if (!role) {
    return (
      <Badge
        variant="outline"
        className={`${size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"} gap-1.5 opacity-70`}
      >
        <Clock className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
        <span className="hidden sm:inline capitalize">Pending</span>
      </Badge>
    );
  }

  // 2. Normalize checks safely
  const roleName = role.toLowerCase(); 
  const isAdmin = roleName === "admin";
  const isEmployee = roleName === "employee";
  
  // 3. Determine Variant
  const badgeVariant = isAdmin ? "destructive" : isEmployee ? "default" : "secondary";

  return (
    <Badge
      variant={badgeVariant}
      className={`${size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"} gap-1.5`}
    >
      {/* 4. Icon Logic */}
      {isAdmin ? (
        <Shield className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      ) : isEmployee ? (
        <Building2 className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      ) : (
        <UserCheck className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      )}

      <span className="hidden sm:inline capitalize">
        {isAdmin ? "Admin" : isEmployee ? "Employee" : "Client"}
      </span>
    </Badge>
  );
}