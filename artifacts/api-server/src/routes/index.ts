import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import columnsRouter from "./columns";
import tasksRouter from "./tasks";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

// All routes below require authentication
router.use(requireAuth);
router.use(columnsRouter);
router.use(tasksRouter);

export default router;
