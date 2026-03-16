import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const shouldShowHelp = args.has("--help") || args.has("-h");
const pageSizeArg = [...args].find((value) => value.startsWith("--per-page="));
const perPage = Math.min(Math.max(Number(pageSizeArg?.split("=")[1] ?? "200"), 1), 1000);

if (shouldShowHelp) {
  console.log([
    "Usage: node scripts/cleanup-precreated-invite-users.mjs [--apply] [--per-page=200]",
    "",
    "Defaults to dry-run mode and prints a report only.",
    "Add --apply to delete only safe orphaned invite-created auth users.",
  ].join("\n"));
  process.exit(0);
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function chunk(values, size) {
  const items = [];
  for (let index = 0; index < values.length; index += size) {
    items.push(values.slice(index, index + size));
  }
  return items;
}

function isInviteSignupType(signupType) {
  return signupType === "employee_invitation" || signupType === "client_invitation";
}

async function loadPendingInvitations() {
  const [{ data: employeeInvites, error: employeeError }, { data: clientInvites, error: clientError }] = await Promise.all([
    supabase
      .from("employee_invitations")
      .select("id, organization_id, invited_email, expires_at, created_at")
      .eq("status", "pending"),
    supabase
      .from("client_invitations")
      .select("id, organization_id, invited_email, expires_at, created_at")
      .eq("status", "pending"),
  ]);

  if (employeeError) {
    throw new Error(`Failed to load pending employee invitations: ${employeeError.message}`);
  }

  if (clientError) {
    throw new Error(`Failed to load pending client invitations: ${clientError.message}`);
  }

  const inviteMap = new Map();

  for (const invite of employeeInvites ?? []) {
    const email = normalizeEmail(invite.invited_email);
    if (!email) continue;
    const existing = inviteMap.get(email) ?? [];
    existing.push({
      invitation_type: "employee",
      invitation_id: invite.id,
      organization_id: invite.organization_id,
      expires_at: invite.expires_at,
      created_at: invite.created_at,
    });
    inviteMap.set(email, existing);
  }

  for (const invite of clientInvites ?? []) {
    const email = normalizeEmail(invite.invited_email);
    if (!email) continue;
    const existing = inviteMap.get(email) ?? [];
    existing.push({
      invitation_type: "client",
      invitation_id: invite.id,
      organization_id: invite.organization_id,
      expires_at: invite.expires_at,
      created_at: invite.created_at,
    });
    inviteMap.set(email, existing);
  }

  return inviteMap;
}

async function loadInviteMatchedAuthUsers(pendingInvitesByEmail) {
  const matchedUsers = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Failed to list auth users on page ${page}: ${error.message}`);
    }

    const users = data?.users ?? [];
    for (const user of users) {
      const email = normalizeEmail(user.email);
      if (!email || !pendingInvitesByEmail.has(email)) continue;
      matchedUsers.push(user);
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return matchedUsers;
}

async function loadMembershipsByUserId(userIds) {
  const membershipMap = new Map();
  for (const userIdChunk of chunk(userIds, 200)) {
    if (!userIdChunk.length) continue;

    const { data, error } = await supabase
      .from("organization_memberships")
      .select("id, user_id, organization_id, email, role, account_state")
      .in("user_id", userIdChunk);

    if (error) {
      throw new Error(`Failed to load organization memberships: ${error.message}`);
    }

    for (const row of data ?? []) {
      const existing = membershipMap.get(row.user_id) ?? [];
      existing.push(row);
      membershipMap.set(row.user_id, existing);
    }
  }

  return membershipMap;
}

async function loadProfileUserIds(userIds) {
  const profileUserIds = new Set();
  for (const userIdChunk of chunk(userIds, 200)) {
    if (!userIdChunk.length) continue;

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id")
      .in("user_id", userIdChunk);

    if (error) {
      throw new Error(`Failed to load profiles: ${error.message}`);
    }

    for (const row of data ?? []) {
      profileUserIds.add(row.user_id);
    }
  }

  return profileUserIds;
}

function classifyUser(user, pendingInvites, memberships, hasProfile) {
  const signupType = typeof user.user_metadata?.signup_type === "string" ? user.user_metadata.signup_type : null;
  const hasInviteMetadata = signupType ? isInviteSignupType(signupType) : false;
  const hasConflictingMetadata = Boolean(signupType) && !hasInviteMetadata;
  const hasConfirmedEmail = Boolean(user.email_confirmed_at);
  const hasSignInActivity = Boolean(user.last_sign_in_at);
  const hasMemberships = memberships.length > 0;

  const reasonFlags = [];
  if (hasMemberships) {
    reasonFlags.push("has organization membership rows");
  }
  if (hasProfile) {
    reasonFlags.push("has profile row");
  }
  if (hasConfirmedEmail) {
    reasonFlags.push("email already confirmed");
  }
  if (hasSignInActivity) {
    reasonFlags.push("user already signed in");
  }
  if (hasConflictingMetadata) {
    reasonFlags.push(`signup_type is ${signupType} instead of an invitation type`);
  }

  const record = {
    user_id: user.id,
    email: normalizeEmail(user.email),
    created_at: user.created_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    signup_type: signupType,
    invite_metadata_matches: hasInviteMetadata,
    pending_invitations: pendingInvites,
    membership_rows: memberships,
    has_profile: hasProfile,
  };

  if (reasonFlags.length === 0) {
    return {
      bucket: "safe_delete_candidates",
      record: {
        ...record,
        reasons: [
          "matches a pending invitation",
          "has no membership row",
          "has no profile row",
          "email is unconfirmed",
          "has no sign-in activity",
          hasInviteMetadata ? "metadata also indicates an invitation flow" : "metadata is absent or neutral",
        ],
      },
    };
  }

  return {
    bucket: "manual_review_candidates",
    record: {
      ...record,
      reasons: reasonFlags,
    },
  };
}

async function deleteSafeCandidates(candidates) {
  const deletedUserIds = [];
  const deleteFailures = [];

  for (const candidate of candidates) {
    const { error } = await supabase.auth.admin.deleteUser(candidate.user_id);
    if (error) {
      deleteFailures.push({
        user_id: candidate.user_id,
        email: candidate.email,
        error: error.message,
      });
      continue;
    }

    deletedUserIds.push(candidate.user_id);
  }

  return { deletedUserIds, deleteFailures };
}

async function main() {
  const pendingInvitesByEmail = await loadPendingInvitations();
  const pendingInviteEmails = [...pendingInvitesByEmail.keys()];

  if (!pendingInviteEmails.length) {
    console.log(JSON.stringify({
      mode: shouldApply ? "apply" : "dry-run",
      message: "No pending invitations found. Nothing to clean up.",
      safe_delete_candidates: [],
      manual_review_candidates: [],
    }, null, 2));
    return;
  }

  const matchedUsers = await loadInviteMatchedAuthUsers(pendingInvitesByEmail);
  const matchedUserIds = matchedUsers.map((user) => user.id);
  const membershipsByUserId = await loadMembershipsByUserId(matchedUserIds);
  const profileUserIds = await loadProfileUserIds(matchedUserIds);

  const safeDeleteCandidates = [];
  const manualReviewCandidates = [];

  for (const user of matchedUsers) {
    const email = normalizeEmail(user.email);
    const pendingInvites = pendingInvitesByEmail.get(email) ?? [];
    const memberships = membershipsByUserId.get(user.id) ?? [];
    const hasProfile = profileUserIds.has(user.id);

    const classified = classifyUser(user, pendingInvites, memberships, hasProfile);
    if (classified.bucket === "safe_delete_candidates") {
      safeDeleteCandidates.push(classified.record);
      continue;
    }

    manualReviewCandidates.push(classified.record);
  }

  const report = {
    mode: shouldApply ? "apply" : "dry-run",
    per_page: perPage,
    pending_invitation_email_count: pendingInviteEmails.length,
    matched_auth_user_count: matchedUsers.length,
    safe_delete_candidates: safeDeleteCandidates,
    manual_review_candidates: manualReviewCandidates,
    notes: [
      "Dry-run is the default. Re-run with --apply to delete only safe_delete_candidates.",
      "Deleted auth users do not cancel or accept the pending invitations. Those invitation links can still be resent or reused.",
      "Users with any profile, membership, confirmed email, sign-in activity, or conflicting signup metadata are left for manual review.",
    ],
  };

  if (!shouldApply || safeDeleteCandidates.length === 0) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const { deletedUserIds, deleteFailures } = await deleteSafeCandidates(safeDeleteCandidates);
  console.log(JSON.stringify({
    ...report,
    deleted_user_ids: deletedUserIds,
    delete_failures: deleteFailures,
  }, null, 2));
}

main().catch((error) => {
  console.error("Failed to clean up precreated invite users:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
