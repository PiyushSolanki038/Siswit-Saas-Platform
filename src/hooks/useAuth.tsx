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
    lastName: string,
    signupType: "employee" | "customer"
  ) => Promise<{ error: Error | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ data: { role: AppRole } | null; error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapRole = (role: string | null): AppRole | null => {
  switch (role) {
    case AppRole.ADMIN:
      return AppRole.ADMIN;
    case AppRole.EMPLOYEE:
      return AppRole.EMPLOYEE;
    case AppRole.USER:
      return AppRole.USER;
    default:
      return null;
  }
};

interface RoleState {
  role: AppRole | null;
  approved: boolean | null;
  error: Error | null;
}

const normalizeRolePayload = (
  payload: unknown
): { role: string | null; approved: boolean | null } => {
  if (Array.isArray(payload)) {
    const first = payload[0] as Record<string, unknown> | undefined;
    return {
      role: typeof first?.role === "string" ? first.role : null,
      approved: typeof first?.approved === "boolean" ? first.approved : null,
    };
  }

  if (payload && typeof payload === "object") {
    const row = payload as Record<string, unknown>;
    return {
      role: typeof row.role === "string" ? row.role : null,
      approved: typeof row.approved === "boolean" ? row.approved : null,
    };
  }

  return { role: null, approved: null };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setRoleApproved] = useState<boolean | null>(null);

  const roleLoadId = useRef(0);
  const manualSignInInProgress = useRef(false);

  const fetchRoleState = async (): Promise<RoleState> => {
    const { data, error } = await supabase.rpc("ensure_user_role");

    if (error) {
      return {
        role: null,
        approved: null,
        error: new Error(error.message),
      };
    }

    const normalized = normalizeRolePayload(data);
    const mappedRole = mapRole(normalized.role);

    if (!mappedRole) {
      return {
        role: null,
        approved: normalized.approved,
        error: new Error("Unable to determine account role."),
      };
    }

    return {
      role: mappedRole,
      approved: normalized.approved,
      error: null,
    };
  };

  useEffect(() => {
    const resolveSessionState = async (nextSession: Session | null) => {
      const currentLoadId = ++roleLoadId.current;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRole(null);
        setRoleApproved(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const roleState = await fetchRoleState();

      if (roleLoadId.current !== currentLoadId) {
        return;
      }

      if (roleState.error || !roleState.role) {
        setRole(null);
        setRoleApproved(null);
        setLoading(false);
        return;
      }

      if (
        roleState.role === AppRole.EMPLOYEE &&
        roleState.approved !== true &&
        !manualSignInInProgress.current
      ) {
        await supabase.auth.signOut();

        if (roleLoadId.current !== currentLoadId) {
          return;
        }

        setSession(null);
        setUser(null);
        setRole(null);
        setRoleApproved(null);
        setLoading(false);
        return;
      }

      setRole(roleState.role);
      setRoleApproved(roleState.approved);
      setLoading(false);
    };

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      await resolveSessionState(session);
    };

    void init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        void resolveSessionState(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

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
          signup_type: signupType,
        },
      },
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    manualSignInInProgress.current = true;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) {
        return { data: null, error: error as Error };
      }

      const roleState = await fetchRoleState();

      if (roleState.error || !roleState.role) {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setRole(null);
        setRoleApproved(null);

        return {
          data: null,
          error:
            roleState.error ?? new Error("Unable to determine account role."),
        };
      }

      if (roleState.role === AppRole.EMPLOYEE && roleState.approved !== true) {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setRole(null);
        setRoleApproved(null);

        return {
          data: null,
          error: new Error("Your account is waiting for admin approval"),
        };
      }

      setUser(data.user);
      setSession(data.session);
      setRole(roleState.role);
      setRoleApproved(roleState.approved);

      return {
        data: { role: roleState.role },
        error: null,
      };
    } finally {
      manualSignInInProgress.current = false;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setRoleApproved(null);
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
