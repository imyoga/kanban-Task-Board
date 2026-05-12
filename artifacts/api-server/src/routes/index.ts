import { Router, type IRouter } from "express";
import healthRouter from "./health";
import columnsRouter from "./columns";
import tasksRouter from "./tasks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(columnsRouter);
router.use(tasksRouter);

export default router;
