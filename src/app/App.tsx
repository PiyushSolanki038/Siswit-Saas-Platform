import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/ui/shadcn/tooltip";
import { Toaster } from "@/ui/feedback/toaster";
import { Toaster as Sonner } from "@/ui/feedback/sonner";
import { ScrollToTop } from "@/ui/components/ScrollToTop";
import { ErrorBoundary } from "@/ui/components/ErrorBoundary";
import { useAuth } from "@/core/auth/useAuth";
import { AuthProvider } from "@/app/providers/AuthProvider";
import { useTenant } from "@/core/tenant/useTenant";
import { TenantProvider } from "@/app/providers/TenantProvider";
import { OrganizationProvider } from "@/app/providers/OrganizationProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import {
  CustomerRoute,
  OrganizationOwnerRoute,
  PendingApprovalRoute,
  PlatformAdminRoute,
  TenantAdminRoute,
} from "@/core/auth/components/ProtectedRoute";
import { TenantSlugGuard } from "@/core/auth/components/TenantSlugGuard";
import { PlatformAdminLayout } from "@/workspaces/platform/layout/PlatformAdminLayout";
import { TenantAdminLayout } from "@/workspaces/organization_admin/layout/TenantAdminLayout";
import { CustomerPortalLayout } from "@/workspaces/portal/layout/CustomerPortalLayout";
import { ImpersonationProvider } from "@/app/providers/ImpersonationProvider";
import {
  normalizeLegacyDashboardPath,
  platformPath,
  tenantPortalPath,
} from "@/core/utils/routes";
import { isPlatformRole, isTenantUserRole } from "@/core/types/roles";

const queryClient = new QueryClient();

const Auth = lazy(() => import("../workspaces/auth/pages/Auth"));
const SignUp = lazy(() => import("../workspaces/auth/pages/SignUp"));
const AcceptEmployeeInvitation = lazy(() => import("../workspaces/auth/pages/AcceptEmployeeInvitation"));
const AcceptClientInvitation = lazy(() => import("../workspaces/auth/pages/AcceptClientInvitation"));
const ForgotPassword = lazy(() => import("../workspaces/auth/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../workspaces/auth/pages/ResetPassword"));
const Index = lazy(() => import("../workspaces/website/pages/Index"));
const About = lazy(() => import("../workspaces/website/pages/About"));
const Contact = lazy(() => import("../workspaces/website/pages/Contact"));
const Pricing = lazy(() => import("../workspaces/website/pages/Pricing"));
const Products = lazy(() => import("../workspaces/website/pages/Products"));
const Solutions = lazy(() => import("../workspaces/website/pages/Solutions"));

const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const OrganizationOwnerLayout = lazy(() => import("../workspaces/organization/components/OrganizationOwnerLayout"));
const OrganizationOverviewPage = lazy(() => import("../workspaces/organization/pages/OrganizationOverviewPage"));
const OrganizationUsersPage = lazy(() => import("../workspaces/organization/pages/OrganizationUsersPage"));
const OrganizationInvitationsPage = lazy(() => import("../workspaces/organization/pages/OrganizationInvitationsPage"));
const OrganizationApprovalsPage = lazy(() => import("../workspaces/organization/pages/OrganizationApprovalsPage"));
const OrganizationPlansPage = lazy(() => import("../workspaces/organization/pages/OrganizationPlansPage"));
const OrganizationAlertsPage = lazy(() => import("../workspaces/organization/pages/OrganizationAlertsPage"));
const OrganizationSettingsPage = lazy(() => import("../workspaces/organization/pages/OrganizationSettingsPage"));

