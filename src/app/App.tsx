import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { QueryClientProvider } from "@tanstack/react-query";
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
import { ModuleGate } from "@/core/auth/components/ModuleGate";
import { PlatformAdminLayout } from "@/workspaces/platform/layout/PlatformAdminLayout";
import { TenantAdminLayout } from "@/workspaces/organization_admin/layout/TenantAdminLayout";
import { CustomerPortalLayout } from "@/workspaces/portal/layout/CustomerPortalLayout";
import { ImpersonationProvider } from "@/app/providers/ImpersonationProvider";
import { DocumentsRealtimeProvider } from "@/modules/documents/providers/DocumentsRealtimeProvider";
import {
  normalizeLegacyDashboardPath,
  platformPath,
  tenantPortalPath,
} from "@/core/utils/routes";
import { isPlatformRole, isTenantUserRole } from "@/core/types/roles";

import { queryClient } from "@/core/utils/cache";

const Auth = lazy(() => import("../workspaces/auth/pages/Auth"));
const SignUp = lazy(() => import("../workspaces/auth/pages/SignUp"));
const AcceptEmployeeInvitation = lazy(() => import("../workspaces/auth/pages/AcceptEmployeeInvitation"));
const AcceptClientInvitation = lazy(() => import("../workspaces/auth/pages/AcceptClientInvitation"));
const ForgotPassword = lazy(() => import("../workspaces/auth/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("../workspaces/auth/pages/ResetPassword"));
const VerifySuccess = lazy(() => import("../workspaces/auth/pages/VerifySuccess"));
const Index = lazy(() => import("../workspaces/website/pages/Index"));
const About = lazy(() => import("../workspaces/website/pages/About"));
const Contact = lazy(() => import("../workspaces/website/pages/Contact"));
const Pricing = lazy(() => import("../workspaces/website/pages/Pricing"));
const Products = lazy(() => import("../workspaces/website/pages/Products"));
const Solutions = lazy(() => import("../workspaces/website/pages/Solutions"));
const Privacy = lazy(() => import("../workspaces/website/pages/Privacy"));
const Terms = lazy(() => import("../workspaces/website/pages/Terms"));
const Cookies = lazy(() => import("../workspaces/website/pages/Cookies"));

const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const OrganizationOwnerLayout = lazy(() => import("../workspaces/organization/components/OrganizationOwnerLayout"));
const OrganizationOverviewPage = lazy(() => import("../workspaces/organization/pages/OrganizationOverviewPage"));
const OrganizationUsersPage = lazy(() => import("../workspaces/organization/pages/OrganizationUsersPage"));
const OrganizationInvitationsPage = lazy(() => import("../workspaces/organization/pages/OrganizationInvitationsPage"));
const OrganizationApprovalsPage = lazy(() => import("../workspaces/organization/pages/OrganizationApprovalsPage"));
const OrganizationSubscriptionPage = lazy(() => import("../workspaces/organization/pages/OrganizationSubscriptionPage"));
const OrganizationAlertsPage = lazy(() => import("../workspaces/organization_admin/pages/OrganizationAlertsPage"));
const OrganizationSettingsPage = lazy(() => import("../workspaces/organization/pages/OrganizationSettingsPage"));
const OrganizationPerformancePage = lazy(() => import("../workspaces/organization/pages/OrganizationPerformancePage"));

const Dashboard = lazy(() => import("../workspaces/employee/pages/Dashboard"));
const EmployeeAlertsPage = lazy(() => import("../workspaces/employee/pages/EmployeeAlertsPage"));
const EmployeeSettingsPage = lazy(() => import("../workspaces/employee/pages/EmployeeSettingsPage"));

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
const CustomerQuoteDetailPage = lazy(() => import("../workspaces/portal/pages/CustomerQuoteDetailPage"));
const CustomerContractDetailPage = lazy(() => import("../workspaces/portal/pages/CustomerContractDetailPage"));
const CustomerSignaturePage = lazy(() => import("../workspaces/portal/pages/CustomerSignaturePage"));

const DocumentsDashboard = lazy(() => import("../modules/documents/pages/DocumentsDashboard"));
const DocumentTemplatesPage = lazy(() => import("../modules/documents/pages/DocumentTemplatesPage"));
const DocumentHistoryPage = lazy(() => import("../modules/documents/pages/DocumentHistoryPage"));
const DocumentCreatePage = lazy(() => import("../modules/documents/pages/DocumentCreatePage"));
const PendingSignaturesPage = lazy(() => import("../modules/documents/pages/PendingSignaturesPage"));
const DocumentESignPage = lazy(() => import("../modules/documents/pages/DocumentESignPage"));

const CLMDashboard = lazy(() => import("../modules/clm/pages/CLMDashboard"));
const ContractsListPage = lazy(() => import("../modules/clm/pages/ContractsListPage"));
const ContractBuilderPage = lazy(() => import("../modules/clm/pages/ContractBuilderPage"));
const ContractDetailPage = lazy(() => import("../modules/clm/pages/ContractDetailPage"));
const ContractScanPage = lazy(() => import("../modules/clm/pages/ContractScanPage"));
const ESignaturePage = lazy(() => import("../modules/clm/pages/ESignaturePage"));
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

// W-06: Guard /:tenantSlug against reserved root segments
function TenantSlugRedirect() {
  const { tenantSlug } = useParams();
  const reservedSegments = ["auth", "platform", "admin", "dashboard", "portal", "api"];
  if (!tenantSlug || reservedSegments.includes(tenantSlug.toLowerCase())) {
    return <NotFound />;
  }
  return <Navigate to="app/dashboard" replace />;
}

function TenantWorkspaceDashboard() {
  const { role } = useAuth();

  if (isTenantUserRole(role)) {
    return <Dashboard />;
  }

  return <OrganizationAdminDashboard />;
}

function EmployeeAlertsRoute() {
  const { role } = useAuth();
  if (isTenantUserRole(role)) return <EmployeeAlertsPage />;
  return <OrganizationAlertsPage />;
}

function EmployeeSettingsRoute() {
  const { role } = useAuth();
  if (isTenantUserRole(role)) return <EmployeeSettingsPage />;
  return <OrganizationSettingsPage />;
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
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/cookies" element={<Cookies />} />

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
        <Route path="/auth/verify-success" element={<VerifySuccess />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
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
          <Route path="performance" element={<OrganizationPerformancePage />} />
          <Route path="analytics" element={<Navigate to="/organization/performance" replace />} />
          <Route path="users" element={<OrganizationUsersPage />} />
          <Route path="invitations" element={<OrganizationInvitationsPage />} />
          <Route path="approvals" element={<OrganizationApprovalsPage />} />
          <Route path="subscription" element={<OrganizationSubscriptionPage />} />
          <Route path="plans" element={<Navigate to="/organization/subscription" replace />} />
          <Route path="billing" element={<Navigate to="/organization/subscription" replace />} />
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
          <Route path="quotes/:id" element={<CustomerQuoteDetailPage />} />
          <Route path="contracts" element={<CustomerContractsPage />} />
          <Route path="contracts/:id" element={<CustomerContractDetailPage />} />
          <Route path="contract-templates" element={<TemplatesPage />} />
          <Route path="documents" element={<CustomerDocumentsPage />} />
          <Route
            path="document-create"
            element={
              <DocumentsRealtimeProvider>
                <DocumentCreatePage />
              </DocumentsRealtimeProvider>
            }
          />
          <Route
            path="document-history"
            element={
              <DocumentsRealtimeProvider>
                <DocumentHistoryPage />
              </DocumentsRealtimeProvider>
            }
          />
          <Route path="pending-signatures" element={<CustomerPendingSignaturesPage />} />
          <Route path="pending-signatures/:id" element={<CustomerSignaturePage />} />
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

          <Route path="cpq" element={<ModuleGate module="cpq"><CPQDashboard /></ModuleGate>} />
          <Route path="cpq/products" element={<ModuleGate module="cpq"><ProductsPage /></ModuleGate>} />
          <Route path="cpq/quotes" element={<ModuleGate module="cpq"><QuotesListPage /></ModuleGate>} />
          <Route path="cpq/quotes/new" element={<ModuleGate module="cpq"><QuoteBuilderPage /></ModuleGate>} />
          <Route path="cpq/quotes/:id" element={<ModuleGate module="cpq"><QuoteDetailPage /></ModuleGate>} />
          <Route path="cpq/quotes/:id/edit" element={<ModuleGate module="cpq"><QuoteBuilderPage /></ModuleGate>} />

          <Route path="clm" element={<ModuleGate module="clm"><CLMDashboard /></ModuleGate>} />
          <Route path="clm/contracts" element={<ModuleGate module="clm"><ContractsListPage /></ModuleGate>} />
          <Route path="clm/contracts/new" element={<ModuleGate module="clm"><ContractBuilderPage /></ModuleGate>} />
          <Route path="clm/contracts/:id" element={<ModuleGate module="clm"><ContractDetailPage /></ModuleGate>} />
          <Route path="clm/contracts/:id/edit" element={<ModuleGate module="clm"><ContractBuilderPage /></ModuleGate>} />
          <Route path="clm/templates" element={<ModuleGate module="clm"><TemplatesPage /></ModuleGate>} />
          <Route path="clm/scan" element={<ModuleGate module="clm"><ContractScanPage /></ModuleGate>} />
          <Route path="clm/esign/:id" element={<ModuleGate module="clm"><ESignaturePage /></ModuleGate>} />

          <Route path="crm" element={<ModuleGate module="crm"><CRMLayout /></ModuleGate>} />
          <Route path="crm/leads" element={<ModuleGate module="crm"><LeadsPage /></ModuleGate>} />
          <Route path="crm/pipeline" element={<ModuleGate module="crm"><PipelinePage /></ModuleGate>} />
          <Route path="crm/accounts" element={<ModuleGate module="crm"><AccountsPage /></ModuleGate>} />
          <Route path="crm/contacts" element={<ModuleGate module="crm"><ContactsPage /></ModuleGate>} />
          <Route path="crm/opportunities" element={<ModuleGate module="crm"><OpportunitiesPage /></ModuleGate>} />
          <Route path="crm/activities" element={<ModuleGate module="crm"><ActivitiesPage /></ModuleGate>} />

          <Route
            path="documents"
            element={
              <ModuleGate module="documents">
                <DocumentsRealtimeProvider>
                  <DocumentsDashboard />
                </DocumentsRealtimeProvider>
              </ModuleGate>
            }
          />
          <Route
            path="documents/create"
            element={
              <ModuleGate module="documents">
                <DocumentsRealtimeProvider>
                  <DocumentCreatePage />
                </DocumentsRealtimeProvider>
              </ModuleGate>
            }
          />
          <Route
            path="documents/templates"
            element={
              <ModuleGate module="documents">
                <DocumentsRealtimeProvider>
                  <DocumentTemplatesPage />
                </DocumentsRealtimeProvider>
              </ModuleGate>
            }
          />
          <Route
            path="documents/history"
            element={
              <ModuleGate module="documents">
                <DocumentsRealtimeProvider>
                  <DocumentHistoryPage />
                </DocumentsRealtimeProvider>
              </ModuleGate>
            }
          />
          <Route
            path="documents/pending"
            element={
              <ModuleGate module="documents">
                <DocumentsRealtimeProvider>
                  <PendingSignaturesPage />
                </DocumentsRealtimeProvider>
              </ModuleGate>
            }
          />
          <Route
            path="documents/:id/esign"
            element={
              <ModuleGate module="documents">
                <DocumentsRealtimeProvider>
                  <DocumentESignPage />
                </DocumentsRealtimeProvider>
              </ModuleGate>
            }
          />

          <Route path="erp" element={<ModuleGate module="erp"><ERPDashboard /></ModuleGate>} />
          <Route path="erp/inventory" element={<ModuleGate module="erp"><InventoryPage /></ModuleGate>} />
          <Route path="erp/procurement" element={<ModuleGate module="erp"><ProcurementPage /></ModuleGate>} />
          <Route path="erp/production" element={<ModuleGate module="erp"><ProductionPage /></ModuleGate>} />
          <Route path="erp/finance" element={<ModuleGate module="erp"><FinancePage /></ModuleGate>} />
          <Route path="users" element={<OrganizationUsersPage />} />
          <Route path="subscription" element={<OrganizationSubscriptionPage />} />
          <Route path="invitations" element={<OrganizationInvitationsPage />} />
          <Route path="alerts" element={<EmployeeAlertsRoute />} />
          <Route path="approvals" element={<OrganizationApprovalsPage />} />
          <Route path="settings" element={<EmployeeSettingsRoute />} />
        </Route>

        {/* Root organization slug convenience — W-06: guard against reserved segments */}
        <Route path="/:tenantSlug" element={<TenantSlugRedirect />} />

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
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
