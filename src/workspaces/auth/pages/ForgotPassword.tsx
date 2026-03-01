import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { useAuth } from "@/core/auth/useAuth";
import { useToast } from "@/core/hooks/use-toast";
import heroBg from "@/assets/hero-bg.jpg";

const COOLDOWN_SECONDS = 60;

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (cooldown > 0) return;

    setSubmitting(true);

    const { error } = await sendPasswordReset(email.trim());

    setSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Unable to send reset email",
        description: error,
      });
      return;
    }

    setSubmitted(true);
    setCooldown(COOLDOWN_SECONDS);
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
              <div className="relative h-full min-h-[440px] overflow-hidden rounded-2xl border border-white/20 shadow-2xl dark:border-white/15 dark:shadow-[0_18px_48px_rgba(18,9,45,0.5)]">
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
                      Don't worry, we've got you covered.
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
                    Account Recovery
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-white">Forgot password</h1>
                  <p className="text-sm text-muted-foreground dark:text-white/75">
                    Enter your email and we'll send you a reset link.
                  </p>
                </div>

                <form onSubmit={onSubmit} className="mt-6 space-y-4">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
                  />

                  <Button
                    className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 dark:bg-[#9d84e8] dark:text-white dark:hover:bg-[#ad95f0] dark:shadow-[0_14px_34px_rgba(145,108,237,0.35)]"
                    type="submit"
                    disabled={submitting || cooldown > 0}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : cooldown > 0 ? (
                      `Resend in ${cooldown}s`
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>

                  {submitted && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      If this email is registered, you will receive a password reset link. Please also check your spam folder.
                    </p>
                  )}
                </form>

                <div className="mt-6 border-t border-border/80 pt-5 text-sm text-muted-foreground dark:border-white/15 dark:text-white/70">
                  Remembered your password?{" "}
                  <Link className="font-medium text-primary hover:underline" to="/auth/sign-in">
                    Sign in
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
