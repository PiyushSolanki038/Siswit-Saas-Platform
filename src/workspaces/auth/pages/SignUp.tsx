import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Search } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Tabs, TabsList, TabsTrigger } from "@/ui/shadcn/tabs";
import { useToast } from "@/core/hooks/use-toast";
import { useAuth } from "@/core/auth/useAuth";
import { supabase } from "@/core/api/client";
import heroBg from "@/assets/hero-bg.jpg";

type SignupTab = "organization" | "client";

type SignupOrganizationRow = {
  id: string;
  name: string;
  slug: string;
  org_code: string;
};

function makeCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5) || "ORG";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${suffix}`;
}

function PasswordStrength({ password }: { password: string }) {
  const hasLength = password.length >= 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passed = [hasLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

  if (!password) return null;

  const barColor =
    passed <= 2 ? "bg-red-500" : passed <= 3 ? "bg-amber-500" : passed <= 4 ? "bg-blue-500" : "bg-green-500";
  const label = passed <= 2 ? "Weak" : passed <= 3 ? "Fair" : passed <= 4 ? "Good" : "Strong";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${(passed / 5) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
        <li className={hasLength ? "text-green-600 dark:text-green-400" : ""}>• 12+ characters</li>
        <li className={hasUpper ? "text-green-600 dark:text-green-400" : ""}>• Uppercase letter</li>
        <li className={hasLower ? "text-green-600 dark:text-green-400" : ""}>• Lowercase letter</li>
        <li className={hasNumber ? "text-green-600 dark:text-green-400" : ""}>• Number</li>
        <li className={hasSpecial ? "text-green-600 dark:text-green-400" : ""}>• Special character</li>
      </ul>
    </div>
  );
}

export default function SignUp() {
  const { signUpOrganization, signUpClientSelf, loading } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: SignupTab = searchParams.get("tab") === "client" ? "client" : "organization";

  const [organizationName, setOrganizationName] = useState("");
  const [organizationCode, setOrganizationCode] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [organizationEmail, setOrganizationEmail] = useState("");
  const [organizationPassword, setOrganizationPassword] = useState("");
  const [organizationConfirmPassword, setOrganizationConfirmPassword] = useState("");
  const [organizationSubmitting, setOrganizationSubmitting] = useState(false);
  const [organizationSubmitted, setOrganizationSubmitted] = useState(false);

  const [organizationLookup, setOrganizationLookup] = useState("");
  const [organizationSearchResults, setOrganizationSearchResults] = useState<SignupOrganizationRow[]>([]);
  const [organizationSearchLoading, setOrganizationSearchLoading] = useState(false);
  const [selectedOrganization, setSelectedOrganization] = useState<SignupOrganizationRow | null>(null);

  const [clientFullName, setClientFullName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [clientConfirmPassword, setClientConfirmPassword] = useState("");
  const [clientSubmitting, setClientSubmitting] = useState(false);
  const [clientSubmitted, setClientSubmitted] = useState(false);
  const [organizationSearchDone, setOrganizationSearchDone] = useState(false);

  const suggestedCode = useMemo(() => makeCode(organizationName || "ORG"), [organizationName]);

  useEffect(() => {
    if (activeTab !== "client") {
      setOrganizationSearchResults([]);
      setOrganizationSearchLoading(false);
      return;
    }

    const query = organizationLookup.trim();
    if (query.length < 2) {
      setOrganizationSearchResults([]);
      setOrganizationSearchLoading(false);
      setOrganizationSearchDone(false);
      return;
    }

    let cancelled = false;
    setOrganizationSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("search_signup_organizations", {
          p_query: query,
          p_limit: 8,
        });

        if (cancelled) return;

        if (error || !Array.isArray(data)) {
          setOrganizationSearchResults([]);
          return;
        }

        const rows = data.filter(
          (row: unknown): row is SignupOrganizationRow =>
            Boolean(
              row &&
              typeof row === "object" &&
              "id" in row &&
              "name" in row &&
              "slug" in row &&
              "org_code" in row,
            ),
        );

        setOrganizationSearchResults(rows);
      } catch {
        if (!cancelled) {
          setOrganizationSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setOrganizationSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeTab, organizationLookup]);

  const setTab = (value: string) => {
    if (value !== "organization" && value !== "client") return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  const onOrganizationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (organizationPassword !== organizationConfirmPassword) {
      toast({
        variant: "destructive",
        title: "Password mismatch",
        description: "Password and confirm password must match.",
      });
      return;
    }

    setOrganizationSubmitting(true);

    const { error } = await signUpOrganization({
      organizationName,
      organizationCode: organizationCode || suggestedCode,
      ownerFullName,
      email: organizationEmail,
      password: organizationPassword,
    });

    setOrganizationSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error,
      });
      return;
    }

    setOrganizationSubmitted(true);
  };

  const onClientSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!organizationLookup.trim()) {
      toast({
        variant: "destructive",
        title: "Organization required",
        description: "Select or enter an organization name, slug, or code.",
      });
      return;
    }

    if (clientPassword !== clientConfirmPassword) {
      toast({
        variant: "destructive",
        title: "Password mismatch",
        description: "Password and confirm password must match.",
      });
      return;
    }

    setClientSubmitting(true);

    const { error } = await signUpClientSelf({
      organizationSlugOrCode: organizationLookup.trim(),
      fullName: clientFullName,
      email: clientEmail,
      phoneNumber: clientPhone || undefined,
      password: clientPassword,
    });

    setClientSubmitting(false);

    if (error) {
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: error,
      });
      return;
    }

    setClientSubmitted(true);
  };

  const onSelectOrganization = (organization: SignupOrganizationRow) => {
    setSelectedOrganization(organization);
    setOrganizationLookup(organization.slug);
    setOrganizationSearchResults([]);
  };

  const onLookupChange = (value: string) => {
    setOrganizationLookup(value);
    if (!selectedOrganization) return;
    const normalized = value.trim().toLowerCase();
    const selectedSlug = selectedOrganization.slug.toLowerCase();
    const selectedCode = selectedOrganization.org_code.toLowerCase();
    if (normalized !== selectedSlug && normalized !== selectedCode) {
      setSelectedOrganization(null);
    }
  };

  const renderOrganizationBody = () => {
    if (organizationSubmitted) {
      return (
        <div className="mt-6 rounded-xl border border-success/0 bg-success/10 p-5">
          <h2 className="text-lg font-semibold text-foreground">Organization created</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account was created and a verification email has been sent. Verify your email, then sign in.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/auth/sign-in">Go to sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </div>
      );
    }

    return (
      <form onSubmit={onOrganizationSubmit} className="mt-6 space-y-4">
        <Input
          placeholder="Organization Name"
          value={organizationName}
          onChange={(event) => setOrganizationName(event.target.value)}
          required
          className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
        />
        <Input
          placeholder={`Organization Code (suggested: ${suggestedCode})`}
          value={organizationCode}
          onChange={(event) => setOrganizationCode(event.target.value.toUpperCase())}
          maxLength={20}
          className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
        />
        <Input
          placeholder="Owner Full Name"
          value={ownerFullName}
          onChange={(event) => setOwnerFullName(event.target.value)}
          required
          autoComplete="name"
          className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
        />
        <Input
          type="email"
          placeholder="Owner Email"
          value={organizationEmail}
          onChange={(event) => setOrganizationEmail(event.target.value)}
          required
          autoComplete="email"
          className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
        />
        <Input
          type="password"
          placeholder="Password"
          value={organizationPassword}
          onChange={(event) => setOrganizationPassword(event.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
          className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
        />
        <PasswordStrength password={organizationPassword} />
        <Input
          type="password"
          placeholder="Confirm Password"
          value={organizationConfirmPassword}
          onChange={(event) => setOrganizationConfirmPassword(event.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
          className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
        />

        <Button
          className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 dark:bg-[#9d84e8] dark:text-white dark:hover:bg-[#ad95f0] dark:shadow-[0_14px_34px_rgba(145,108,237,0.35)]"
          type="submit"
          disabled={organizationSubmitting || loading}
        >
          {organizationSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Organization"
          )}
        </Button>
      </form>
    );
  };

  const renderClientBody = () => {
    if (clientSubmitted) {
      return (
        <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-5">
          <h2 className="text-lg font-semibold text-foreground">Registration submitted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Verify your email address and wait for organization approval before portal access.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link to="/auth/sign-in">Go to sign in</Link>
            </Button>
          </div>
        </div>
      );
    }

    return (
      <form onSubmit={onClientSubmit} className="mt-6 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search organization name, slug, or code"
            value={organizationLookup}
            onChange={(event) => onLookupChange(event.target.value)}
            required
            className="h-11 rounded-xl border-input/80 bg-background/80 pl-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
          />

          {organizationSearchLoading && (
            <p className="mt-2 text-xs text-muted-foreground">Searching organizations...</p>
          )}

          {!organizationSearchLoading && organizationSearchResults.length > 0 && (
            <div className="mt-2 max-h-52 overflow-auto rounded-xl border border-input/80 bg-card/95 p-1 shadow-lg dark:border-white/20 dark:bg-[#151224]/95">
              {organizationSearchResults.map((organization) => (
                <button
                  key={organization.id}
                  type="button"
                  onClick={() => onSelectOrganization(organization)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-primary/10"
                >
                  <span>
                    <span className="font-medium">{organization.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {organization.slug} / {organization.org_code}
                    </span>
                  </span>
                  <Check className="h-4 w-4 opacity-60" />
                </button>
              ))}
            </div>
          )}

          {!organizationSearchLoading && organizationSearchDone && organizationSearchResults.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">No organizations found. Check the name, slug, or code and try again.</p>
          )}
        </div>

        {selectedOrganization && (
          <p className="text-xs text-muted-foreground">
            Selected organization: <span className="font-medium">{selectedOrganization.name}</span> (
            {selectedOrganization.slug})
          </p>
        )}

        <Input
          placeholder="Full Name"
          value={clientFullName}
          onChange={(event) => setClientFullName(event.target.value)}
          required
          className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
        />
        <Input
          type="email"
          placeholder="Email"
          value={clientEmail}
          onChange={(event) => setClientEmail(event.target.value)}
          required
          className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
        />
        <Input
          placeholder="Phone (optional)"
          value={clientPhone}
          onChange={(event) => setClientPhone(event.target.value)}
          className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
        />
        <Input
          type="password"
          placeholder="Password"
          value={clientPassword}
          onChange={(event) => setClientPassword(event.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
          className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
        />
        <PasswordStrength password={clientPassword} />
        <Input
          type="password"
          placeholder="Confirm Password"
          value={clientConfirmPassword}
          onChange={(event) => setClientConfirmPassword(event.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
          className="h-11 rounded-xl border-input/80 bg-background/80 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-0 dark:border-[#d5dbea]/80 dark:bg-[#c3c9d8] dark:text-[#1a2233] dark:placeholder:text-[#5f687e]"
        />

        <Button
          className="h-11 w-full rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 dark:bg-[#9d84e8] dark:text-white dark:hover:bg-[#ad95f0] dark:shadow-[0_14px_34px_rgba(145,108,237,0.35)]"
          type="submit"
          disabled={clientSubmitting || loading}
        >
          {clientSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Client Account"
          )}
        </Button>
      </form>
    );
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
                    <p className="max-w-[230px] text-2xl font-semibold leading-tight text-white">
                      Create your workspace and onboard people the right way.
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
                    Account Creation
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground dark:text-white">Sign up</h1>
                  <p className="text-sm text-muted-foreground dark:text-white/75">
                    {activeTab === "organization"
                      ? "Create your organization owner account."
                      : "Join an existing organization as a client."}
                  </p>
                </div>

                <Tabs value={activeTab} onValueChange={setTab} className="mt-6">
                  <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-accent/0 p-1 dark:border dark:border-white/10 dark:bg-white/5">
                    <TabsTrigger
                      value="organization"
                      className="rounded-lg text-sm font-medium text-foreground/80 dark:text-white/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-[#9d84e8] dark:data-[state=active]:text-white"
                    >
                      Organization
                    </TabsTrigger>
                    <TabsTrigger
                      value="client"
                      className="rounded-lg text-sm font-medium text-foreground/80 dark:text-white/70 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground dark:data-[state=active]:bg-[#9d84e8] dark:data-[state=active]:text-white"
                    >
                      Client
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {activeTab === "organization" ? renderOrganizationBody() : renderClientBody()}

                <div className="mt-6 border-t border-border/80 pt-5 text-sm text-muted-foreground dark:border-white/15 dark:text-white/70">
                  Already have an account?{" "}
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

