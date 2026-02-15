# Sirius Infra Unified Platform

A comprehensive, enterprise-grade unified platform that integrates CRM, CLM (Contract Lifecycle Management), CPQ (Configure, Price, Quote), and ERP (Enterprise Resource Planning) modules into a single, cohesive application. Built with React, TypeScript, and cutting-edge technologies for seamless business operations.

## Overview

The Sirius Infra Unified Platform is a complete business management solution designed to streamline operations across customer relationships, contracts, sales, and resource planning. It provides integrated solutions across all major business functions within a unified dashboard architecture with role-based access control.

### Key Features

- **CRM Module**: Comprehensive customer relationship management with accounts, contacts, leads, opportunities, and activities tracking
- **CLM Module**: End-to-end contract lifecycle management with templates, building, scanning, and e-signature capabilities
- **CPQ Module**: Configure, price, and quote functionality for efficient sales operations and proposal generation
- **ERP Module**: Complete enterprise resource planning with:
  - **Inventory Management**: Track stock levels, monitor low-stock items, and manage warehouse locations
  - **Procurement Management**: Purchase order management, supplier relationships, and purchase tracking
  - **Production Management**: Production order tracking, scheduling, and completion monitoring
  - **Financial Management**: Revenue and expense tracking, financial reporting, and profit analysis
- **Admin Dashboard**: Centralized administrative controls and user management
- **Role-Based Access Control**: Secure authentication and authorization with role-based permissions (Admin, Employee, Customer)
- **Real-time Collaboration**: Supabase integration for real-time data synchronization across modules
- **Responsive UI**: Beautiful, modern interface built with shadcn/ui and Tailwind CSS with dark mode support

## Tech Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality React component library
- **React Query** - Server state management and data fetching
- **React Hook Form** - Efficient form management

### Backend & Data
- **Supabase** - PostgreSQL database, authentication, and real-time features
- **Supabase Client** - Type-safe database operations

### Developer Tools
- **ESLint** - Code quality and consistency
- **PostCSS** - CSS transformations
- **Bun** - Fast package manager and runtime

## Project Structure

```
src/
├── components/
│   ├── auth/                # Authentication components (SignIn, SignUp, RoleSelection, ProtectedRoute)
│   ├── crm/                 # CRM-specific components (Dashboard, DataTable, Pipeline, Stats)
│   ├── layout/              # Layout components (Header, Footer)
│   ├── sections/            # Landing page sections (Hero, Features, CTA, etc.)
│   ├── ui/                  # Reusable UI components (shadcn/ui library)
│   └── common/              # Common shared components
├── pages/
│   ├── auth/                # Authentication pages
│   ├── crm/                 # CRM module pages (Accounts, Contacts, Leads, Opportunities, Activities)
│   ├── clm/                 # CLM module pages (Contracts, Templates, e-Signature)
│   ├── cpq/                 # CPQ module pages (Products, Quotes, QuoteBuilder)
│   ├── erp/                 # ERP module pages
│   │   ├── ERPDashboard.tsx       # ERP main dashboard with analytics
│   │   ├── InventoryPage.tsx      # Inventory management (CRUD operations)
│   │   ├── ProcurementPage.tsx    # Purchase order management
│   │   ├── ProductionPage.tsx     # Production order tracking
│   │   └── FinancePage.tsx        # Financial records and reporting
│   ├── AdminDashboard.tsx   # Admin controls
│   ├── Dashboard.tsx        # Main employee dashboard
│   └── Index.tsx            # Landing page
├── hooks/
│   ├── useAuth.tsx          # Authentication logic and user state
│   ├── useCRM.ts            # CRM data management (Leads, Accounts, Opportunities, etc.)
│   ├── useERP.ts            # ERP data management (Inventory, Procurement, Production, Finance)
│   ├── useTheme.tsx         # Dark/Light theme management
│   ├── use-toast.ts         # Toast notifications
│   └── use-mobile.tsx       # Mobile device detection
├── integrations/
│   └── supabase/            # Supabase client configuration and types
│       ├── client.ts        # Supabase client initialization
│       └── types.ts         # Database type definitions
├── types/
│   ├── crm.ts               # CRM TypeScript type definitions
│   ├── erp.ts               # ERP TypeScript type definitions
│   └── roles.ts             # Role and permission definitions
├── lib/
│   └── utils.ts             # Utility functions
└── data/
    └── leadershipData.ts    # Static data

supabase/
├── config.toml              # Supabase configuration
└── migrations/              # Database migration files
```

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher)
- **Bun** package manager or npm/yarn
- Git

### Installation

1. **Clone the repository**:
   ```sh
   git clone <repository-url>
   cd siriusinfra-unified-platform
   ```

2. **Install dependencies**:
   ```sh
   bun install
   # or
   npm install
   ```

