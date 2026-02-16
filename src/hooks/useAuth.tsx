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
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => Promise<{ error: Error | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ data: { role: AppRole } | null; error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ---------- ROLE MAPPER (FIXED) ---------- */
const mapRole = (role: string | null): AppRole | null => {
  if (!role) return null;
  return role as AppRole; //direct cast (no switch needed)
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const authInitialized = useRef(false);

  /* -------------------- INIT AUTH (ONCE) -------------------- */
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);
      setUser(session?.user ?? null);

      // mark auth initialized
      authInitialized.current = true;
      setLoading(false);

      // load role after auth (non-blocking)
      if (session?.user) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        setRole(mapRole(data?.role ?? null));
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setRole(null); // reset role

        if (session?.user) {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .maybeSingle();

          setRole(mapRole(data?.role ?? null));
        }

        if (!authInitialized.current) {
          authInitialized.current = true;
          setLoading(false);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  /* -------------------- ACTIONS -------------------- */

  const signUp = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
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

    // fetch role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();

    console.log("RAW ROLE FROM DB:", roleData?.role); // debug (remove later)

    const mappedRole = mapRole(roleData?.role ?? null);

    // if role not assigned -> block login
    if (!mappedRole) {
      await supabase.auth.signOut();
      return {
        data: null,
        error: new Error("Account pending admin approval."),
      };
    }

    setRole(mappedRole);

    return {
      data: { role: mappedRole },
      error: null,
    };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, role, loading, signUp, signIn, signOut }}
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
