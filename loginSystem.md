# Login System Flow Documentation

## Overview
This document shows the complete flow of the login system from signup to backend connection, including which files are called and which functions are invoked.

---

## User Roles
The system has three user roles:
- **ADMIN** - Full access to admin panel
- **EMPLOYEE** - Access to employee dashboard (requires approval)
- **USER** (Customer) - Standard customer access

---

## Complete Flow Diagram

### 1. CUSTOMER SIGNUP FLOW
```
User → Auth.tsx → CustomerSignupForm.tsx → useAuth.tsx (signUp) → Supabase Auth → Database Trigger (handle_new_user) → user_roles table
```

### 2. EMPLOYEE SIGNUP FLOW
```
User → Auth.tsx → EmployeeSignupForm.tsx → useAuth.tsx (signUp) → Supabase Auth → Database Trigger (handle_new_user) → user_roles table + signup_requests table
```

### 3. LOGIN FLOW
```
User → Auth.tsx → SignInForm.tsx → useAuth.tsx (signIn) → Supabase Auth → user_roles table → Role-based Redirect
```

---

## Detailed File Call Flow

### STEP 1: Auth Page (Entry Point)
**File:** `src/pages/Auth.tsx`

**Function:** `Auth()` (main component)

**What it does:**
- Manages authentication flow state (role-selection, signup, signin, success)
- Renders different forms based on current step
- Redirects already logged-in users based on their role

**Key State:**
- `step` - Current auth flow step
- `selectedRole` - Selected role (employee/customer)
- `successType` - Type of successful signup

**Calls:**
- `RoleSelection` component (for role selection)
- `CustomerSignupForm` component (for customer signup)
- `EmployeeSignupForm` component (for employee signup)
- `SignInForm` component (for login)

---

### STEP 2a: Customer Signup
**File:** `src/components/auth/CustomerSignupForm.tsx`

**Function:** `CustomerSignupForm({ onBack, onSuccess })`

**What it does:**
- Displays customer registration form
- Validates input (name, email, password with complex requirements)
- Calls `signUp` from useAuth with `signupType='customer'`

**Form Fields:**
- Full Name
- Email
- Password (min 12 chars, uppercase, lowercase, number, special char)
- Confirm Password

**Validation:**
```
javascript
const customerSignupSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
```

**Calls:**
```
javascript
const { signUp } = useAuth();
await signUp(email, password, firstName, lastName, "customer");
```

---

### STEP 2b: Employee Signup
**File:** `src/components/auth/EmployeeSignupForm.tsx`

**Function:** `EmployeeSignupForm({ onBack, onSuccess })`

**What it does:**
- Displays employee registration form
- Validates input (name, work email, password)
- Calls `signUp` from useAuth with `signupType='employee'`
- Employee accounts require admin approval before access

**Form Fields:**
- Full Name
- Work Email
- Employee ID (optional)
- Password
- Confirm Password

**Key Difference from Customer:**
- Uses work email
- Account goes to "pending" status
- Requires admin approval

**Calls:**
```
javascript
const { signUp } = useAuth();
await signUp(email, password, firstName, lastName, "employee");
```

---

### STEP 3: Authentication Hook (Core Logic)
**File:** `src/hooks/useAuth.tsx`

**Components:**
- `AuthProvider` - Provides auth context to entire app
- `useAuth` - Custom hook to access auth context

**Function:** `signUp()` - Inside `AuthProvider` component

**What it does:**
1. Receives email, password, firstName, lastName, signupType
2. Calls Supabase's `auth.signUp()` with metadata
3. Supabase automatically triggers the database function `handle_new_user()`

**Code:**
```
javascript
const signUp = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  signupType: "employee" | "customer"
) => {
  console.log("📝 Signing up user:", email);
  
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        signup_type: signupType,
      },
    },
  });
  
  if (error) {
    console.error("❌ Signup failed:", error.message);
  } else {
    console.log("✅ Signup success");
  }
  
  return { error: error as Error | null };
};
```

**Function:** `signIn()` - Inside `AuthProvider` component

**What it does:**
1. Receives email and password
2. Calls Supabase's `auth.signInWithPassword()`
3. Queries `user_roles` table to get user's role and approval status
4. Returns role and approval status for redirect logic

