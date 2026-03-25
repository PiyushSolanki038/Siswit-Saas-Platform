import { useState, useEffect } from "react";
import { Loader2, Save, User as UserIcon, Lock, Bell } from "lucide-react";
import { Input } from "@/ui/shadcn/input";
import { Button } from "@/ui/shadcn/button";
import { Card } from "@/ui/shadcn/card";
import { useAuth } from "@/core/auth/useAuth";
import { useToast } from "@/core/hooks/use-toast";
import { supabase } from "@/core/api/client";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";

export default function EmployeeSettingsPage() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
        if (!user) return;
        
        // Fetch from profiles table
        const { data, error } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("user_id", user.id)
            .maybeSingle();
        
        if (data) {
            setFormData({
                first_name: data.first_name || user.user_metadata?.first_name || "",
                last_name: data.last_name || user.user_metadata?.last_name || "",
                email: user.email || "",
            });
        } else {
            // Fallback to auth metadata
            setFormData({
                first_name: user.user_metadata?.first_name || "",
                last_name: user.user_metadata?.last_name || "",
                email: user.email || "",
            });
        }
    };

    fetchProfile();
  }, [user]);

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      // 1. Update Auth Metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
        }
      });
      if (authError) throw authError;

      // 2. Update Profiles Table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
            first_name: formData.first_name,
            last_name: formData.last_name,
        })
        .eq("user_id", user!.id);
      
      if (profileError) throw profileError;

      toast({
        title: "Profile updated",
        description: "Your personal details have been saved successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 mb-10 text-foreground">
      {/* ATMOSPHERIC DECOR */}
      <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-blue-600/5 blur-[100px] pointer-events-none" />
      
      <section className="relative z-10">
        <h1 className="text-3xl font-bold tracking-tight">Your Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your personal profile and account security.</p>
      </section>

      <div className="grid gap-6 md:grid-cols-3 relative z-10">
        {/* Left Column: Forms */}
        <div className="md:col-span-2 space-y-6">
          <section className="p-6 rounded-[2rem] border border-white/5 bg-card/40 backdrop-blur-xl shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <UserIcon className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold">Personal Information</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">First Name</label>
                <Input 
                  value={formData.first_name} 
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  placeholder="John"
                  className="bg-white/5 border-white/10 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Last Name</label>
                <Input 
                  value={formData.last_name} 
                  onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  placeholder="Doe"
                  className="bg-white/5 border-white/10 rounded-xl"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Account Email (Read-only)</label>
                <Input 
                  value={formData.email} 
                  readOnly
                  disabled
                  className="bg-white/5 border-white/10 rounded-xl cursor-not-allowed opacity-60"
                />
              </div>
            </div>

            <Button 
                onClick={handleUpdateProfile} 
                className="w-full sm:w-auto min-w-[140px] rounded-xl font-bold"
                disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Profile
            </Button>
          </section>

          <section className="p-6 rounded-[2rem] border border-white/5 bg-card/40 backdrop-blur-xl shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
                <Lock className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold">Security</h2>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Change your password to keep your account secure.</p>
              <Button variant="outline" className="rounded-xl font-bold border-white/10 hover:bg-white/5">
                Update Password
              </Button>
            </div>
          </section>
        </div>

        {/* Right Column: Organization Context */}
        <div className="space-y-6">
          <Card className="rounded-[2rem] border-white/5 bg-purple-600/5 backdrop-blur-xl p-6">
            <div className="flex flex-col items-center text-center space-y-4">
               <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center text-2xl font-bold text-white shadow-2xl">
                {organization?.name?.[0] || "O"}
              </div>
              <div>
                <h3 className="font-bold text-lg">{organization?.name || "Organization"}</h3>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Tenant Sub-Member</p>
              </div>
              <div className="w-full pt-4 border-t border-white/5">
                <div className="flex justify-between items-center text-xs px-2 mb-2">
                    <span className="text-muted-foreground font-medium">Org Code</span>
                    <span className="font-bold text-primary">{organization?.org_code || "---"}</span>
                </div>
                <div className="flex justify-between items-center text-xs px-2">
                    <span className="text-muted-foreground font-medium">Your Role</span>
                    <span className="font-bold text-emerald-500 uppercase">Employee</span>
                </div>
              </div>
            </div>
          </Card>

          <section className="p-6 rounded-[2rem] border border-white/5 bg-card/40 backdrop-blur-xl space-y-4">
             <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-primary opacity-60" />
                <h3 className="text-sm font-bold">Notifications</h3>
             </div>
             <p className="text-xs text-muted-foreground leading-relaxed">System notifications are currently managed by your organization administrator.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
