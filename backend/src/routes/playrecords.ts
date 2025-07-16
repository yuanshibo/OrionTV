import express, { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";

const router = express.Router();
const dataPath = path.join(__dirname, "..", "data", "playrecords.json");

// Helper function to read data
const readPlayRecords = async () => {
  try {
    const data = await fs.readFile(dataPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
};

// Helper function to write data
const writePlayRecords = async (data: any) => {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), "utf-8");
};

// GET /api/playrecords
router.get("/playrecords", async (req: Request, res: Response) => {
  const records = await readPlayRecords();
  res.json(records);
});

// POST /api/playrecords
router.post("/playrecords", async (req: Request, res: Response) => {
  const { key, record } = req.body;

  if (!key || !record) {
    return res.status(400).json({ message: "Missing key or record data" });
  }

  const records = await readPlayRecords();
  records[key] = { ...record, time: Math.floor(Date.now() / 1000) };
  await writePlayRecords(records);

  res.json({ success: true });
});

// DELETE /api/playrecords
router.delete("/playrecords", async (req: Request, res: Response) => {
  const { key } = req.query;
  let records = await readPlayRecords();

  if (key) {
    delete records[key as string];
  } else {
    records = {};
  }

  await writePlayRecords(records);
  res.json({ success: true });
});

export default router;
