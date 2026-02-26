import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ScrollToTop } from "@/components/ScrollToTop";
import { useAuth } from "@/hooks/useAuth";
import { AuthProvider } from "@/hooks/AuthProvider";
import { useTenant } from "@/hooks/useTenant";
import { TenantProvider } from "@/hooks/TenantProvider";
import { OrganizationProvider } from "@/hooks/OrganizationProvider";
import { ThemeProvider } from "@/hooks/ThemeProvider";
import {
  CustomerRoute,
  OrganizationOwnerRoute,
  PendingApprovalRoute,
  PlatformAdminRoute,
  TenantAdminRoute,
} from "@/components/auth/ProtectedRoute";
import { TenantSlugGuard } from "@/components/auth/TenantSlugGuard";
import { PlatformAdminLayout } from "@/components/platform/PlatformAdminLayout";
import { TenantAdminLayout } from "@/components/tenant/TenantAdminLayout";
import { CustomerPortalLayout } from "@/components/customer/CustomerPortalLayout";
import { ImpersonationProvider } from "@/app/providers/ImpersonationProvider";
import {
  normalizeLegacyDashboardPath,
  platformPath,
  tenantPortalPath,
} from "@/lib/routes";
import { isPlatformRole } from "@/types/roles";

const queryClient = new QueryClient();

const Index = lazy(() => import("./pages/Index"));
const Products = lazy(() => import("./pages/Products"));
const Solutions = lazy(() => import("./pages/Solutions"));
const Pricing = lazy(() => import("./pages/Pricing"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Auth = lazy(() => import("./pages/Auth"));
const SignUp = lazy(() => import("./pages/SignUp"));
const AcceptEmployeeInvitation = lazy(() => import("./pages/AcceptEmployeeInvitation"));
const AcceptClientInvitation = lazy(() => import("./pages/AcceptClientInvitation"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const OrganizationOwnerLayout = lazy(() => import("./components/organization/OrganizationOwnerLayout"));
const OrganizationOverviewPage = lazy(() => import("./pages/organization/OrganizationOverviewPage"));
const OrganizationUsersPage = lazy(() => import("./pages/organization/OrganizationUsersPage"));
const OrganizationInvitationsPage = lazy(() => import("./pages/organization/OrganizationInvitationsPage"));
const OrganizationApprovalsPage = lazy(() => import("./pages/organization/OrganizationApprovalsPage"));
const OrganizationPlansPage = lazy(() => import("./pages/organization/OrganizationPlansPage"));
const OrganizationAlertsPage = lazy(() => import("./pages/organization/OrganizationAlertsPage"));
const OrganizationSettingsPage = lazy(() => import("./pages/organization/OrganizationSettingsPage"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const PlatformAdminDashboard = lazy(() => import("./pages/admin/PlatformAdminDashboard"));
const TenantsPanel = lazy(() => import("./pages/admin/panels/TenantsPanel"));
const UsersPanel = lazy(() => import("./pages/admin/panels/UsersPanel"));
const BillingPanel = lazy(() => import("./pages/admin/panels/BillingPanel"));
const SettingsPanel = lazy(() => import("./pages/admin/panels/SettingsPanel"));
const AuditLogsPanel = lazy(() => import("./pages/admin/panels/AuditLogsPanel"));

const PortalDashboard = lazy(() => import("./pages/portal/PortalDashboard"));
const CustomerQuotesPage = lazy(() => import("./pages/portal/CustomerQuotesPage"));
const CustomerContractsPage = lazy(() => import("./pages/portal/CustomerContractsPage"));
const CustomerDocumentsPage = lazy(() => import("./pages/portal/CustomerDocumentsPage"));
const CustomerPendingSignaturesPage = lazy(
  () => import("./pages/portal/CustomerPendingSignaturesPage"),
);

const DocumentsDashboard = lazy(() => import("./pages/documents/DocumentsDashboard"));
const DocumentTemplatesPage = lazy(() => import("./pages/documents/DocumentTemplatesPage"));
const DocumentHistoryPage = lazy(() => import("./pages/documents/DocumentHistoryPage"));
const DocumentCreatePage = lazy(() => import("./pages/documents/DocumentCreatePage"));
const PendingSignaturesPage = lazy(() => import("./pages/documents/PendingSignaturesPage"));
const DocumentESignPage = lazy(() => import("./pages/documents/DocumentESignPage"));

const CLMDashboard = lazy(() => import("./pages/clm/CLMDashboard"));
const ContractsPage = lazy(() => import("./pages/clm/ContractsPage"));
const TemplatesPage = lazy(() => import("./pages/clm/TemplatesPage"));

const CRMLayout = lazy(() => import("./pages/crm/CRMLayout"));
const LeadsPage = lazy(() => import("./pages/crm/LeadsPage"));
const OpportunitiesPage = lazy(() => import("./pages/crm/OpportunitiesPage"));
const PipelinePage = lazy(() => import("./pages/crm/PipelinePage"));
const AccountsPage = lazy(() => import("./pages/crm/AccountsPage"));
const ContactsPage = lazy(() => import("./pages/crm/ContactsPage"));
const ActivitiesPage = lazy(() => import("./pages/crm/ActivitiesPage"));

const CPQDashboard = lazy(() => import("./pages/cpq/CPQDashboard"));
const ProductsPage = lazy(() => import("./pages/cpq/ProductsPage"));
const QuoteDetailPage = lazy(() => import("./pages/cpq/QuoteDetailPage"));
const QuotesListPage = lazy(() => import("./pages/cpq/QuotesListPage"));
const QuoteBuilderPage = lazy(() => import("./pages/cpq/QuoteBuilderPage"));

const ERPDashboard = lazy(() => import("./pages/erp/ERPDashboard"));
const InventoryPage = lazy(() => import("./pages/erp/InventoryPage"));
const ProcurementPage = lazy(() => import("./pages/erp/ProcurementPage"));
const ProductionPage = lazy(() => import("./pages/erp/ProductionPage"));
const FinancePage = lazy(() => import("./pages/erp/FinancePage"));

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

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Index />} />
        <Route path="/products" element={<Products />} />
        <Route path="/solutions" element={<Solutions />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
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
          <Route path="settings" element={<PortalDashboard />} />
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
          <Route path="dashboard" element={<Dashboard />} />
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
          <Route path="settings" element={<Dashboard />} />
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
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