3. **Environment Configuration**:
   Create a `.env.local` file in the root directory with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**:
   ```sh
   bun run dev
   # or
   npm run dev
   ```

   The application will be available at `http://localhost:5173`

### Available Scripts

- `bun run dev` - Start development server with hot module replacement
- `bun run build` - Build for production
- `bun run build:dev` - Build in development mode
- `bun run lint` - Run ESLint to check code quality
- `bun run preview` - Preview production build locally

## Authentication & Authorization

The platform implements role-based access control with multiple user roles:

- **Admin**: Full platform access and administrative capabilities
- **Customer**: Customer-facing dashboard and limited CRM features
- **Employee**: Full CRM, CLM, and CPQ module access

Users authenticate via Supabase and roles are always resolved from `public.user_roles`.

Canonical auth rules:
- `user_roles` is the source of truth for both `role` and `approved`
- Every authenticated user must have a row in `user_roles`
- Missing role rows are auto-healed to `role='user', approved=true` via RPC
- Employee login is allowed only when `role='employee'` and `approved=true`
- `signup_requests` is kept as history/audit for approval workflow status

---

## Complete Project Workflow

### User Onboarding Flow

1. **Public Access** -> User visits landing page (`/`)
2. **Sign Up** -> User selects role (Customer/Employee) and creates account (`/auth`)
3. **Email Verification** -> User verifies email before first login
4. **Role and Approval Enforcement**:
   - **Customer Signup** -> `user_roles(role='user', approved=true)`
   - **Employee Signup** -> `user_roles(role='employee', approved=false)` and pending history row
   - **Admin Approves Employee** -> `user_roles.approved=true`
5. **Role-Based Routing**:
   - **Admin**: Redirected to `/admin` for administrative dashboard
   - **Employee**: Redirected to `/dashboard` for employee workspace
   - **Customer**: Redirected to `/`

### Module Workflows

#### CRM Module Workflow (`/dashboard/crm`)

1. **Lead Management** → Create leads from various sources
2. **Lead Scoring** → Qualify and score leads based on criteria
3. **Account Creation** → Convert qualified leads to accounts
4. **Contact Management** → Add contacts to accounts
5. **Opportunity Tracking** → Create and track sales opportunities
6. **Activity Logging** → Track all interactions (calls, emails, meetings)
7. **Pipeline Management** → Visualize sales pipeline by stage
8. **Reporting** → Generate insights on sales performance

**Key Features:**
- Real-time data synchronization via Supabase
- Drag-and-drop opportunity pipeline
- Activity timeline and history tracking
- Custom fields and tagging

#### CLM Module Workflow (`/dashboard/clm`)

1. **Template Creation** → Create contract templates
2. **Contract Building** → Use templates to create contract documents
3. **Document Scanning** → Upload and process contract documents
4. **Content Management** → Edit contract terms and conditions
5. **e-Signature Process** → Route contracts for digital signatures
6. **Tracking & Monitoring** → Track contract status and deadlines
7. **Execution Management** → Monitor contract lifecycle to completion

**Key Features:**
- Template library for quick contract creation
- OCR/Scanning capabilities for document processing
- Integrated e-signature workflow
- Deadline and alert management

#### CPQ Module Workflow (`/dashboard/cpq`)

1. **Product Catalog** → Manage products and pricing
2. **Shopping Cart** → Add products to quote configurations
3. **Customization** → Configure products per customer needs
4. **Pricing Rules** → Apply volume discounts and special pricing
5. **Quote Generation** → Auto-generate professional quotes
6. **Distribution** → Send quotes to customers
7. **Tracking** → Monitor quote status and conversion
8. **Acceptance** → Convert approved quotes to orders

**Key Features:**
- Product configurator with real-time pricing
- Dynamic pricing and discount rules
- Professional quote templates
- Quote versioning and history
- Conversion tracking and analytics

#### ERP Module Workflow (`/dashboard/erp`)

**1. Inventory Management** (`/dashboard/erp/inventory`)
- Product master data creation
- Stock level tracking and updates
- Low-stock alerts and reordering
- Warehouse location management
- Real-time inventory visibility
- Stock valuation and turnover analysis

**2. Procurement Management** (`/dashboard/erp/procurement`)
- Supplier management and performance tracking
- Purchase requisition creation
- Purchase order lifecycle (Draft → Confirmed → Received)
- Receipt management and matching
- Invoice processing
- Supplier payment terms tracking
- Procurement analytics and reporting

**3. Production Management** (`/dashboard/erp/production`)
- Production order creation and planning
- Manufacturing schedule management
- Production status tracking (Pending → In Progress → Completed)
- Resource allocation and capacity planning
- Quality control checkpoints
- Production cost tracking
- Yield and efficiency reporting

