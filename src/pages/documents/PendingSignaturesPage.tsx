import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  useDocumentESignatures,
  useSendDocumentReminder,
} from "@/hooks/useDocuments";
import { AlertCircle, Clock, Mail, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

const PendingSignaturesPage = () => {
  const navigate = useNavigate();
  const sendReminderMutation = useSendDocumentReminder();
  const {
    data: signatures = [],
    isLoading,
    refetch,
  } = useDocumentESignatures();
  const [isSendingBulkReminders, setIsSendingBulkReminders] = useState(false);

  const pendingSignatures = useMemo(
    () => signatures.filter((signature) => signature.status === "pending"),
    [signatures],
  );

  const expiringSoonCount = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 2);
    return pendingSignatures.filter((signature) => {
      if (!signature.expires_at) {
        return false;
      }
      return new Date(signature.expires_at) <= cutoff;
    }).length;
  }, [pendingSignatures]);

  const totalRemindersSent = useMemo(() => {
    return pendingSignatures.reduce(
      (sum, signature) => sum + (signature.reminder_count || 0),
      0,
    );
  }, [pendingSignatures]);

  const handleRemind = async (signatureId: string) => {
    try {
      await sendReminderMutation.mutateAsync(signatureId);
    } catch {
      // Error toast is handled in the mutation hook.
    }
  };

  const handleSendBulkReminders = async () => {
    setIsSendingBulkReminders(true);
    try {
      const promises = pendingSignatures.map((sig) =>
        sendReminderMutation.mutateAsync(sig.id),
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failureCount = results.filter((r) => r.status === "rejected").length;

      if (successCount > 0) {
        toast.success(
          `Sent ${successCount} reminder${successCount !== 1 ? "s" : ""}`,
        );
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} reminder${failureCount !== 1 ? "s" : ""} failed`,
        );
      }
    } finally {
      setIsSendingBulkReminders(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Pending Signatures
          </h1>
          <p className="text-muted-foreground">
            Track outstanding recipients and send reminders.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="hero"
            onClick={handleSendBulkReminders}
            disabled={isSendingBulkReminders || pendingSignatures.length === 0}
          >
            <Mail className="mr-2 h-4 w-4" />
            Send Reminders
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {pendingSignatures.length}
              </div>
              <div className="text-sm text-muted-foreground">
                Awaiting Signature
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/30 dark:bg-red-900/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertCircle className="h-5 w-5 text-red-700 dark:text-red-300" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {expiringSoonCount}
              </div>
              <div className="text-sm text-muted-foreground">
                Expiring in 48h
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {totalRemindersSent}
              </div>
              <div className="text-sm text-muted-foreground">
                Reminders Sent
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center">
          <Clock className="mx-auto mb-4 h-12 w-12 animate-spin text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            Loading signatures...
          </h3>
        </div>
      ) : pendingSignatures.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-12 text-center">
          <Send className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold text-foreground">
            No pending signatures
          </h3>
          <p className="text-muted-foreground">
            All signature requests are completed or there are none yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingSignatures.map((signature) => {
            const expiresText = signature.expires_at
              ? formatDistanceToNow(new Date(signature.expires_at), {
                  addSuffix: true,
                })
              : "No expiration";

            return (
              <div
                key={signature.id}
                className="rounded-xl border border-border bg-card p-6 shadow-card transition-all hover:shadow-card-hover"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="flex flex-1 items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <Send className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-foreground">
                          {signature.document?.name || "Untitled Document"}
                        </h3>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-secondary-foreground">
                          {signature.document?.type || "document"}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemind(signature.id)}
                        disabled={sendReminderMutation.isPending}
                      >
                        <Mail className="mr-1 h-4 w-4" />
                        Remind
                      </Button>
                      <div className="text-sm text-muted-foreground">
                        Sent{" "}
                        {formatDistanceToNow(new Date(signature.created_at), {
                          addSuffix: true,
                        })}{" "}
                        • Expires {expiresText}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 lg:ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemind(signature.id)}
                      disabled={sendReminderMutation.isPending}
                    >
                      <Mail className="mr-1 h-4 w-4" />
                      Remind
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        signature.document_id &&
                        navigate(
                          `/dashboard/documents/${signature.document_id}/esign`,
                        )
                      }
                      disabled={!signature.document_id}
                    >
                      View
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PendingSignaturesPage;
