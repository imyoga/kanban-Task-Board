import { useState } from "react";
import { Bell } from "lucide-react";
import { useGetUnreadNotificationsCount, getGetUnreadNotificationsCountQueryKey } from "@workspace/api-client-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import NotificationsModal from "./NotificationsModal";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  className?: string;
}

export default function NotificationBell({ className }: NotificationBellProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: unreadData } = useGetUnreadNotificationsCount({
    query: {
      queryKey: getGetUnreadNotificationsCountQueryKey(),
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const unreadCount = unreadData?.count ?? 0;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            className={cn(
              "relative h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shadow-2xs flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              unreadCount > 0 && "text-foreground",
              className,
            )}
          >
            <Bell className="w-3.5 h-3.5" />

            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary/90 text-primary-foreground ring-2 ring-background px-1 text-[9px] font-medium leading-none select-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "Notifications"}
          </span>
        </TooltipContent>
      </Tooltip>

      <NotificationsModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
