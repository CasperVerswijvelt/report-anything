import { join, dirname } from "path";
import { Low, JSONFile } from "lowdb";
import { fileURLToPath } from "url";
import express from "express";

const PORT = process.env.PORT || 3000;

// Use JSON file for storage
const staticFile = join(dirname(fileURLToPath(import.meta.url)), "data/static.json");
const staticAdapter = new JSONFile(staticFile);
const staticDb = new Low(staticAdapter);
const dynamicFile = join(dirname(fileURLToPath(import.meta.url)), "data/dynamic.json");
const dynamicAdapter = new JSONFile(dynamicFile);
const dynamicDb = new Low(dynamicAdapter);

// Read data from JSON file, this will set db.data content
await staticDb.read();
await dynamicDb.read();

if (!staticDb.data) {
  staticDb.data = { static: {} };
  staticDb.write()
}
if (!dynamicDb.data) {
  dynamicDb.data = { dynamic: [] };
  dynamicDb.write()
}

// Schedule db writes every 5 minutes
setInterval(async () => {
  if (shouldSaveStatic) {
    console.log("Writing static db ...")
    try {
      await staticDb.write()
    } catch(e) {
      console.log(`Error wrigint static db: ${e}`)
    }
  }
  if (shouldSaveDynamic) {
    console.log("Writing dynamic db ...")
    try {
      await dynamicDb.write()
    } catch(e) {
      console.log(`Error wrigint dynamic db: ${e}`)
    }
  }

  shouldSaveStatic = false
  shouldSaveDynamic = false
}, 300000)

let lastId = Object.keys(staticDb.data.static).pop() || 0
let shouldSaveStatic = false
let shouldSaveDynamic = false

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

app.post("/api/report", async (req, res) => {

  if (!req.body.static || !req.body.static.uuid) {

    return res.status(400).send("Must contain  static data with at least a unique identifier (uuid)")
  }

  const existingStaticElementId = Object.keys(staticDb.data.static)
    .find(key => staticDb.data.static[key]?.uuid === req.body.static.uuid)
  const id = parseInt(existingStaticElementId) || ++lastId
  staticDb.data.static[id] = {
    ...staticDb.data.static[existingStaticElementId],
    ...req.body.static
  }

  shouldSaveStatic = true

  console.log(`Logged data for id ${id}`)

  if (req.body.dynamic) {
    dynamicDb.data.dynamic.push({
      timestamp: Date.now(),
      id: id,
      ...req.body.dynamic,
    });

    shouldSaveDynamic = true
  }
  res.sendStatus("200");
});

app.get("/api/reports", async (_req, res) => {

  // Raw data
  const reports = dynamicDb.data.dynamic
  const staticData = staticDb.data.static

  // Unique id's for last 3 days
  const daysBack = 3
  const current = Date.now()
  const filtered = [...reports.reduce((a, c) => {
    if ((current - c.timestamp) < daysBack * 24 * 60 * 60 * 1000) {
      a.set(c.id, c);
    }
    return a;
  }, new Map()).values()];

  // Generate report data
  const processed = {}
  filtered.forEach((el) => {

    const mergedEl = {
      ...el,
      ...staticData[el.id]
    }
    for (const [key, value] of Object.entries(mergedEl)) {

      switch (key) {
        case "uuid":
        case "id":
        case "timestamp":
          continue
      }

      const keyCounter = processed[key] ?? {}
      if (typeof keyCounter[value] === "undefined") keyCounter[value] = 0
      keyCounter[value]++
      processed[key] = keyCounter
    }
  })
  res.send({
    total: filtered.length,
    properties: processed
  })
});

app.use('/', express.static(join(dirname(fileURLToPath(import.meta.url)), "public")))

// Start listening for requests

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
