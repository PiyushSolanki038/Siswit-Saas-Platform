import { createClient } from "@supabase/supabase-js";

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

const HANDLERS = {
  "document.generate": async (job) => {
    console.log(`[job:${job.id}] Executing document.generate`);
    const { error } = await supabase.functions.invoke("generate-document", {
      body: job.payload,
    });
    if (error) throw error;
  },
  "document.generate_pdf": async (job) => {
    console.log(`[job:${job.id}] Executing document.generate_pdf`);
    const { error } = await supabase.functions.invoke("convert-to-pdf", {
      body: job.payload,
    });
    if (error) throw error;
  },
  "email.send": async (job) => {
    console.log(`[job:${job.id}] Executing email.send to ${job.payload?.to}`);
    const { error } = await supabase.functions.invoke("send-email", {
      body: job.payload,
    });
    if (error) throw error;
  },
  "email.reminder": async (job) => {
    console.log(`[job:${job.id}] Executing email.reminder`);
    const { error } = await supabase.functions.invoke("send-reminder", {
      body: job.payload,
    });
    if (error) throw error;
  },
  "contract.expiry_alert": async (job) => {
    console.log(`[job:${job.id}] Executing contract.expiry_alert`);
    const { error } = await supabase.functions.invoke("contract-expiry-alert", {
      body: job.payload,
    });
    if (error) throw error;
  },
};

/**
 * Calculates exponential backoff in seconds: 60 * (2 ^ attempts)
 * attempts: 0 -> 60s
 * attempts: 1 -> 120s
 * attempts: 2 -> 240s
 * attempts: 3 -> 480s (8 min)
 */
function getBackoffTime(attempts) {
  const minutes = Math.pow(2, attempts);
  return minutes * 60 * 1000;
}


async function claimJobs(limit = 10) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("background_jobs")
    .select("*")
    .eq("status", "queued")
    .lte("available_at", now)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

async function markProcessing(jobId) {
  await supabase
    .from("background_jobs")
    .update({
      status: "processing",
      locked_at: new Date().toISOString(),
      locked_by: "node-worker",
    })
    .eq("id", jobId);
}

async function markDone(jobId) {
  await supabase
    .from("background_jobs")
    .update({
      status: "succeeded",
      finished_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", jobId);
}

async function markFailed(job, errorMessage) {
  const nextAttempts = (job.attempts ?? 0) + 1;
  const maxAttempts = job.max_attempts ?? 5;
  const exhausted = nextAttempts >= maxAttempts;
  
  const backoffMs = getBackoffTime(nextAttempts - 1);
  const nextAvailableAt = new Date(Date.now() + backoffMs).toISOString();

  await supabase
    .from("background_jobs")
    .update({
      status: exhausted ? "failed" : "queued",
      attempts: nextAttempts,
      last_error: errorMessage,
      locked_at: null,
      locked_by: null,
      available_at: exhausted ? job.available_at : nextAvailableAt,
      finished_at: exhausted ? new Date().toISOString() : null,
    })
    .eq("id", job.id);
}

async function processJob(job) {
  const handler = HANDLERS[job.job_type];
  if (!handler) {
    await markFailed(job, `No handler registered for job type: ${job.job_type}`);
    return;
  }

  try {
    await markProcessing(job.id);
    await handler(job);
    await markDone(job.id);
  } catch (error) {
    await markFailed(job, error instanceof Error ? error.message : String(error));
  }
}

async function recoverStuckJobs() {
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { error } = await supabase
    .from("background_jobs")
    .update({
      status: "queued",
      locked_at: null,
      locked_by: null,
      last_error: "Job timed out in processing state",
    })
    .eq("status", "processing")
    .lt("locked_at", oneHourAgo);

  if (error) console.error("Failed to recover stuck jobs:", error);
}

async function run() {
  await recoverStuckJobs();
  const jobs = await claimJobs();
  if (!jobs.length) {
    console.log("No queued jobs.");
    return;
  }

  for (const job of jobs) {
    await processJob(job);
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Worker failed:", error);
    process.exit(1);
  });

