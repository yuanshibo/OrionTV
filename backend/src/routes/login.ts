import express, { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const password = process.env.PASSWORD;

/**
 * @api {post} /api/login User Login
 * @apiName UserLogin
 * @apiGroup User
 *
 * @apiBody {String} password User's password.
 *
 * @apiSuccess {Boolean} ok Indicates if the login was successful.
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "ok": true
 *     }
 *
 * @apiError {String} message Error message.
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "message": "Invalid password"
 *     }
 */
router.post("/login", (req: Request, res: Response) => {
  if (!password) {
    // If no password is set, login is always successful.
    return res.json({ ok: true });
  }

  const { password: inputPassword } = req.body;

  if (inputPassword === password) {
    res.json({ ok: true });
  } else {
    res.status(400).json({ message: "Invalid password" });
  }
});

export default router;
