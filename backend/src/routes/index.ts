import { Router } from "express";
import searchRouter from "./search";
import detailRouter from "./detail";
import doubanRouter from "./douban";
import imageProxyRouter from "./image-proxy";
import serverConfigRouter from "./server-config";
import loginRouter from "./login";
import favoritesRouter from "./favorites";
import playRecordsRouter from "./playrecords";
import searchHistoryRouter from "./searchhistory";

const router = Router();

router.use(serverConfigRouter);
router.use(loginRouter);
router.use(favoritesRouter);
router.use(playRecordsRouter);
router.use(searchHistoryRouter);
router.use("/search", searchRouter);
router.use("/detail", detailRouter);
router.use("/douban", doubanRouter);
router.use("/image-proxy", imageProxyRouter);

export default router;
