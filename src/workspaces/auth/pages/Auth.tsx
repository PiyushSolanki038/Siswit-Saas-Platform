import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Checkbox } from "@/ui/shadcn/checkbox";
import { useToast } from "@/core/hooks/use-toast";
import { useAuth } from "@/core/auth/useAuth";
import { useOrganization } from "@/workspaces/organization/hooks/useOrganization";
import heroBg from "@/assets/hero-bg.jpg";
import {
  organizationDashboardPath,
  organizationOwnerPath,
  organizationPortalPath,
  platformPath,
} from "@/core/utils/routes";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, user, role, loading } = useAuth();
  const { organization } = useOrganization();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !role) return;

    if (role === "platform_super_admin" || role === "platform_admin") {
      navigate(platformPath(), { replace: true });
      return;
    }

    if (role === "owner") {
      navigate(organizationOwnerPath(), { replace: true });
      return;
    }

    if (role === "admin" || role === "manager" || role === "employee" || role === "user") {
      if (organization?.slug) {
        navigate(organizationDashboardPath(organization.slug), { replace: true });
      }
      return;
    }

    if (role === "client") {
      if (organization?.slug) {
        navigate(organizationPortalPath(organization.slug), { replace: true });
      }
      return;
    }

    if (role === "pending_approval") {
      navigate("/auth/pending-approval", { replace: true });
      return;
    }

    if (role === "rejected") {
      navigate("/unauthorized", { replace: true });
    }
  }, [navigate, organization?.slug, role, user]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);

    const { error, role: resolvedRole } = await signIn(email.trim(), password, rememberMe);

    setSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: error,
      });
      return;
    }

    if (resolvedRole === "pending_approval") {
      navigate("/auth/pending-approval");
      return;
    }

    if (resolvedRole === "rejected") {
      navigate("/unauthorized");
      return;
    }

    toast({
      title: "Welcome back",
      description: "Signed in successfully.",
    });
  };

  return (
    <div className="relative min-h-screen gradient-hero px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="absolute -left-16 top-16 h-72 w-72 rounded-full bg-info/20 blur-3xl" />
        <div className="absolute bottom-8 right-8 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center lg:min-h-[calc(100vh-5rem)]">
        <div className="w-full animate-scale-in overflow-hidden rounded-3xl border border-border/60 bg-card/85 shadow-card backdrop-blur-sm dark:border-primary/20 dark:bg-[rgba(16,12,30,0.88)] dark:shadow-[0_24px_80px_rgba(13,9,34,0.72)]">
          <div className="grid lg:grid-cols-[1.02fr_1fr]">
            <aside className="hidden p-5 lg:block">
              <div className="relative h-full min-h-[540px] overflow-hidden rounded-2xl border border-white/20 shadow-2xl dark:border-white/15 dark:shadow-[0_18px_48px_rgba(18,9,45,0.5)]">
                <img src={heroBg} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--info)/0.34)_0%,hsl(var(--primary)/0.92)_100%)] dark:bg-[linear-gradient(180deg,rgba(63,111,205,0.48)_0%,rgba(78,34,152,0.9)_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15)_0%,transparent_45%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(185,206,255,0.26)_0%,transparent_48%)]" />
                <div className="relative z-10 flex h-full flex-col justify-between p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="inline-flex rounded-full border border-white/25 bg-black/20 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-white">
                      SISWIT
                    </span>
                    <Link
                      to="/"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/95 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to website
                    </Link>
                  </div>

                  <div className="space-y-4">
                    <p className="max-w-[220px] text-2xl font-semibold leading-tight text-white">
                      Secure access, shared workspaces, better collaboration.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-10 rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <section className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
              <div className="mx-auto w-full max-w-sm">
                <div className="mb-6 flex items-center justify-between lg:hidden">
                  <span className="inline-flex rounded-full border border-border/80 bg-card/80 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-foreground dark:border-white/20 dark:bg-white/5 dark:text-white">
                    SISWIT
                  </span>
                  <Link
                    to="/"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1 text-xs text-muted-foreground transition hover:bg-card dark:border-white/20 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to website
                  </Link>
                </div>

                <div className="space-y-2">
                  <p className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary dark:bg-primary/25 dark:text-primary-foreground">
                    Account Access
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-white">Sign in</h1>
                  <p className="text-sm text-muted-foreground dark:text-white/75">Access your organization workspace.</p>
                </div>

                <form onSubmit={onSubmit} className="mt-6 space-y-4">
                  <div>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      required
                      autoComplete="email"
                      className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
                    />
                  </div>

                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      autoComplete="current-password"
                      className="h-11 rounded-xl border-input/80 bg-background/80 pr-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-[#7c859e] dark:hover:text-[#313a52]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-1 text-sm dark:text-white/75">
                    <label className="flex items-center gap-2.5 text-muted-foreground dark:text-white/75">
                      <Checkbox
                        checked={rememberMe}
                        onCheckedChange={(v) => setRememberMe(Boolean(v))}
                        className="border-input data-[state=checked]:border-primary data-[state=checked]:bg-primary dark:border-white/40"
                      />
                      <span>Remember me</span>
                    </label>
                    <Link
                      to="/auth/forgot-password"
                      className="font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 dark:bg-[#9d84e8] dark:text-white dark:hover:bg-[#ad95f0] dark:shadow-[0_14px_34px_rgba(145,108,237,0.35)]"
                    disabled={submitting || loading}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </form>

                <div className="mt-6 space-y-2 border-t border-border/80 pt-5 text-sm text-muted-foreground dark:border-white/15 dark:text-white/70">
                  <p>
                    New organization?{" "}
                    <Link className="font-medium text-primary hover:underline" to="/auth/sign-up?tab=organization">
                      Sign up your organization
                    </Link>
                  </p>
                  <p>
                    Joining as client?{" "}
                    <Link className="font-medium text-primary hover:underline" to="/auth/sign-up?tab=client">
                      Client sign up
                    </Link>
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;

