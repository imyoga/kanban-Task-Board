import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ShieldAlert, LayoutDashboard, Users } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  fallbackBoardId?: number;
}

export default function AccessDeniedModal({ open, onOpenChange, fallbackBoardId }: Props) {
  const [, setLocation] = useLocation();

  function handleGoToBoards() {
    if (onOpenChange) onOpenChange(false);
    if (fallbackBoardId) {
      setLocation(`/boards/${fallbackBoardId}`);
    } else {
      setLocation("/");
    }
  }

  function handleGoToTeams() {
    if (onOpenChange) onOpenChange(false);
    setLocation("/teams");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 [&>button]:hidden">
        <DialogHeader className="pb-2 text-center sm:text-left flex flex-col items-center sm:items-start gap-2">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-1">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Access Denied
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1 leading-relaxed">
            You don't have access to this board. Ask the admin to provide access or add you to their team.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-border/40 mt-4">
          <Button
            variant="outline"
            onClick={handleGoToTeams}
            className="w-full sm:w-auto gap-2 text-xs font-semibold"
          >
            <Users className="w-4 h-4" />
            View Teams
          </Button>
          <Button
            variant="default"
            onClick={handleGoToBoards}
            className="w-full sm:w-auto gap-2 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <LayoutDashboard className="w-4 h-4" />
            Go to My Boards
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
