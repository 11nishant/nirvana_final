const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const api = spawn(process.execPath, [path.join(__dirname, "index.js")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PORT: "3000" },
});
const ui = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "dev"],
  {
    cwd: path.join(root, "client"),
    stdio: "inherit",
    shell: true,
  }
);

function shutdown() {
  api.kill();
  ui.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
