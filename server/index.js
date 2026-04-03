const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const uploadPredict = upload.fields([
  { name: "scan", maxCount: 1 },
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

app.post("/api/predict", uploadPredict, (req, res) => {
  try {
    const classificationMode = req.body.classificationMode;
    if (classificationMode !== "binary" && classificationMode !== "multiclass") {
      return res.status(400).json({ error: "classificationMode must be binary or multiclass" });
    }
    const scan = req.files?.scan?.[0];
    const metaFile = req.files?.metadata?.[0];
    if (!scan) {
      return res.status(400).json({ error: "No scan uploaded (field name: scan)" });
    }
    const preprocessing = {
      status: "completed",
      message:
        "Pseudo: your backend should run skull strip, normalization, resize → .npy here.",
    };
    const result = pseudoPredict(
      classificationMode,
      { originalname: scan.originalname, size: scan.size },
      metaFile
    );
    res.json({
      ok: true,
      input: {
        filename: scan.originalname,
        bytes: scan.size,
        classificationMode,
        metadataFilename: metaFile ? metaFile.originalname : null,
      },
      preprocessing,
      result,
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
