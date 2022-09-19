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
const writeDb = async () => {
  if (shouldSaveStatic) {
    console.log("Writing static db ...")
    try {
      await staticDb.write()
    } catch (e) {
      console.log(`Error writing static db: ${e}`)
    }
  }
  if (shouldSaveDynamic) {
    console.log("Writing dynamic db ...")
    try {
      await dynamicDb.write()
    } catch (e) {
      console.log(`Error writing dynamic db: ${e}`)
    }
  }

  shouldSaveStatic = false
  shouldSaveDynamic = false
}
setInterval(writeDb, 300000)

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

app.get("/api/reports", async (req, res) => {

  // Query param
  const querySince = parseInt(req.query.since)

  // Raw data
  const reports = dynamicDb.data.dynamic
  const staticData = staticDb.data.static

  // Unique id's since given "since" query parameter, fallback to 3 days back
  const since = querySince ?? current - 3 * 24 * 60 * 60 * 1000
  const current = Date.now()
  const filtered = [...reports.reduce((a, c) => {
    if (c.timestamp >= since) {
      a.set(c.id, c);
    }
    return a;
  }, new Map()).values()];

  // Generate report data
  const processed = {}
  filtered.forEach((el) => {

    // Merge static and dynamic data
    const mergedEl = {
      ...el,
      ...staticData[el.id]
    }

    // Loop over properties
    Object.entries(mergedEl).forEach(([key, value]) => {

      // Ignore "uuid" (unique identifier in static data),
      //  "id" (link dynamic to static data) and
      //  "timestamp" (only used for time filtering)
      switch (key) {
        case "uuid":
        case "id":
        case "timestamp":
          return
      }

      const valueCounter = processed[key] ?? {}
      if (typeof value === "object") {
        // Property that can have combination of multiple values
        Object.entries(value).forEach(([innerValue, isActive]) => {
          if (isActive) {
            if (typeof valueCounter[innerValue] === "undefined") valueCounter[innerValue] = 0
            valueCounter[innerValue]++
          }
        })
      } else {
        // Property that can only have single value
        if (typeof valueCounter[value] === "undefined") valueCounter[value] = 0
        valueCounter[value]++
      }
      processed[key] = valueCounter
    })
  })
  res.send({
    total: filtered.length,
    properties: processed
  })
});

// Serve static webpage
app.use('/', express.static(join(dirname(fileURLToPath(import.meta.url)), "public")))

// Start listening for requests
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT')
  await writeDb()
  process.exit()
});
