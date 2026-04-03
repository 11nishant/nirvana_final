const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const os = require("os");
const { exec } = require("child_process");
const fsPromises = require("fs").promises;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const uploadPredict = upload.fields([
  { name: "scans", maxCount: 100 },
  { name: "metadata", maxCount: 1 },
]);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const clientDist = path.join(__dirname, "..", "client", "dist");
const hasClientBuild = fs.existsSync(path.join(clientDist, "index.html"));

/**
 * Task 4 contract: binary = CN vs AD; multiclass = CN vs MCI vs AD.
 * Replace with real preprocessing + model when your backend is ready.
 */
function pseudoPredict(classificationMode, fileMeta, metaFile) {
  const seed =
    (fileMeta?.originalname || "mock").length +
    classificationMode.length +
    (metaFile?.originalname?.length || 0);
  if (classificationMode === "binary") {
    const ad = seed % 2 === 0;
    const label = ad ? "Alzheimer's Disease (AD)" : "Cognitively Normal (CN)";
    return {
      mode: "binary",
      predictedClass: ad ? "AD" : "CN",
      label,
      confidence: 0.75 + (seed % 20) / 100,
      note: "Pseudo screening result — connect your Task 2 model output here.",
    };
  }
  const classes = ["CN", "MCI", "AD"];
  const idx = seed % classes.length;
  const raw = classes.map((_, i) =>
    i === idx ? 0.42 + (seed % 18) / 100 : 0.12 + ((seed + i * 7) % 12) / 100
  );
  const sum = raw.reduce((a, b) => a + b, 0);
  const probs = {};
  classes.forEach((c, i) => {
    probs[c] = raw[i] / sum;
  });
  const predictedClass = classes[idx];
  const labels = {
    CN: "Cognitively Normal (CN)",
    MCI: "Mild Cognitive Impairment (MCI)",
    AD: "Alzheimer's Disease (AD)",
  };
  return {
    mode: "multiclass",
    predictedClass,
    label: labels[predictedClass],
    classProbabilities: probs,
    note: "Pseudo screening result — connect your Task 3 model output here.",
  };
}

app.post("/api/predict", uploadPredict, async (req, res) => {
  try {
    const classificationMode = req.body.classificationMode;
    if (classificationMode !== "binary" && classificationMode !== "multiclass") {
      return res.status(400).json({ error: "classificationMode must be binary or multiclass" });
    }
    const scans = req.files?.scans;
    const metaFile = req.files?.metadata?.[0];
    if (!scans || scans.length === 0) {
      return res.status(400).json({ error: "No scans uploaded (field name: scans)" });
    }
    if (!metaFile) {
      return res.status(400).json({ error: "No metadata uploaded (field name: metadata)" });
    }

    // create temp dirs
    const tempDir = os.tmpdir();
    const dataPath = path.join(tempDir, `data_${Date.now()}`);
    const csvPath = path.join(tempDir, `meta_${Date.now()}.csv`);
    const outputPath = path.join(tempDir, `output_${Date.now()}`);

    await fsPromises.mkdir(dataPath, { recursive: true });
    await fsPromises.mkdir(outputPath, { recursive: true });

    // save scans
    for (const scan of scans) {
      const filePath = path.join(dataPath, scan.originalname);
      await fsPromises.writeFile(filePath, scan.buffer);
    }

    // save metadata
    await fsPromises.writeFile(csvPath, metaFile.buffer);

    // run python script
    const pythonCmd = `python "${path.join(__dirname, 'preprocess.py')}" "${dataPath}" "${csvPath}" "${outputPath}"`;
    exec(pythonCmd, async (error, stdout, stderr) => {
      if (error) {
        console.error('Preprocessing error:', error);
        console.error('stderr:', stderr);
        return res.status(500).json({ error: "Preprocessing failed", details: stderr });
      }
      console.log('Preprocessing stdout:', stdout);

      // now, the .npy are in outputPath
      const preprocessing = {
        status: "completed",
        message: "Preprocessing completed, .npy generated",
        outputPath,
      };
      const result = pseudoPredict(
        classificationMode,
        { originalname: 'processed', size: 0 },
        metaFile
      );
      res.json({
        ok: true,
        input: {
          filenames: scans.map(s => s.originalname),
          bytes: scans.reduce((sum, s) => sum + s.size, 0),
          classificationMode,
          metadataFilename: metaFile.originalname,
        },
        preprocessing,
        result,
      });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Prediction failed" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

if (hasClientBuild) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}${hasClientBuild ? " (serving client dist)" : " (API only — run Vite for UI in dev)"}`);
});
