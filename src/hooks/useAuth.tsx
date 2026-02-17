import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session, AuthError, PostgrestSingleResponse, PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AppRole } from "@/types/roles";
import { Database } from "@/integrations/supabase/types"; // Import your Database type

/* ---------------- TYPES ---------------- */

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isApproved: boolean | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    signupType: "employee" | "customer"
  ) => Promise<{ error: Error | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{
    data: { role: AppRole; isApproved: boolean } | null;
    error: Error | null;
  }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ---------------- HELPERS ---------------- */

const mapRole = (role: string | null): AppRole | null => {
  console.log("🗺️ Mapping role:", role);
  if (!role) return null;
  const validRoles = ["user", "employee", "admin"] as const;
  if (validRoles.includes(role as AppRole)) {
    return role as AppRole;
  }
  console.warn("⚠️ Invalid role mapped to null:", role);
  return null;
};

// Timeout utility
const timeout = (ms: number, label: string) => new Promise((_, reject) => {
  setTimeout(() => {
    console.warn(`⏰ Timeout after ${ms}ms for: ${label}`);
    reject(new Error(`Timeout after ${ms}ms for ${label}`));
  }, ms);
});

// Cache keys
const ROLE_CACHE_KEY = 'auth_role_cache';

/* ---------------- PROVIDER ---------------- */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  
  /* ---------------- FETCH ROLE ---------------- */
  
  const fetchRoleAndApproval = async (userId: string) => {
    console.log("🔎 Starting fetchRoleAndApproval for user:", userId);
    
    // Check cache first
    const cached = localStorage.getItem(ROLE_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.userId === userId && parsed.role) {
          const mapped = mapRole(parsed.role);
          if (mapped) {
            console.log("💾 Using cached role:", mapped, "Approved:", parsed.approved);
            setRole(mapped);
            setIsApproved(parsed.approved);
            return;
          }
        }
      } catch (e) {
        console.warn("⚠️ Invalid role cache:", e);
      }
    }
    
    try {
      const rolePromise = supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .single();
      
      const { data, error } = await Promise.race<PostgrestSingleResponse<Database['public']['Tables']['user_roles']['Row']>>([
        rolePromise,
        timeout(10000, `fetchRoleAndApproval for ${userId}`)
      ]);
      
      console.log("🧾 ROLE DATA received:", data);
      console.log("❌ ROLE ERROR:", error);
      
      if (error || !data) {
        console.warn("⚠️ Using default USER role due to error or no data");
        setRole(AppRole.USER);
        setIsApproved(true);
        // Cache default
        localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ userId, role: AppRole.USER, approved: true }));
        return;
      }
      
      const mapped = mapRole(data.role);
      const finalRole = mapped ?? AppRole.USER;
      const finalApproved = mapped === AppRole.EMPLOYEE ? data.approved : true;
      
      setRole(finalRole);
      setIsApproved(finalApproved);
      
      // Cache the role
      localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ userId, role: data.role, approved: data.approved }));
      
      console.log("✅ Role set:", finalRole, "Approved:", finalApproved);
    } catch (err) {
      console.error("❌ Error in fetchRoleAndApproval:", err);
      // Set defaults on error/timeout
      setRole(AppRole.USER);
      setIsApproved(true);
      localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ userId, role: AppRole.USER, approved: true }));
    } finally {
      console.log("🏁 fetchRoleAndApproval completed for user:", userId);
    }
  };
  
  
  /* ---------------- INIT AUTH ---------------- */
  
  useEffect(() => {
    console.log("🚀 Starting auth initialization...");
    
    let mounted = true;
    
    const init = async () => {
      console.log("⏳ Setting loading to true at init start");
      setLoading(true);
      
      try {
        const getSessionPromise = supabase.auth.getSession();
        
        const { data: { session } } = await Promise.race<{ data: { session: Session | null }; error: AuthError | null }>([
          getSessionPromise,
          timeout(10000, 'getSession in init')
        ]);
        
        console.log("📦 Session received in init:", session);
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user && !role) {
          console.log("🔄 Fetching role after session restore (no role set yet)");
          await fetchRoleAndApproval(session.user.id);
        }
      } catch (err) {
        console.error("❌ Error in init auth:", err);
        // Set defaults on failure
        setSession(null);
        setUser(null);
        setRole(null);
        setIsApproved(null);
      } finally {
        if (mounted) {
          console.log("⏳ Setting loading to false at init end");
          setLoading(false);
          console.log("✅ Auth initialization completed");
        }
      }
    };
    
    init();
    
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("⚡ Auth state change event:", event, "Session:", session);
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === "SIGNED_OUT") {
          console.log("🚪 Signed out - resetting states");
          setRole(null);
          setIsApproved(null);
          localStorage.removeItem(ROLE_CACHE_KEY); // Clear cache on sign out
          console.log("⏳ Setting loading to false after sign out");
          setLoading(false);
          return;
        }
        
        if (session?.user && !role) {
          console.log("⏳ Setting loading to true for role fetch after state change (no role set yet)");
          setLoading(true);
          await fetchRoleAndApproval(session.user.id);
          console.log("⏳ Setting loading to false after role fetch");
          setLoading(false);
        }
      }
    );
    
    return () => {
      console.log("🛑 Cleaning up auth effect");
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  
  
  /* ---------------- ACTIONS ---------------- */
  
  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    signupType: "employee" | "customer"
  ) => {
    console.log("📝 Starting signUp for:", email, "Type:", signupType);
    
    try {
      const signUpPromise = supabase.auth.signUp({
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
      
      const { error } = await Promise.race<{ data: { user: User | null; session: Session | null }; error: AuthError | null }>([
        signUpPromise,
        timeout(15000, `signUp for ${email}`)
      ]);
      
      if (error) {
        console.error("❌ signUp failed:", error.message);
      } else {
        console.log("✅ signUp success");
      }
      
      return { error: error as Error | null };
    } catch (err) {
      console.error("❌ Timeout or error in signUp:", err);
      return { error: err as Error };
    } finally {
      console.log("🏁 signUp completed for:", email);
    }
  };
  
  const signIn = async (email: string, password: string) => {
    console.log("🔐 Starting signIn for:", email);
    
    try {
      const signInPromise = supabase.auth.signInWithPassword({ email, password });
      
      const { data, error } = await Promise.race<{ data: { user: User | null; session: Session | null }; error: AuthError | null }>([
        signInPromise,
        timeout(15000, `signIn for ${email}`)
      ]);
      
      if (error || !data.user) {
        console.error("❌ signIn auth error:", error);
        return { data: null, error: error as Error };
      }
      
      console.log("✅ signIn auth success, user:", data.user.id);
      console.log("🔄 Fetching role after signIn");
      
      const { data: roleData, error: roleError } = await Promise.race<PostgrestSingleResponse<Pick<Database['public']['Tables']['user_roles']['Row'], 'role' | 'approved'>>>([
        supabase
          .from("user_roles")
          .select("role, approved")
          .eq("user_id", data.user.id)
          .maybeSingle(),
        timeout(10000, `role fetch after signIn for ${data.user.id}`)
      ]);
      
      console.log("📦 Role data received after signIn:", roleData);
      console.log("❌ Role error:", roleError);
      
      const mappedRole = mapRole(roleData?.role ?? null);
      const finalRole = mappedRole ?? AppRole.USER;
      
      if (finalRole === AppRole.EMPLOYEE && !roleData?.approved) {
        console.warn("⛔ Employee not approved - signing out");
        
        await supabase.auth.signOut();
        localStorage.removeItem(ROLE_CACHE_KEY);
        
        return {
          data: null,
          error: new Error(
            "Your account is pending admin approval. Please wait."
          ),
        };
      }
      
      setRole(finalRole);
      setIsApproved(roleData?.approved ?? true);
      
      // Cache after successful signIn
      localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ userId: data.user.id, role: roleData?.role ?? AppRole.USER, approved: roleData?.approved ?? true }));
      
      console.log("🎉 signIn completed. Role:", finalRole, "Approved:", roleData?.approved ?? true);
      
      return {
        data: { role: finalRole, isApproved: roleData?.approved ?? true },
        error: null,
      };
    } catch (err) {
      console.error("❌ Timeout or error in signIn:", err);
      return { data: null, error: err as Error };
    } finally {
      console.log("🏁 signIn completed for:", email);
    }
  };
  
  const signOut = async () => {
    console.log("🚪 Starting signOut...");
    try {
      await supabase.auth.signOut();
      console.log("✅ signOut success");
    } catch (err) {
      console.error("❌ signOut error:", err);
    } finally {
      setUser(null);
      setSession(null);
      setRole(null);
      setIsApproved(null);
      localStorage.removeItem(ROLE_CACHE_KEY); // Clear cache
      console.log("🏁 signOut completed - states reset");
    }
  };
  
  /* ---------------- PROVIDER ---------------- */
  
  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isApproved,
        loading,
        signUp,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ---------------- HOOK ---------------- */

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};