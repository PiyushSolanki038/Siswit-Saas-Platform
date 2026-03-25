import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/core/api/client";
import { useAuth } from "@/core/auth/useAuth";
import { toast } from "sonner";
import type { Notification } from "@/core/types/notifications";

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Fetch notifications
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data as any) as Notification[];
    },
    enabled: !!userId,
  });

  // Fetch unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { data, error } = await supabase.rpc("get_unread_count" as any, {
        p_user_id: userId,
      });

      if (error) throw error;
      return (data as any) as number;
    },
    enabled: !!userId,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("mark_notification_read" as any, {
        p_notification_id: id,
      });
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications", userId] });
      await queryClient.cancelQueries({ queryKey: ["notifications", "unread-count", userId] });

      const previousNotifications = queryClient.getQueryData<Notification[]>(["notifications", userId]);
      const previousUnreadCount = queryClient.getQueryData<number>(["notifications", "unread-count", userId]);

      if (previousNotifications) {
        queryClient.setQueryData<Notification[]>(
          ["notifications", userId],
          previousNotifications.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
      }

      if (previousUnreadCount !== undefined) {
        queryClient.setQueryData<number>(["notifications", "unread-count", userId], Math.max(0, previousUnreadCount - 1));
      }

      return { previousNotifications, previousUnreadCount };
    },
    onError: (_err, _id, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(["notifications", userId], context.previousNotifications);
      }
      if (context?.previousUnreadCount !== undefined) {
        queryClient.setQueryData(["notifications", "unread-count", userId], context.previousUnreadCount);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count", userId] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase.rpc("mark_all_notifications_read" as any, {
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count", userId] });
      toast.success("All notifications marked as read");
    },
  });

  // Subscribe to realtime notifications
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          
          // Show toast
          toast(newNotification.title, {
            description: newNotification.message,
            action: newNotification.link ? {
              label: "View",
              onClick: () => window.location.href = newNotification.link!,
            } : undefined,
          });

          // Update query data
          queryClient.setQueryData<Notification[]>(["notifications", userId], (old = []) => [
            newNotification,
            ...old,
          ]);
          queryClient.setQueryData<number>(["notifications", "unread-count", userId], (old = 0) => old + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    refetch,
  };
}
