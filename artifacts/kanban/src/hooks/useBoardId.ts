import { useRoute } from "wouter";

export function useBoardIdFromRoute(): number | undefined {
  const [boardMatch, boardParams] = useRoute("/boards/:boardId");
  const [statsMatch, statsParams] = useRoute("/boards/:boardId/stats");
  const raw = boardMatch ? boardParams?.boardId : statsMatch ? statsParams?.boardId : undefined;
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isFinite(id) ? id : undefined;
}
