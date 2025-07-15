import express, { Request, Response } from "express";
import { getConfig } from "../config";

const router = express.Router();

/**
 * @api {get} /api/server-config Get Server Configuration
 * @apiName GetServerConfig
 * @apiGroup Server
 *
 * @apiSuccess {String} SiteName The name of the site.
 * @apiSuccess {String} StorageType The storage type used by the server ("localstorage" or "database").
 *
 * @apiSuccessExample {json} Success-Response (LocalStorage):
 *     HTTP/1.1 200 OK
 *     {
 *       "SiteName": "OrionTV-Local",
 *       "StorageType": "localstorage"
 *     }
 *
 * @apiSuccessExample {json} Success-Response (Database):
 *     HTTP/1.1 200 OK
 *     {
 *       "SiteName": "OrionTV-Cloud",
 *       "StorageType": "database"
 *     }
 */
router.get("/server-config", (req: Request, res: Response) => {
  const config = getConfig();
  const storageType = config.storage?.type || "database"; // Default to 'database' if not specified

  res.json({
    SiteName: storageType === "localstorage" ? "OrionTV-Local" : "OrionTV-Cloud",
    StorageType: storageType,
  });
});

export default router;
