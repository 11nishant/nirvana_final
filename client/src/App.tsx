import { useState } from "react";

type Mode = "binary" | "multiclass";

type ApiOk = {
  ok: true;
  input: {
    filename: string;
    bytes: number;
    classificationMode: Mode;
    metadataFilename: string | null;
  };
  preprocessing: { status: string; message: string };
  result:
    | {
        mode: "binary";
        predictedClass: "CN" | "AD";
        label: string;
        confidence: number;
        note: string;
      }
    | {
        mode: "multiclass";
        predictedClass: "CN" | "MCI" | "AD";
        label: string;
        classProbabilities: Record<string, number>;
        note: string;
      };
};

export default function App() {
  const [mode, setMode] = useState<Mode>("binary");
  const [file, setFile] = useState<File | null>(null);
  const [metadataFile, setMetadataFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiOk | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setData(null);
    if (!file) {
      setError("Upload a T1-weighted MRI scan (NIfTI, DICOM folder/zip, etc. — per problem statement).");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("scan", file);
      fd.append("classificationMode", mode);
      if (metadataFile) fd.append("metadata", metadataFile);
      const res = await fetch("/api/predict", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || res.statusText);
        return;
      }
      setData(json as ApiOk);
    } catch {
      setError("Network error — is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <p className="eyebrow">Nirvana 2026 · PeaceOfCode · Track 2</p>
        <h1>Neurological screening</h1>
        <p className="subtitle">
          T1-weighted MRI upload, preprocessing, and AI-assisted classification for early detection
          (Task 4 — connect your trained models when ready).
        </p>
      </header>

      <main className="card">
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span className="label">Classification mode</span>
            <div className="modes">
              <label className="radio">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "binary"}
                  onChange={() => setMode("binary")}
                />
                Binary — CN vs AD
              </label>
              <label className="radio">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "multiclass"}
                  onChange={() => setMode("multiclass")}
                />
                Multi-class — CN vs MCI vs AD
              </label>
            </div>
          </label>

          <label className="field">
            <span className="label">T1-weighted MRI scan</span>
            <input
              type="file"
              accept=".dcm,.zip,.nii,.gz,.npy,image/*,*/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="filehint">{file.name}</p>}
          </label>

          <label className="field">
            <span className="label">Optional subject metadata (CSV)</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setMetadataFile(e.target.files?.[0] ?? null)}
            />
            {metadataFile && <p className="filehint">{metadataFile.name}</p>}
            <p className="hint">Link clinical labels or subject IDs when your pipeline expects them.</p>
          </label>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Preprocessing & predicting…" : "Run screening"}
          </button>
        </form>

        {error && <div className="banner error">{error}</div>}

        {data && (
          <section className="results" aria-live="polite">
            <h2>Screening result</h2>
            <dl className="dl">
              <div>
                <dt>Scan</dt>
                <dd>{data.input.filename}</dd>
              </div>
              {data.input.metadataFilename && (
                <div>
                  <dt>Metadata</dt>
                  <dd>{data.input.metadataFilename}</dd>
                </div>
              )}
              <div>
                <dt>Mode</dt>
                <dd>
                  {data.input.classificationMode === "binary"
                    ? "Binary (CN vs AD)"
                    : "Multi-class (CN vs MCI vs AD)"}
                </dd>
              </div>
            </dl>

            <div className="prep">
              <strong>Preprocessing</strong>
              <span className="prep-badge">{data.preprocessing.status}</span>
              <p className="prep-msg">{data.preprocessing.message}</p>
            </div>

            {data.result.mode === "binary" && (
              <div className="result-block">
                <p className="prediction">{data.result.label}</p>
                <p className="confidence">
                  Confidence: {(data.result.confidence * 100).toFixed(1)}%
                </p>
                <div
                  className="bar"
                  role="img"
                  aria-label={`Confidence ${(data.result.confidence * 100).toFixed(0)} percent`}
                >
                  <span style={{ width: `${data.result.confidence * 100}%` }} />
                </div>
                <p className="note">{data.result.note}</p>
              </div>
            )}

            {data.result.mode === "multiclass" && (
              <div className="result-block">
                <p className="prediction">{data.result.label}</p>
                <ul className="probs">
                  {Object.entries(data.result.classProbabilities)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <li key={k}>
                        <span>{k}</span>
                        <span className="prob-row">
                          <span className="prob-pct">{(v * 100).toFixed(1)}%</span>
                          <span className="prob-bar-wrap">
                            <span className="prob-bar" style={{ width: `${v * 100}%` }} />
                          </span>
                        </span>
                      </li>
                    ))}
                </ul>
                <p className="note">{data.result.note}</p>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        API: <code>POST /api/predict</code> (fields <code>scan</code>, optional <code>metadata</code>,{" "}
        <code>classificationMode</code>). Replace <code>pseudoPredict</code> in <code>server/index.js</code>{" "}
        with your preprocessing + Task 2/3 models.
      </footer>
    </div>
  );
}