**4. Financial Management** (`/dashboard/erp/finance`)
- Revenue transaction recording
- Expense tracking and categorization
- Invoice and credit note management
- Payment method tracking
- Financial reporting and P&L statements
- Cash flow management
- Transaction history and audit trail

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Backend                        │
│                   (PostgreSQL + Auth)                        │
└────────────┬────────────────┬────────────────┬───────────────┘
             │                │                │
      ┌──────▼─────┐  ┌──────▼─────┐  ┌──────▼─────┐
      │  CRM Data  │  │  CLM Data  │  │  CPQ Data  │
      │  Tables    │  │  Tables    │  │  Tables    │
      └────────────┘  └────────────┘  └────────────┘
             │                │                │
      ┌──────▼──────────────────────────────────▼─────┐
      │         ERP Data Tables                       │
      │ (Inventory, Procurement, Production, Finance) │
      └──────┬─────────────────────────────────────────┘
             │
    ┌────────▼─────────────────────────────────┐
    │  React Application (Frontend)            │
    │  ┌─────────────────────────────────────┐ │
    │  │ useAuth → Authentication & Roles    │ │
    │  │ useCRM → CRM Operations             │ │
    │  │ useERP → ERP Operations             │ │
    │  │ React Query → Caching & Sync        │ │
    │  └─────────────────────────────────────┘ │
    └─────────────────────────────────────────┘
```

### API Integration Points

All modules communicate with Supabase through custom hooks:

```typescript
// CRM Operations
useLeads() → supabase.from('leads').select()
useAccounts() → supabase.from('accounts').select()
useOpportunities() → supabase.from('opportunities').select()

// ERP Operations
useInventoryItems() → supabase.from('inventory_items').select()
usePurchaseOrders() → supabase.from('purchase_orders').select()
useProductionOrders() → supabase.from('production_orders').select()
useFinancialRecords() → supabase.from('financial_records').select()
```

### Real-time Features

- Live data updates across all modules
- Instant notification for critical events (e.g., low stock alerts)
- Concurrent user session management
- Audit trail for all transactions

## Module Documentation

### CRM Module
Located in `src/pages/crm/` - Manage accounts, contacts, opportunities, and activities with a comprehensive dashboard and real-time updates.

**Features:**
- Lead capture and qualification
- Account and contact hierarchy
- Opportunity pipeline management
- Activity tracking and history
- Real-time collaboration

### CLM Module
Located in `src/pages/clm/` - Create, manage, scan, and execute contracts with template support and e-signature capabilities.

**Features:**
- Contract template library
- Document parsing and OCR
- Clause management and editing
- e-Signature integration
- Deadline and alert management
- Contract repository and search

### CPQ Module
Located in `src/pages/cpq/` - Configure products, build quotes, and manage the sales pipeline efficiently.

**Features:**
- Product catalog management
- Dynamic pricing rules
- Quote configuration and customization
- Proposal generation
- Quote tracking and analytics

### ERP Module
Located in `src/pages/erp/` - Complete enterprise resource planning with four integrated sub-modules:

#### Inventory Management (`InventoryPage.tsx`)
- **Features:**
  - SKU-based inventory tracking
  - Real-time stock level monitoring
  - Low-stock alerts with visual warnings
  - Min/Max level configuration
  - Unit price and valuation tracking
  - Warehouse location management
  - Inventory status categorization
  - Full CRUD operations with dialog forms

#### Procurement Management (`ProcurementPage.tsx`)
- **Features:**
  - Purchase order creation and tracking
  - Supplier management and relationship tracking
  - PO status workflow (Draft → Pending → Confirmed → Received)
  - Delivery date tracking
  - Total procurement value analytics
  - Pending order monitoring
  - Supplier performance tracking
  - Full CRUD operations for orders

#### Production Management (`ProductionPage.tsx`)
- **Features:**
  - Production order creation with product configuration
  - Priority-based scheduling (Low, Medium, High, Urgent)
  - Status tracking (Pending → In Progress → Completed)
  - Completion percentage tracking
  - Resource allocation (Assigned To)
  - Estimated vs. actual completion dates
  - Production analytics and KPIs
  - Full CRUD operations with timeline view

#### Financial Management (`FinancePage.tsx`)
- **Features:**
  - Multi-type transaction support (Revenue, Expense, Payment, Invoice, Credit Note)
  - Real-time financial summaries
  - Revenue tracking and analysis
  - Expense categorization and monitoring
  - Net profit calculation and margin analysis
  - Payment method tracking
  - Financial record status management
  - Full CRUD operations with transaction history

#### ERP Dashboard (`ERPDashboard.tsx`)
- **Features:**
  - Cross-module analytics with real-time stats
  - Key performance indicators (KPIs)
  - Low-stock alerts and warnings
  - Revenue vs. Expenses visualization
  - Production status charts
  - Module navigation with quick stats
  - Error handling and loading states
  - Responsive dashboard layout

## Database Schema

The project uses Supabase PostgreSQL with migrations located in `supabase/migrations/`. 

### Core Tables

**CRM Tables:**
- `leads` - Lead information and status
- `accounts` - Company accounts
- `contacts` - Individual contacts
- `opportunities` - Sales opportunities
- `activities` - Interaction history

**CLM Tables:**
- `contracts` - Contract documents
- `contract_templates` - Reusable contract templates

**CPQ Tables:**
- `products` - Product catalog
- `quotes` - Customer quotes
- `quote_items` - Line items in quotes

**ERP Tables:**
- `inventory_items` - Product inventory with stock levels
- `purchase_orders` - PO records with status tracking
- `purchase_order_items` - Line items in POs
- `production_orders` - Manufacturing orders
- `financial_records` - Revenue, expense, and transaction records
- `suppliers` - Supplier master data

**Authentication:**
- `user_roles` - Canonical role and approval state (`role`, `approved`)
- `signup_requests` - Employee approval history (`pending`, `approved`, `rejected`)
- `profiles` - User profile data from signup metadata

## Development

### Adding New Features

1. **Define Types** - Create types in `src/types/`
2. **Create Hooks** - Implement data hooks in `src/hooks/`
3. **Build Components** - Create UI components in `src/components/`
4. **Create Pages** - Build page components in `src/pages/`
5. **Add Routes** - Register routes in `src/App.tsx`
6. **Create Migrations** - Add database migrations in `supabase/migrations/`

### Code Quality

This project uses ESLint for code quality and consistency:

```sh
bun run lint
```

###Git Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes and commit: `git commit -m 'Add your feature'`
3. Push to the branch: `git push origin feature/your-feature`
4. Create a pull request for review

## Deployment

### Build for Production

```sh
bun run build
```

This creates an optimized build in the `dist/` directory. The application is ready for deployment to:
- Vercel (recommended)
- Netlify
- Traditional web servers
- Docker containers

### Environment Variables for Production

```
VITE_SUPABASE_URL=your_production_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_production_anon_key
```

## Performance Optimization

- **React Query Caching** - Automatic caching and background synchronization
- **Code Splitting** - Lazy-loaded pages and components
- **Image Optimization** - Responsive images with proper sizing
- **Database Indexing** - Optimized Supabase indexes
- **Real-time Sync** - Efficient real-time data updates

## Security Features

- **Authentication** - Secure Supabase authentication
- **Row Level Security** - Database-level access control
- **Role-Based Access** - Endpoint-level authorization
- **Input Validation** - Client and server-side validation
- **Secure Storage** - LocalStorage encryption for sensitive data

## Troubleshooting

### Common Issues

**Issue: Supabase connection error**
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`
- Check Supabase project status in dashboard
- Ensure network connectivity

