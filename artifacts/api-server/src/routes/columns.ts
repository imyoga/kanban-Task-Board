import { Router } from "express";
import { db, columnsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import {
  CreateColumnBody,
  UpdateColumnParams,
  UpdateColumnBody,
  DeleteColumnParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/columns", async (req, res) => {
  const columns = await db.select().from(columnsTable).orderBy(asc(columnsTable.position));
  res.json(columns.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/columns", async (req, res) => {
  const parsed = CreateColumnBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { title, color, position } = parsed.data;
  const existing = await db.select().from(columnsTable).orderBy(asc(columnsTable.position));
  const pos = position ?? existing.length;
  const [col] = await db.insert(columnsTable).values({ title, color, position: pos }).returning();
  res.status(201).json({ ...col, createdAt: col.createdAt.toISOString() });
});

router.patch("/columns/:id", async (req, res) => {
  const paramsParsed = UpdateColumnParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const bodyParsed = UpdateColumnBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (bodyParsed.data.title !== undefined) updates.title = bodyParsed.data.title;
  if (bodyParsed.data.color !== undefined) updates.color = bodyParsed.data.color;
  if (bodyParsed.data.position !== undefined) updates.position = bodyParsed.data.position;

  const [col] = await db.update(columnsTable).set(updates).where(eq(columnsTable.id, paramsParsed.data.id)).returning();
  if (!col) {
    res.status(404).json({ error: "Column not found" });
    return;
  }
  res.json({ ...col, createdAt: col.createdAt.toISOString() });
});

router.delete("/columns/:id", async (req, res) => {
  const parsed = DeleteColumnParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [col] = await db.delete(columnsTable).where(eq(columnsTable.id, parsed.data.id)).returning();
  if (!col) {
    res.status(404).json({ error: "Column not found" });
    return;
  }
  res.status(204).send();
});

export default router;
