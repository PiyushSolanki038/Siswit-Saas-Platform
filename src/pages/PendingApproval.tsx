import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, Mail, Home, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const PendingApproval = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
            <Clock className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Account Pending Approval
          </h1>
          <p className="text-muted-foreground mb-6">
            Your employee account is currently awaiting approval from an administrator. 
            You will be able to access the dashboard once your account has been approved.
          </p>
          
          {user && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 py-2 px-4 rounded-lg inline-flex">
              <Mail className="w-4 h-4" />
              <span>{user.email}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            variant="outline" 
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
          <Button 
            variant="default" 
            asChild
          >
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Go to Home
            </Link>
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mt-6">
          Need help? Contact your system administrator for assistance.
        </p>
      </div>
    </div>
  );
};

export default PendingApproval;