const Dashboard = lazy(() => import("../workspaces/employee/pages/Dashboard"));
const OrganizationAdminDashboard = lazy(
  () => import("../workspaces/organization_admin/pages/OrganizationAdminDashboard"),
);
const PlatformAdminDashboard = lazy(() => import("../workspaces/platform/pages/PlatformAdminDashboard"));
const TenantsPanel = lazy(() => import("../workspaces/platform/pages/panels/TenantsPanel"));
const UsersPanel = lazy(() => import("../workspaces/platform/pages/panels/UsersPanel"));
const BillingPanel = lazy(() => import("../workspaces/platform/pages/panels/BillingPanel"));
const SettingsPanel = lazy(() => import("../workspaces/platform/pages/panels/SettingsPanel"));
const AuditLogsPanel = lazy(() => import("../workspaces/platform/pages/panels/AuditLogsPanel"));

const PortalDashboard = lazy(() => import("../workspaces/portal/pages/PortalDashboard"));
const CustomerQuotesPage = lazy(() => import("../workspaces/portal/pages/CustomerQuotesPage"));
const CustomerContractsPage = lazy(() => import("../workspaces/portal/pages/CustomerContractsPage"));
const CustomerDocumentsPage = lazy(() => import("../workspaces/portal/pages/CustomerDocumentsPage"));
const CustomerPendingSignaturesPage = lazy(
  () => import("../workspaces/portal/pages/CustomerPendingSignaturesPage"),
);

const DocumentsDashboard = lazy(() => import("../modules/documents/pages/DocumentsDashboard"));
const DocumentTemplatesPage = lazy(() => import("../modules/documents/pages/DocumentTemplatesPage"));
const DocumentHistoryPage = lazy(() => import("../modules/documents/pages/DocumentHistoryPage"));
const DocumentCreatePage = lazy(() => import("../modules/documents/pages/DocumentCreatePage"));
const PendingSignaturesPage = lazy(() => import("../modules/documents/pages/PendingSignaturesPage"));
const DocumentESignPage = lazy(() => import("../modules/documents/pages/DocumentESignPage"));

const CLMDashboard = lazy(() => import("../modules/clm/pages/CLMDashboard"));
const ContractsPage = lazy(() => import("../modules/clm/pages/ContractsPage"));
const TemplatesPage = lazy(() => import("../modules/clm/pages/TemplatesPage"));

const CRMLayout = lazy(() => import("../modules/crm/pages/CRMLayout"));
const LeadsPage = lazy(() => import("../modules/crm/pages/LeadsPage"));
const OpportunitiesPage = lazy(() => import("../modules/crm/pages/OpportunitiesPage"));
const PipelinePage = lazy(() => import("../modules/crm/pages/PipelinePage"));
const AccountsPage = lazy(() => import("../modules/crm/pages/AccountsPage"));
const ContactsPage = lazy(() => import("../modules/crm/pages/ContactsPage"));
const ActivitiesPage = lazy(() => import("../modules/crm/pages/ActivitiesPage"));

const CPQDashboard = lazy(() => import("../modules/cpq/pages/CPQDashboard"));
const ProductsPage = lazy(() => import("../modules/cpq/pages/ProductsPage"));
const QuoteDetailPage = lazy(() => import("../modules/cpq/pages/QuoteDetailPage"));
const QuotesListPage = lazy(() => import("../modules/cpq/pages/QuotesListPage"));
const QuoteBuilderPage = lazy(() => import("../modules/cpq/pages/QuoteBuilderPage"));

const ERPDashboard = lazy(() => import("../modules/erp/pages/ERPDashboard"));
const InventoryPage = lazy(() => import("../modules/erp/pages/InventoryPage"));
const ProcurementPage = lazy(() => import("../modules/erp/pages/ProcurementPage"));
const ProductionPage = lazy(() => import("../modules/erp/pages/ProductionPage"));
const FinancePage = lazy(() => import("../modules/erp/pages/FinancePage"));

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function LegacyDashboardRedirect() {
  const location = useLocation();
  const { role, loading } = useAuth();
  const { tenant, tenantLoading } = useTenant();

  if (loading || tenantLoading) return <RouteLoader />;

  if (isPlatformRole(role)) {
    const rest = location.pathname.replace(/^\/dashboard\/?/, "");
    return <Navigate to={platformPath(rest)} replace />;
  }

  if (!tenant?.slug) return <Navigate to="/auth/sign-in" replace />;

  const rest = location.pathname.replace(/^\/dashboard\/?/, "");
  return <Navigate to={normalizeLegacyDashboardPath(tenant.slug, rest)} replace />;
}

