import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import type { NotificationType } from "@/core/types/notifications";

interface CreateNotificationParams {
  userId: string;
  organizationId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export function useCreateNotification() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      userId,
      organizationId,
      type,
      title,
      message,
      link,
      metadata = {},
    }: CreateNotificationParams) => {
      const { data, error } = await supabase.rpc("create_notification" as any, {
        p_organization_id: organizationId,
        p_user_id: userId,
        p_type: type,
        p_title: title,
        p_message: message,
        p_link: link,
        p_metadata: metadata,
      });

      if (error) throw error;
      return data;
    },
    onError: (error) => {
      console.error("Failed to create notification:", error);
      // We don't show a toast here usually as this is a background operation
    },
    onSuccess: () => {
      // Potentially invalidate unread count if we are notifying the current user
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  return {
    notify: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
