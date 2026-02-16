import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AppRole } from "@/types/roles";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  isApproved: boolean | null; // For employees - null for non-employees
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
    error: Error | null 
  }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ---------- ROLE MAPPER ---------- */
const mapRole = (role: string | null): AppRole | null => {
  if (!role) return null;
  return role as AppRole;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const authInitialized = useRef(false);

  /* -------------------- FETCH ROLE AND APPROVAL STATUS -------------------- */
  const fetchRoleAndApproval = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, approved")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching role:", error);
        setRole(null);
        setIsApproved(null);
        return;
      }

      if (data) {
        setRole(mapRole(data.role));
        // For employees, approved can be true/false/null. For others, default to true
        if (data.role === AppRole.EMPLOYEE) {
          setIsApproved(data.approved ?? false);
        } else {
          setIsApproved(true); // Users and admins are always approved
        }
      } else {
        setRole(null);
        setIsApproved(null);
      }
    } catch (err) {
      console.error("Exception fetching role:", err);
      setRole(null);
      setIsApproved(null);
    }
  };

  /* -------------------- INIT AUTH (ONCE) -------------------- */
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        // load role after auth FIRST, then set loading to false
        if (session?.user) {
          await fetchRoleAndApproval(session.user.id);
        }

        // mark auth initialized and set loading to false AFTER role is fetched
        if (isMounted) {
          authInitialized.current = true;
          setLoading(false);
        }
      } catch (error) {
        console.error("Auth init error:", error);
        if (isMounted) {
          authInitialized.current = true;
          setLoading(false);
        }
      }
    };

    // Timeout to ensure loading becomes false even if getSession hangs
    const timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        authInitialized.current = true;
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        // Only update session/user, don't reset role unnecessarily
        setSession(session);
        setUser(session?.user ?? null);

        // Only reset and re-fetch role for significant auth events
        // Ignore token refresh events (SIGNED_IN with same user)
        if (_event === "SIGNED_OUT") {
          setRole(null);
          setIsApproved(null);
        } else if (session?.user) {
          // For SIGNED_IN or TOKEN_REFRESHED events, fetch role if user changed
          await fetchRoleAndApproval(session.user.id);
        }

        if (!authInitialized.current) {
          authInitialized.current = true;
          setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  /* -------------------- ACTIONS -------------------- */

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    signupType: "employee" | "customer"
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          first_name: firstName, 
          last_name: lastName,
          signup_type: signupType, // Pass this to trigger in Supabase
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } =
      await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      return { data: null, error: error as Error };
    }

    // Fetch role and approval status
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role, approved")
      .eq("user_id", data.user.id)
      .maybeSingle();

    console.log("RAW ROLE FROM DB:", roleData?.role, "Approved:", roleData?.approved);

    const mappedRole = mapRole(roleData?.role ?? null);
    
    // If no role exists at all (shouldn't happen with proper trigger, but handle it)
    if (!mappedRole) {
      await supabase.auth.signOut();
      return {
        data: null,
        error: new Error("Account not found. Please contact support."),
      };
    }

    // Check if employee is approved
    if (mappedRole === AppRole.EMPLOYEE) {
      const approved = roleData?.approved ?? false;
      if (!approved) {
        await supabase.auth.signOut();
        return {
          data: null,
          error: new Error("Your account is pending admin approval. Please wait for an administrator to approve your access."),
        };
      }
      setIsApproved(true);
    } else {
      // For users (customers) and admins, they're always "approved"
      setIsApproved(true);
    }

    setRole(mappedRole);

    return {
      data: { role: mappedRole, isApproved: roleData?.approved ?? true },
      error: null,
    };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setIsApproved(null);
  };

  return (
    <AuthContext.Provider
      value={{ 
        user, 
        session, 
        role, 
        loading, 
        isApproved,
        signUp, 
        signIn, 
        signOut 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
