import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { RoleSelection, SelectedRole } from "@/components/auth/RoleSelection";
import { EmployeeSignupForm } from "@/components/auth/EmployeeSignupForm";
import { CustomerSignupForm } from "@/components/auth/CustomerSignupForm";
import { SignInForm } from "@/components/auth/SignInForm";
import { CheckCircle2 } from "lucide-react";

type AuthStep = "role-selection" | "employee-signup" | "customer-signup" | "signin" | "success";

const Auth = () => {
  const [step, setStep] = useState<AuthStep>("role-selection");
  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null);
  const [successType, setSuccessType] = useState<"employee" | "customer" | null>(null);
  
  const { user, role } = useAuth();
  const navigate = useNavigate();

  // Redirect based on role if already logged in
  useEffect(() => {
    if (user && role) {
      if (role === "employee") {
        navigate("/dashboard");
      } else {
        navigate("/");
      }
    }
  }, [user, role, navigate]);

  const handleRoleContinue = () => {
    if (selectedRole === "employee") {
      setStep("employee-signup");
    } else if (selectedRole === "customer") {
      setStep("customer-signup");
    }
  };

  const handleSignupSuccess = (type: "employee" | "customer") => {
    setSuccessType(type);
    setStep("success");
  };

  const handleBackToRoleSelection = () => {
    setStep("role-selection");
    setSelectedRole(null);
  };

  const renderStep = () => {
    switch (step) {
      case "role-selection":
        return (
          <>
            <RoleSelection
              selectedRole={selectedRole}
              onSelectRole={setSelectedRole}
              onContinue={handleRoleContinue}
            />
            <p className="text-center text-muted-foreground mt-6">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setStep("signin")}
                className="text-primary font-semibold hover:underline"
              >
                Sign in
              </button>
            </p>
          </>
        );

      case "employee-signup":
        return (
          <>
            <EmployeeSignupForm
              onBack={handleBackToRoleSelection}
              onSuccess={() => handleSignupSuccess("employee")}
            />
            <p className="text-center text-muted-foreground mt-6">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setStep("signin")}
                className="text-primary font-semibold hover:underline"
              >
                Sign in
              </button>
            </p>
          </>
        );

      case "customer-signup":
        return (
          <>
            <CustomerSignupForm
              onBack={handleBackToRoleSelection}
              onSuccess={() => handleSignupSuccess("customer")}
            />
            <p className="text-center text-muted-foreground mt-6">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setStep("signin")}
                className="text-primary font-semibold hover:underline"
              >
                Sign in
              </button>
            </p>
          </>
        );

      case "signin":
        return (
          <>
            <SignInForm />
            <p className="text-center text-muted-foreground mt-6">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => setStep("role-selection")}
                className="text-primary font-semibold hover:underline"
              >
                Sign up
              </button>
            </p>
          </>
        );

      case "success":
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {successType === "employee" ? "Application Submitted!" : "Account Created!"}
              </h1>
              <p className="text-muted-foreground">
                {successType === "employee"
                  ? "Your employee account request has been submitted. An administrator will review and approve your access soon."
                  : "Welcome to Siriusinfra! Your account is ready to use."}
              </p>
            </div>
            <button
              onClick={() => setStep("signin")}
              className="w-full h-12 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Continue to Sign In
            </button>
          </div>
        );
    }
  };

  // Progress indicator
  const getProgress = () => {
    switch (step) {
      case "role-selection":
        return { step: 1, label: "Select Role" };
      case "employee-signup":
      case "customer-signup":
        return { step: 2, label: "Create Account" };
      case "signin":
        return { step: 0, label: "Sign In" };
      case "success":
        return { step: 3, label: "Complete" };
      default:
        return { step: 1, label: "" };
    }
  };

  const progress = getProgress();

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col p-6 md:p-8 bg-background">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">S</span>
              </div>
              <span className="text-xl font-bold text-foreground">
                SIS<span className="text-gradient">WIT</span>
              </span>
            </Link>

            {/* Progress Steps - Only show for signup flow */}
            {progress.step > 0 && step !== "success" && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  {[1, 2].map((s) => (
                    <div
                      key={s}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        s <= progress.step ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Step {progress.step} of 2: {progress.label}
                </p>
              </div>
            )}

            {renderStep()}

            {/* Back to home */}
            <Link
              to="/"
              className="block text-center text-sm text-muted-foreground mt-6 hover:text-primary"
            >
              ← Back to homepage
            </Link>
          </div>
        </div>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex flex-1 bg-primary items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-white/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "-3s" }} />
        
        <div className="relative text-center max-w-md">
          <h2 className="text-4xl font-bold text-white mb-6">
            Transform Your Business with{" "}
            <span className="text-blue-200">SISWIT</span>
          </h2>
          <p className="text-white/90 text-lg mb-8">
            Access powerful CPQ, CLM, and CRM tools in one unified platform. 
            Streamline your operations and close deals faster.
          </p>
          <div className="flex justify-center gap-6 text-sm text-white/80">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white" />
              500+ Enterprises
            </span>
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-200" />
              99.99% Uptime
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;