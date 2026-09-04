import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import boardsRouter from "./boards";
import columnsRouter from "./columns";
import tasksRouter from "./tasks";
import teamsRouter from "./teams";
import attachmentsRouter from "./attachments";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

// All routes below require authentication
router.use(requireAuth);
router.use(boardsRouter);
router.use(columnsRouter);
router.use(tasksRouter);
router.use(teamsRouter);
router.use(attachmentsRouter);

export default router;
