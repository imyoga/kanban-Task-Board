import { useEffect } from "react";
import { useListBoards } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function HomeRedirect() {
  const { data: boards = [], isLoading } = useListBoards();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && boards.length > 0) {
      setLocation(`/boards/${boards[0].id}`);
    }
  }, [boards, isLoading, setLocation]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );
}