function LegacyPortalRedirect() {
  const location = useLocation();
  const { loading } = useAuth();
  const { tenant, tenantLoading } = useTenant();

  if (loading || tenantLoading) return <RouteLoader />;
  if (!tenant?.slug) return <Navigate to="/auth/sign-in" replace />;

  const rest = location.pathname.replace(/^\/portal\/?/, "");
  return <Navigate to={tenantPortalPath(tenant.slug, rest)} replace />;
}

function LegacyAdminRedirect() {
  const location = useLocation();
  const rest = location.pathname.replace(/^\/admin\/?/, "");
  return <Navigate to={platformPath(rest)} replace />;
}

function RootRedirect() {
  const { role, loading } = useAuth();
  const { tenant, tenantLoading } = useTenant();

  if (loading || tenantLoading) return <RouteLoader />;

  if (isPlatformRole(role)) {
    return <Navigate to="/platform" replace />;
  }

  if (tenant?.slug) {
    return <Navigate to={`/${tenant.slug}/app/dashboard`} replace />;
  }

  return <Navigate to="/auth/sign-in" replace />;
}

function TenantWorkspaceDashboard() {
  const { role } = useAuth();

  if (isTenantUserRole(role)) {
    return <Dashboard />;
  }

  return <OrganizationAdminDashboard />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Index />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/products" element={<Products />} />
        <Route path="/solutions" element={<Solutions />} />

        <Route path="/auth" element={<Navigate to="/auth/sign-in" replace />} />
        <Route path="/auth/sign-in" element={<Auth />} />
        <Route path="/auth/sign-up" element={<SignUp />} />
        <Route path="/auth/company-signup" element={<Navigate to="/auth/sign-up?tab=organization" replace />} />
        <Route path="/auth/organization-signup" element={<Navigate to="/auth/sign-up?tab=organization" replace />} />
        <Route path="/auth/client-signup" element={<Navigate to="/auth/sign-up?tab=client" replace />} />
        <Route path="/auth/accept-invitation" element={<AcceptEmployeeInvitation />} />
        <Route path="/auth/accept-client-invitation" element={<AcceptClientInvitation />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route
          path="/auth/pending-approval"
          element={
            <PendingApprovalRoute>
              <PendingApproval />
            </PendingApprovalRoute>
          }
        />
        <Route
          path="/pending-approval"
          element={
            <PendingApprovalRoute>
              <PendingApproval />
            </PendingApprovalRoute>
          }
        />
        <Route
          path="/organization"
          element={
            <OrganizationOwnerRoute>
              <OrganizationOwnerLayout />
            </OrganizationOwnerRoute>
          }
        >
          <Route index element={<Navigate to="/organization/overview" replace />} />
          <Route path="overview" element={<OrganizationOverviewPage />} />
          <Route path="users" element={<OrganizationUsersPage />} />
          <Route path="invitations" element={<OrganizationInvitationsPage />} />
          <Route path="approvals" element={<OrganizationApprovalsPage />} />
          <Route path="plans" element={<OrganizationPlansPage />} />
          <Route path="alerts" element={<OrganizationAlertsPage />} />
          <Route path="settings" element={<OrganizationSettingsPage />} />
        </Route>

        {/* Platform */}
        <Route
          path="/platform"
          element={
            <PlatformAdminRoute>
              <PlatformAdminLayout />
            </PlatformAdminRoute>
          }
        >
          <Route index element={<PlatformAdminDashboard />} />
          <Route path="tenants" element={<TenantsPanel />} />
          <Route path="users" element={<UsersPanel />} />
          <Route path="billing" element={<BillingPanel />} />
          <Route path="settings" element={<SettingsPanel />} />
          <Route path="audit-logs" element={<AuditLogsPanel />} />
          <Route path="logs" element={<Navigate to="/platform/audit-logs" replace />} />
        </Route>

        {/* Tenant Portal */}
        <Route
          path="/:tenantSlug/app/portal"
          element={
            <TenantSlugGuard>
              <CustomerRoute>
                <CustomerPortalLayout />
              </CustomerRoute>
            </TenantSlugGuard>
          }
        >
          <Route index element={<PortalDashboard />} />
          <Route path="quotes" element={<CustomerQuotesPage />} />
          <Route path="contracts" element={<CustomerContractsPage />} />
          <Route path="contract-templates" element={<TemplatesPage />} />
          <Route path="documents" element={<CustomerDocumentsPage />} />
          <Route path="document-create" element={<DocumentCreatePage />} />
          <Route path="document-history" element={<DocumentHistoryPage />} />
          <Route path="pending-signatures" element={<CustomerPendingSignaturesPage />} />
          <Route path="settings" element={<Navigate to=".." replace />} />
        </Route>

        {/* Tenant Workspace */}
        <Route
          path="/:tenantSlug/app"
          element={
            <TenantSlugGuard>
              <TenantAdminRoute>
                <TenantAdminLayout />
              </TenantAdminRoute>
            </TenantSlugGuard>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<TenantWorkspaceDashboard />} />
          <Route path="analytics" element={<Dashboard />} />

          <Route path="cpq" element={<CPQDashboard />} />
          <Route path="cpq/products" element={<ProductsPage />} />
          <Route path="cpq/quotes" element={<QuotesListPage />} />
          <Route path="cpq/quotes/new" element={<QuoteBuilderPage />} />
          <Route path="cpq/quotes/:id" element={<QuoteDetailPage />} />
          <Route path="cpq/quotes/:id/edit" element={<QuoteBuilderPage />} />

          <Route path="clm" element={<CLMDashboard />} />
          <Route path="clm/contracts" element={<ContractsPage />} />
          <Route path="clm/templates" element={<TemplatesPage />} />

          <Route path="crm" element={<CRMLayout />} />
          <Route path="crm/leads" element={<LeadsPage />} />
          <Route path="crm/pipeline" element={<PipelinePage />} />
          <Route path="crm/accounts" element={<AccountsPage />} />
          <Route path="crm/contacts" element={<ContactsPage />} />
          <Route path="crm/opportunities" element={<OpportunitiesPage />} />
          <Route path="crm/activities" element={<ActivitiesPage />} />

          <Route path="documents" element={<DocumentsDashboard />} />
          <Route path="documents/create" element={<DocumentCreatePage />} />
          <Route path="documents/templates" element={<DocumentTemplatesPage />} />
          <Route path="documents/history" element={<DocumentHistoryPage />} />
          <Route path="documents/pending" element={<PendingSignaturesPage />} />
          <Route path="documents/:id/esign" element={<DocumentESignPage />} />

          <Route path="erp" element={<ERPDashboard />} />
          <Route path="erp/inventory" element={<InventoryPage />} />
          <Route path="erp/procurement" element={<ProcurementPage />} />
          <Route path="erp/production" element={<ProductionPage />} />
          <Route path="erp/finance" element={<FinancePage />} />
          <Route path="settings" element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Root organization slug convenience */}
        <Route path="/:tenantSlug" element={<Navigate to="app/dashboard" replace />} />

        {/* Legacy redirect layer */}
        <Route path="/admin/*" element={<LegacyAdminRedirect />} />
        <Route path="/dashboard/*" element={<LegacyDashboardRedirect />} />
        <Route path="/portal/*" element={<LegacyPortalRedirect />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary>
          <BrowserRouter>
            <ScrollToTop />
            <AuthProvider>
              <ImpersonationProvider>
                <OrganizationProvider>
                  <TenantProvider>
                    <AppRoutes />
                  </TenantProvider>
                </OrganizationProvider>
              </ImpersonationProvider>
            </AuthProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
