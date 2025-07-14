import express, { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const username = process.env.USERNAME;
const password = process.env.PASSWORD;

/**
 * @api {post} /api/login User Login
 * @apiName UserLogin
 * @apiGroup User
 *
 * @apiBody {String} username User's username.
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
  const { username: inputUsername, password: inputPassword } = req.body;

  // Compatibility with old versions, if username is not set, only password is required
  if (!username || !password) {
    if (inputPassword === password) {
      res.cookie("auth", "true", { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
      return res.json({ ok: true });
    } else if (!password) {
      // If no password is set, login is always successful.
      return res.json({ ok: true });
    } else {
      return res.status(400).json({ message: "Invalid password" });
    }
  }

  if (inputUsername === username && inputPassword === password) {
    res.cookie("auth", "true", { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ ok: true });
  } else {
    res.status(400).json({ message: "Invalid username or password" });
  }
});

export default router;
