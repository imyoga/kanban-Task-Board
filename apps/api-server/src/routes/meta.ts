import { Router } from "express";
import { GetTaskPreviewQueryParams, GetTaskPreviewResponse } from "@workspace/api-zod";
import { getTaskPreviewMeta } from "../lib/metaPreview";

const router = Router();

router.get("/meta/task-preview", async (req, res) => {
  const queryResult = GetTaskPreviewQueryParams.safeParse(req.query);
  if (!queryResult.success) {
    res.status(400).json({ error: queryResult.error.message });
    return;
  }

  const { boardId, taskKey } = queryResult.data;
  const meta = await getTaskPreviewMeta(boardId, taskKey);

  if (!meta) {
    res.status(404).json({ error: "Task or board not found" });
    return;
  }

  const host = req.get("host") || "localhost";
  const protocol = req.protocol || "http";
  const imageUrl = `${protocol}://${host}/opengraph.jpg`;

  const responseData = GetTaskPreviewResponse.parse({
    ...meta,
    imageUrl,
  });

  res.json(responseData);
});

export default router;
