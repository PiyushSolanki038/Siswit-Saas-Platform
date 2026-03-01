import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { AppRole } from "@/core/types/roles";

export type AuthRole = AppRole | null;

export interface OrganizationSignUpInput {
  organizationName: string;
  organizationCode?: string;
  ownerFullName: string;
  email: string;
  password: string;
}

export interface ClientSelfSignUpInput {
  organizationSlugOrCode: string;
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
}

export interface AcceptEmployeeInvitationInput {
  token: string;
  fullName: string;
  password: string;
  employeeId?: string;
}

export interface AcceptClientInvitationInput {
  token: string;
  fullName: string;
  password: string;
}

export interface InviteEmployeeInput {
  organizationId: string;
  email: string;
  role: "admin" | "manager" | "employee";
  employeeRoleId?: string | null;
  customRoleName?: string | null;
  expiresAt: string;
  message?: string;
}

export interface InviteClientInput {
  organizationId: string;
  email: string;
  expiresAt: string;
  message?: string;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AuthRole;
  loading: boolean;
  isLoggingOut: boolean;

  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<{ error: string | null; role: AuthRole }>;

  /** @deprecated Use signUpOrganization, signUpClientSelf, or invitation acceptance instead. */
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    signupType: string,
  ) => Promise<{ error: { message: string } | null }>;

  signUpOrganization: (input: OrganizationSignUpInput) => Promise<{ error: string | null }>;
  signUpClientSelf: (input: ClientSelfSignUpInput) => Promise<{ error: string | null }>;
  acceptEmployeeInvitation: (input: AcceptEmployeeInvitationInput) => Promise<{ error: string | null }>;
  acceptClientInvitation: (input: AcceptClientInvitationInput) => Promise<{ error: string | null }>;

  inviteEmployee: (
    input: InviteEmployeeInput,
  ) => Promise<{ error: string | null; invitationUrl?: string; emailError?: string | null }>;
  inviteClient: (
    input: InviteClientInput,
  ) => Promise<{ error: string | null; invitationUrl?: string; emailError?: string | null }>;

  approveClientMembership: (membershipId: string) => Promise<{ error: string | null }>;
  rejectClientMembership: (membershipId: string) => Promise<{ error: string | null }>;

  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;

  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
