import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bookerRouter from "./booker";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bookerRouter);

export default router;
