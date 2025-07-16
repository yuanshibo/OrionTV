import express, { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();
const dataPath = path.join(__dirname, "..", "data", "searchhistory.json");

// Helper function to read data
const readSearchHistory = async (): Promise<string[]> => {
  try {
    const data = await fs.readFile(dataPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
};

// Helper function to write data
const writeSearchHistory = async (data: string[]) => {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), "utf-8");
};

// GET /api/searchhistory
router.get("/searchhistory", async (req: Request, res: Response) => {
  const history = await readSearchHistory();
  res.json(history);
});

// POST /api/searchhistory
router.post("/searchhistory", async (req: Request, res: Response) => {
  const { keyword } = req.body;

  if (!keyword) {
    return res.status(400).json({ message: "Missing keyword" });
  }

  let history = await readSearchHistory();
  // Remove keyword if it already exists to move it to the front
  history = history.filter((item) => item !== keyword);
  // Add to the beginning of the array
  history.unshift(keyword);
  // Optional: Limit history size
  if (history.length > 100) {
    history = history.slice(0, 100);
  }

  await writeSearchHistory(history);
  res.json(history);
});

// DELETE /api/searchhistory
router.delete("/searchhistory", async (req: Request, res: Response) => {
  const { keyword } = req.query;
  let history = await readSearchHistory();

  if (keyword) {
    history = history.filter((item) => item !== keyword);
  } else {
    history = [];
  }

  await writeSearchHistory(history);
  res.json({ success: true });
});

export default router;
