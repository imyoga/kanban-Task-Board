import { useRoute } from "wouter";

export function useBoardIdFromRoute(): number | undefined {
  const [taskMatch, taskParams] = useRoute("/boards/:boardId/:taskKey");
  const [boardMatch, boardParams] = useRoute("/boards/:boardId");
  const [statsMatch, statsParams] = useRoute("/boards/:boardId/stats");
  const raw = taskMatch
    ? taskParams?.boardId
    : boardMatch
      ? boardParams?.boardId
      : statsMatch
        ? statsParams?.boardId
        : undefined;
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isFinite(id) ? id : undefined;
}

export function useTaskKeyFromRoute(): string | undefined {
  const [taskMatch, taskParams] = useRoute("/boards/:boardId/:taskKey");
  return taskMatch ? taskParams?.taskKey : undefined;
}
