import express, { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();
const dataPath = path.join(__dirname, "..", "data", "favorites.json");

// Helper function to read data
const readFavorites = async () => {
  try {
    const data = await fs.readFile(dataPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or is invalid json, return empty object
    return {};
  }
};

// Helper function to write data
const writeFavorites = async (data: any) => {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), "utf-8");
};

// GET /api/favorites
router.get("/favorites", async (req: Request, res: Response) => {
  const { key } = req.query;
  const favorites = await readFavorites();

  if (key) {
    res.json(favorites[key as string] || null);
  } else {
    res.json(favorites);
  }
});

// POST /api/favorites
router.post("/favorites", async (req: Request, res: Response) => {
  const { key, favorite } = req.body;

  if (!key || !favorite) {
    return res.status(400).json({ message: "Missing key or favorite data" });
  }

  const favorites = await readFavorites();
  favorites[key] = { ...favorite, save_time: Math.floor(Date.now() / 1000) };
  await writeFavorites(favorites);

  res.json({ success: true });
});

// DELETE /api/favorites
router.delete("/favorites", async (req: Request, res: Response) => {
  const { key } = req.query;
  let favorites = await readFavorites();

  if (key) {
    delete favorites[key as string];
  } else {
    // Clear all favorites if no key is provided
    favorites = {};
  }

  await writeFavorites(favorites);
  res.json({ success: true });
});

export default router;
