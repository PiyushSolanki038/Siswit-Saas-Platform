import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, ArrowRight, Loader2, User, Mail, Lock, Building2, ArrowLeft, ShieldCheck } from "lucide-react";

const employeeSignupSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid work email"),
  employeeId: z.string().optional(),
  password: z.string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

interface EmployeeSignupFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function EmployeeSignupForm({ onBack, onSuccess }: EmployeeSignupFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    employeeId: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { signUp } = useAuth();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const result = employeeSignupSchema.safeParse(formData);

      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        setIsLoading(false);
        return;
      }

      const nameParts = formData.fullName.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "";

      // SECURITY: Role is assigned server-side as 'user' - admin must approve for employee access
      const { error } = await signUp(formData.email, formData.password, firstName, lastName);

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            variant: "destructive",
            title: "Account exists",
            description: "An account with this email already exists. Please sign in.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Signup failed",
            description: error.message,
          });
        }
      } else {
        toast({
          title: "Application Submitted!",
          description: "Your employee account request has been submitted. An administrator will review and approve your access.",
        });
        onSuccess();
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to role selection
      </button>

      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Employee Registration</h1>
            <p className="text-sm text-muted-foreground">Create your employee account</p>
          </div>
        </div>
      </div>

      {/* Admin Approval Notice */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Admin Approval Required</p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
            After registration, your account will be reviewed by an administrator before you can access the dashboard.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Full Name"
            className={`pl-10 h-12 ${errors.fullName ? "border-destructive" : ""}`}
          />
          {errors.fullName && (
            <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
          )}
        </div>

        {/* Work Email */}
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Work Email"
            className={`pl-10 h-12 ${errors.email ? "border-destructive" : ""}`}
          />
          {errors.email && (
            <p className="text-sm text-destructive mt-1">{errors.email}</p>
          )}
        </div>

        {/* Employee ID (Optional) */}
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            name="employeeId"
            value={formData.employeeId}
            onChange={handleChange}
            placeholder="Employee ID (Optional)"
            className="pl-10 h-12"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            name="password"
            type={showPassword ? "text" : "password"}
            value={formData.password}
            onChange={handleChange}
            placeholder="Password"
            className={`pl-10 pr-10 h-12 ${errors.password ? "border-destructive" : ""}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          {errors.password && (
            <p className="text-sm text-destructive mt-1">{errors.password}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Confirm Password"
            className={`pl-10 pr-10 h-12 ${errors.confirmPassword ? "border-destructive" : ""}`}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Password Requirements */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Password must contain:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>At least 12 characters</li>
            <li>Uppercase and lowercase letters</li>
            <li>At least one number</li>
            <li>At least one special character</li>
          </ul>
        </div>

        <Button
          type="submit"
          variant="hero"
          className="w-full h-12"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Submit Application
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}