**Issue: Data not syncing**
- Check browser console for errors
- Verify database connection is active
- Clear browser cache and reload
- Check Supabase RLS policies

**Issue: Authentication failing**
- Verify user exists in Supabase Auth
- Check role assignment and approval in `public.user_roles`
- Clear authentication cookies and retry
- Check network requests in browser DevTools

## Support & Contributing

For issues, feature requests, or contributions:
1. Check existing GitHub issues
2. Create detailed bug reports with steps to reproduce
3. Submit feature requests with use cases
4. Follow code style guidelines

## Technology Stack Summary

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Frontend Framework** | React 18 | UI library |
| **Language** | TypeScript | Type safety |
| **Build Tool** | Vite | Fast bundling |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Components** | shadcn/ui | Pre-built components |
| **State Management** | React Query | Server state |
| **Forms** | React Hook Form | Form handling |
| **Backend** | Supabase | Database & Auth |
| **Database** | PostgreSQL | Data storage |
| **Real-time** | Supabase Realtime | Live updates |
| **Package Manager** | Bun | Fast package management |
| **Linting** | ESLint | Code quality |
| **Charts** | Recharts | Data visualization |

## Architecture Highlights

- **Modular Design** - Independent modules (CRM, CLM, CPQ, ERP)
- **Scalability** - Built for growth with microservice-ready structure
- **Extensibility** - Easy to add new modules and features
- **Maintainability** - Clean code with proper separation of concerns
- **Performance** - Optimized rendering and data fetching
- **Accessibility** - WCAG compliant UI components
- **Responsiveness** - Mobile-first design approach

## Roadmap

Future enhancements:
- [ ] REST API for partners
- [ ] Mobile app (React Native)
- [ ] Advanced analytics and BI integration
- [ ] AI-powered recommendations
- [ ] Multi-tenant support
- [ ] Advanced reporting engine
- [ ] Workflow automation
- [ ] Third-party integrations (Stripe, HubSpot, etc.)
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

