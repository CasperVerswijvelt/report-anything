var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _JSONFileMin_adapter;
import { join, dirname } from "path";
import { Low, TextFile } from "lowdb";
import { fileURLToPath } from "url";
import express from "express";
const PORT = process.env.PORT || 3000;
// Use JSON file for storage
export class JSONFileMin {
    constructor(filename) {
        _JSONFileMin_adapter.set(this, void 0);
        __classPrivateFieldSet(this, _JSONFileMin_adapter, new TextFile(filename), "f");
    }
    async read() {
        const data = await __classPrivateFieldGet(this, _JSONFileMin_adapter, "f").read();
        if (data === null) {
            return null;
        }
        else {
            return JSON.parse(data);
        }
    }
    write(obj) {
        return __classPrivateFieldGet(this, _JSONFileMin_adapter, "f").write(JSON.stringify(obj)); // <- minified JSON
    }
}
_JSONFileMin_adapter = new WeakMap();
const staticFile = join(dirname(fileURLToPath(import.meta.url)), "../data/static.json");
const staticAdapter = new JSONFileMin(staticFile);
const staticDb = new Low(staticAdapter);
const dynamicFile = join(dirname(fileURLToPath(import.meta.url)), "../data/dynamic.json");
const dynamicAdapter = new JSONFileMin(dynamicFile);
const dynamicDb = new Low(dynamicAdapter);
// Read data from JSON file, this will set db.data content
await staticDb.read();
await dynamicDb.read();
if (!staticDb.data) {
    staticDb.data = { static: {} };
    staticDb.write();
}
if (!dynamicDb.data) {
    dynamicDb.data = { dynamic: [] };
    dynamicDb.write();
}
// Schedule db writes every 5 minutes
const writeDb = async () => {
    if (true) {
        console.log("Writing static db ...");
        try {
            await staticDb.write();
        }
        catch (e) {
            console.log(`Error writing static db: ${e}`);
        }
    }
    if (true) {
        console.log("Writing dynamic db ...");
        try {
            await dynamicDb.write();
        }
        catch (e) {
            console.log(`Error writing dynamic db: ${e}`);
        }
    }
    shouldSaveStatic = false;
    shouldSaveDynamic = false;
};
setInterval(writeDb, 10000);
const lastTextId = Object.keys(staticDb.data.static).pop();
let lastId = lastTextId && parseInt(lastTextId) || 0;
let shouldSaveStatic = false;
let shouldSaveDynamic = false;
const app = express();
app.use(express.json());
app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});
app.post("/api/report", async (req, res) => {
    if (!req.body.static || !req.body.static.uuid) {
        return res.status(400).send("Must contain  static data with at least a unique identifier (uuid)");
    }
    const existingStaticElementId = Object.keys(staticDb.data.static)
        .find(key => { var _a; return ((_a = staticDb.data.static[key]) === null || _a === void 0 ? void 0 : _a.uuid) === req.body.static.uuid; });
    const id = existingStaticElementId && parseInt(existingStaticElementId) || ++lastId;
    staticDb.data.static[id] = Object.assign(Object.assign({}, staticDb.data.static[id]), req.body.static);
    shouldSaveStatic = true;
    console.log(`Logged data for id ${id}`);
    if (req.body.dynamic) {
        dynamicDb.data.dynamic.push(Object.assign({ timestamp: Date.now(), id: id }, req.body.dynamic));
        shouldSaveDynamic = true;
    }
    res.sendStatus(200);
});
app.get("/api/reports", async (req, res) => {
    // Query param
    const querySince = parseInt(req.query.since);
    // Raw data
    const reports = dynamicDb.data.dynamic;
    const staticData = staticDb.data.static;
    // Unique id's since given "since" query parameter, fallback to 3 days back
    const current = Date.now();
    const since = querySince ? querySince : current - 3 * 24 * 60 * 60 * 1000;
    const filtered = {};
    const length = reports.length;
    for (let i = length - 1; i > 0; i--) {
        const report = reports[i];
        if (report.timestamp >= since) {
            if (!filtered[report.id])
                filtered[report.id] = report;
        }
        else {
            break;
        }
    }
    const filteredValues = Object.values(filtered);
    // Generate report data
    const processed = {};
    filteredValues.forEach((el) => {
        // Merge static and dynamic data
        const mergedEl = Object.assign(Object.assign({}, el), staticData[el.id]);
        // Loop over properties
        Object.entries(mergedEl).forEach(([key, value]) => {
            var _a;
            // Ignore "uuid" (unique identifier in static data),
            //  "id" (link dynamic to static data) and
            //  "timestamp" (only used for time filtering)
            switch (key) {
                case "uuid":
                case "id":
                case "timestamp":
                    return;
            }
            const valueCounter = (_a = processed[key]) !== null && _a !== void 0 ? _a : {};
            if (typeof value === "object") {
                // Property that can have combination of multiple values
                Object.entries(value).forEach(([innerValue, isActive]) => {
                    if (isActive) {
                        if (typeof valueCounter[innerValue] === "undefined")
                            valueCounter[innerValue] = 0;
                        valueCounter[innerValue]++;
                    }
                });
            }
            else {
                // Property that can only have single value
                if (typeof valueCounter[value] === "undefined")
                    valueCounter[value] = 0;
                valueCounter[value]++;
            }
            processed[key] = valueCounter;
        });
    });
    res.send({
        total: filteredValues.length,
        properties: processed
    });
});
// Serve static webpage
app.use('/', express.static(join(dirname(fileURLToPath(import.meta.url)), "../public")));
// Start listening for requests
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
process.on('SIGINT', async () => {
    console.log('Received SIGINT');
    await writeDb();
    process.exit();
});
