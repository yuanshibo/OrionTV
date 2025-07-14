import express, { Request, Response } from "express";

const router = express.Router();

/**
 * @api {get} /api/server-config Get Server Configuration
 * @apiName GetServerConfig
 * @apiGroup Server
 *
 * @apiSuccess {String} SiteName The name of the site.
 * @apiSuccess {String} StorageType The storage type used by the server ("localstorage").
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "SiteName": "OrionTV-Local",
 *       "StorageType": "localstorage"
 *     }
 */
router.get("/server-config", (req: Request, res: Response) => {
  res.json({
    SiteName: "OrionTV-Local",
    StorageType: "localstorage",
  });
});

export default router;
