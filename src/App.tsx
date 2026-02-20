import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";

// Auth & Layout Routes
import { EmployeeRoute, AdminRoute } from "@/components/auth/ProtectedRoute";
import { DashboardLayout } from "@/components/crm/DashboardLayout";

// Public Pages
import Index from "./pages/Index";
import Products from "./pages/Products";
import Solutions from "./pages/Solutions";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Auth from "./pages/Auth";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import PendingApproval from "./pages/PendingApproval"

// Dashboard Base & Admin
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";

// Documents
import DocumentsDashboard from "./pages/documents/DocumentsDashboard";
import DocumentTemplatesPage from "./pages/documents/DocumentTemplatesPage";
import DocumentHistoryPage from "./pages/documents/DocumentHistoryPage";
import DocumentCreatePage from "./pages/documents/DocumentCreatePage";
import PendingSignaturesPage from "./pages/documents/PendingSignaturesPage";
import DocumentESignPage from "./pages/documents/DocumentESignPage";

// CLM
import CLMDashboard from "./pages/clm/CLMDashboard";
import ContractsPage from "./pages/clm/ContractsPage";
import TemplatesPage from "./pages/clm/TemplatesPage";

// CRM
import CRMLayout from "./pages/crm/CRMLayout";
import LeadsPage from "./pages/crm/LeadsPage";
import OpportunitiesPage from "./pages/crm/OpportunitiesPage";
import PipelinePage from "./pages/crm/PipelinePage";
import AccountsPage from "./pages/crm/AccountsPage";
import ContactsPage from "./pages/crm/ContactsPage";
import ActivitiesPage from "./pages/crm/ActivitiesPage";

// CPQ
import CPQDashboard from "./pages/cpq/CPQDashboard";
import ProductsPage from "./pages/cpq/ProductsPage";
import QuoteDetailPage from "./pages/cpq/QuoteDetailPage";
import QuotesListPage from "./pages/cpq/QuotesListPage";
import QuoteBuilderPage from "./pages/cpq/QuoteBuilderPage";

// ERP
import ERPDashboard from "./pages/erp/ERPDashboard";
import InventoryPage from "./pages/erp/InventoryPage";
import ProcurementPage from "./pages/erp/ProcurementPage";
import ProductionPage from "./pages/erp/ProductionPage";
import FinancePage from "./pages/erp/FinancePage";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <BrowserRouter>
          <ScrollToTop />

          <AuthProvider>
            <Routes>
              {/* ---------------- PUBLIC ROUTES ---------------- */}
              <Route path="/" element={<Index />} />
              <Route path="/products" element={<Products />} />
              <Route path="/solutions" element={<Solutions />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/pending-approval" element={<PendingApproval />} />

              {/* ---------------- ADMIN ---------------- */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                }
              />

              {/* ---------------- DASHBOARD SYSTEM ---------------- */}
              <Route
                path="/dashboard"
                element={
                  <EmployeeRoute>
                    <DashboardLayout />
                  </EmployeeRoute>
                }
              >
                {/* Default dashboard page */}
                <Route index element={<Dashboard />} />
                <Route path="analytics" element={<Dashboard />} />

                {/* CPQ */}
                <Route path="cpq" element={<CPQDashboard />} />
                <Route path="cpq/products" element={<ProductsPage />} />
                <Route path="cpq/quotes" element={<QuotesListPage />} />
                <Route path="cpq/quotes/new" element={<QuoteBuilderPage />} />
                <Route path="cpq/quotes/:id" element={<QuoteDetailPage />} />
                <Route path="cpq/quotes/:id/edit" element={<QuoteBuilderPage />} />

                {/* CLM */}
                <Route path="clm" element={<CLMDashboard />} />
                <Route path="clm/contracts" element={<ContractsPage />} />
                <Route path="clm/templates" element={<TemplatesPage />} />

                {/* CRM */}
                <Route path="crm" element={<CRMLayout />} />
                <Route path="crm/leads" element={<LeadsPage />} />
                <Route path="crm/pipeline" element={<PipelinePage />} />
                <Route path="crm/accounts" element={<AccountsPage />} />
                <Route path="crm/contacts" element={<ContactsPage />} />
                <Route path="crm/opportunities" element={<OpportunitiesPage />} />
                <Route path="crm/activities" element={<ActivitiesPage />} />

                {/* Documents */}
                <Route path="documents" element={<DocumentsDashboard />} />
                <Route path="documents/create" element={<DocumentCreatePage />} />
                <Route path="documents/templates" element={<DocumentTemplatesPage />} />
                <Route path="documents/history" element={<DocumentHistoryPage />} />
                <Route path="documents/pending" element={<PendingSignaturesPage />} />
                <Route path="documents/:id/esign" element={<DocumentESignPage />} />

                {/* ERP */}
                <Route path="erp" element={<ERPDashboard />} />
                <Route path="erp/inventory" element={<InventoryPage />} />
                <Route path="erp/procurement" element={<ProcurementPage />} />
                <Route path="erp/production" element={<ProductionPage />} />
                <Route path="erp/finance" element={<FinancePage />} />
              </Route>

              {/* ---------------- 404 ---------------- */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