**Code:**
```
javascript
const signIn = async (email: string, password: string) => {
  console.log("🔐 Signing in:", email);
  
  // Step 1: Authenticate with Supabase
  const { data, error } = await supabase.auth.signInWithPassword({ 
    email, 
    password 
  });
  
  if (error || !data.user) {
    console.error("❌ Sign in error:", error);
    return { data: null, error: error as Error };
  }
  
  console.log("✅ Auth success, fetching role...");
  
  // Step 2: Fetch role from database
  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role, approved")
    .eq("user_id", data.user.id)
    .maybeSingle();
  
  const mappedRole = mapRole(roleData?.role ?? null);
  const finalRole = mappedRole ?? AppRole.USER;
  
  // Step 3: Check approval for employees
  if (finalRole === AppRole.EMPLOYEE && !roleData?.approved) {
    console.warn("⛔ Employee not approved yet");
    
    await supabase.auth.signOut();
    
    return { 
      data: null, 
      error: new Error("Your account is pending admin approval. Please wait.") 
    };
  }
  
  setRole(finalRole);
  setIsApproved(roleData?.approved ?? false);
  
  console.log("🎉 Sign in completed. Role:", finalRole);
  
  return {
    data: { role: finalRole, isApproved: roleData?.approved ?? false },
    error: null,
  };
};
```

**Function:** `signOut()` - Inside `AuthProvider` component

**Code:**
```
javascript
const signOut = async () => {
  console.log("🚪 Signing out...");
  await supabase.auth.signOut();
  
  setUser(null);
  setSession(null);
  setRole(null);
  setIsApproved(null);
};
```

**Initialization:** `useEffect` in AuthProvider
- Gets current session on app load
- Sets up auth state change listener
- Fetches user role on auth changes

---

### STEP 4: Backend Database (Supabase)
**File:** `supabase/migrations/20260217000000_fix_user_roles.sql`

**Function:** `handle_new_user()` - PostgreSQL Trigger Function

**What it does:**
This trigger runs automatically AFTER a new user is inserted into `auth.users` table.

**Logic:**
```
sql
-- For EMPLOYEE signup:
1. Creates signup_request record (status = 'pending')
2. Creates user_roles record with role='employee' and approved=false

-- For first user (becomes ADMIN):
1. Creates user_roles record with role='admin' and approved=true

-- For CUSTOMER signup:
1. Creates user_roles record with role='user' and approved=true
2. Removes any pending signup_request
```

**Tables Involved:**
- `auth.users` - Supabase's built-in auth table
- `public.user_roles` - Custom table storing user roles
- `public.signup_requests` - Stores pending employee requests

---

### STEP 5: Sign In Form
**File:** `src/components/auth/SignInForm.tsx`

**Function:** `SignInForm()` 

**What it does:**
1. Displays login form (email, password)
2. Validates input using Zod schema
3. Calls `signIn` from useAuth
4. Handles role-based redirect after successful login

**Validation Schema:**
```javascript
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
```

**Redirect Logic:**
```
javascript
if (data?.role === AppRole.ADMIN) {
  navigate("/admin");
} else if (data?.role === AppRole.EMPLOYEE) {
  navigate("/dashboard");
} else {
  // For USER (customer), redirect to home page
  navigate("/");
}
```

**Error Handling:**
- Invalid credentials → "Invalid email or password"
- Pending approval → "Your account has not been approved by an admin yet"

---

### STEP 6: Protected Routes
**File:** `src/components/auth/ProtectedRoute.tsx`

**Function:** `ProtectedRoute({ children, allowedRoles, redirectTo })`

**What it does:**
1. Checks if user is logged in
2. Checks if user's role is in allowedRoles
3. Shows loading spinner while auth is initializing
4. Redirects to login or unauthorized page based on conditions

**Logic Flow:**
```
javascript
if (loading) {
  // Show loading spinner
}

if (!user) {
  // Not logged in → redirect to login
  return <Navigate to={redirectTo} state={{ from: location }} replace />;
}

if (allowedRoles && !role) {
  // Role not loaded yet → show loading
}

if (allowedRoles && role && !allowedRoles.includes(role)) {
  // Role doesn't match → redirect to appropriate page
  if (role === AppRole.ADMIN) {
    return <Navigate to="/admin" replace />;
  }
  return <Navigate to="/unauthorized" replace />;
}

return <>{children}</>;
```

