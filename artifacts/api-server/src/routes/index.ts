import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import partyRouter from "./party";
import adventureRouter from "./adventure";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use(partyRouter);
router.use(adventureRouter);

export default router;
