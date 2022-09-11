import { join, dirname } from "path";
import { Low, JSONFile } from "lowdb";
import { fileURLToPath } from "url";
import express from "express";

const PORT = process.env.PORT || 3000;

// Use JSON file for storage
const file = join(dirname(fileURLToPath(import.meta.url)), "db.json");
const adapter = new JSONFile(file);
const db = new Low(adapter);

// Read data from JSON file, this will set db.data content
await db.read();

// If file.json doesn't exist, db.data will be null
// Set default data
// db.data = db.data || { posts: [] } // Node < v15.x
db.data ||= { reports: [] }; // Node >= 15.x

// Finally write db.data content to file
await db.write();

const app = express();
app.use(express.json());

app.post("/report", async (req, res) => {
  try {
    db.data.reports.push({
      timestamp: Date.now(),
      ...req.body,
    });
    await db.write();

    res.sendStatus("200");
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
});

app.get("/reports", async (req, res) => {

    const reports = db.data.reports
    const data = [...reports.reduce((a,c)=>{
        a.set(c.installId, c);
        return a;
      }, new Map()).values()];
      res.send({
        distribution: {
            fdroid: data.filter(el => el.distribution === "fdroid").length,
            playstore: data.filter(el => el.distribution === "playstore").length,
            github: data.filter(el => el.distribution === "github").length,
        }
      })
  });

// Start listening for requests

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