**Route Guards (Pre-configured Protected Routes):**
- `EmployeeRoute` - For EMPLOYEE role only → wraps `/dashboard`
- `UserRoute` - For USER role only
- `AdminRoute` - For ADMIN role only → wraps `/admin`

---

### STEP 7: App Routing
**File:** `src/App.tsx`

**Function:** `App()` (main component)

**What it does:**
1. Wraps app with `AuthProvider` (provides auth context)
2. Defines routes with protected route components
3. Role-based routing structure

**Route Structure:**
```
javascript
<AuthProvider>
  <Routes>
    {/* Public Routes */}
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<Auth />} />
    
    {/* Protected Routes */}
    <Route 
      path="/admin" 
      element={
        <AdminRoute>
          <AdminDashboard />
        </AdminRoute>
      } 
    />
    
    <Route 
      path="/dashboard" 
      element={
        <EmployeeRoute>
          <DashboardLayout />
        </EmployeeRoute>
      } 
    />
  </Routes>
</AuthProvider>
```

---

### STEP 8: Header (Navigation)
**File:** `src/components/layout/Header.tsx`

**Function:** `Header()` 

**What it does:**
1. Shows different navigation based on user role
2. Displays sign in/sign up buttons for unauthenticated users
3. Shows user menu with sign out option for authenticated users
4. Dashboard link based on role

**Key Logic:**
```
javascript
const { user, role, signOut, loading } = useAuth();

const isAdmin = role === AppRole.ADMIN;
const isEmployee = role === AppRole.EMPLOYEE;
const isUser = role === AppRole.USER;
const dashboardHref = isAdmin ? "/admin" : isEmployee ? "/dashboard" : "/";
```

**Sign Out Handler:**
```
javascript
const handleSignOut = async () => {
  await signOut();
  navigate("/");
};
```

**UI Elements:**
- Shows "Sign In" and "Get Started" buttons for unauthenticated users
- Shows Dashboard link and user dropdown for authenticated users
- Role badge displayed in user menu

---

## Database Schema

### user_roles table
```
sql
- id: uuid (primary key)
- user_id: uuid (references auth.users)
- role: text ('admin', 'employee', 'user')
- approved: boolean (default false)
- created_at: timestamptz
- updated_at: timestamptz
```

### signup_requests table
```
sql
- id: uuid (primary key)
- user_id: uuid (references auth.users)
- email: text
- first_name: text
- last_name: text
- status: text ('pending', 'approved', 'rejected')
- created_at: timestamptz
- updated_at: timestamptz
```

---

## Summary of Function Calls

| Action | File | Function Called | Next File/Function |
|--------|------|-----------------|-------------------|
| Open Auth Page | - | - | Auth.tsx |
| Select Role | Auth.tsx | renderStep() | RoleSelection |
| Customer Signup | Auth.tsx | setStep("customer-signup") | CustomerSignupForm |
| Employee Signup | Auth.tsx | setStep("employee-signup") | EmployeeSignupForm |
| Submit Customer Form | CustomerSignupForm.tsx | handleSubmit() | useAuth.signUp() |
| Submit Employee Form | EmployeeSignupForm.tsx | handleSubmit() | useAuth.signUp() |
| Register User | useAuth.tsx | signUp() | Supabase Auth |
| Auto-trigger | Database | handle_new_user() | user_roles table |
| Sign In | Auth.tsx | setStep("signin") | SignInForm |
| Submit Login | SignInForm.tsx | handleSubmit() | useAuth.signIn() |
| Authenticate | useAuth.tsx | signIn() | Supabase Auth + user_roles |
| Redirect | SignInForm.tsx | navigate() | /admin, /dashboard, or / |
| Access Protected Route | App.tsx | ProtectedRoute | Check user + role |
| Check Permission | ProtectedRoute.tsx | ProtectedRoute() | Allow or Redirect |
| Sign Out | Header.tsx | handleSignOut() | useAuth.signOut() |

---

## Key Features

1. **Role-based Access Control**: Different routes accessible based on user role
2. **Employee Approval Workflow**: Employees require admin approval before accessing dashboard
3. **Instant Customer Access**: Customers get immediate access after signup
4. **First User Admin**: First user to signup becomes admin automatically
5. **Session Management**: Automatic session handling and role fetching on auth state changes
6. **Protected Routes**: Route guards prevent unauthorized access

---

This completes the comprehensive login system documentation. The system uses Supabase for authentication with custom PostgreSQL triggers to manage user roles and approval workflows.
