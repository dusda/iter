import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { api } from "@/api/supabaseApi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";

export default function Notifications() {
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const currentUser = await api.auth.me();
    setUser(currentUser);
  };

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api.entities.Notification.filter({ user_id: user.id }, "-created_date"),
    enabled: !!user,
  });

  const markAsRead = useMutation({
    mutationFn: (notificationId) => api.entities.Notification.update(notificationId, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications"]);
    },
  });

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.is_read);
    await Promise.all(unread.map(n => api.entities.Notification.update(n.id, { is_read: true })));
    queryClient.invalidateQueries(["notifications"]);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay updated on your fund requests"
        actions={
          unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline">
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark all as read
            </Button>
          )
        }
      />

      {isLoading ? (
        <LoadingSpinner className="py-16" />
      ) : notifications.length === 0 ? (
        <Card className="bg-white/70 backdrop-blur-sm border-slate-200/50">
          <CardContent className="p-12 text-center">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No notifications yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`bg-white/70 backdrop-blur-sm border-slate-200/50 hover:shadow-md transition-all ${
                !notification.is_read ? "ring-2 ring-indigo-200" : ""
              }`}
            >
              <CardContent className="p-5">
                <Link
                  to={notification.link || createPageUrl("Home")}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead.mutate(notification.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-4">
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600 mt-2 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className={`${!notification.is_read ? "font-bold" : "font-semibold"} text-slate-900`}>
                          {notification.title}
                        </h3>
                        <Badge variant={notification.is_read ? "outline" : "default"} className="text-xs flex-shrink-0">
                          {notification.type.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-slate-600 mb-2">{notification.message}</p>
                      <p className="text-xs text-slate-400">
                        {format(new Date(notification.created_date), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}