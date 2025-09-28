// server.js
import express from "express";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 80; // use 4000 by default
const scriptDir = path.join(process.cwd(), "script");

// Helper: simple UA test for browser
function isBrowserUA(ua) {
  if (!ua) return false;
  return /chrome|firefox|safari|opera|edg/i.test(ua);
}

// Helper: escape HTML
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// HTML page template that displays code inside a styled card/scrollframe.
// Uses inline CSS so no external deps are required.
function renderCodePage({ requestPath, port, fileName, fileContents }) {
  const fileEscaped = escapeHtml(fileContents);
  const loadstringSnippet = `loadstring(game:HttpGet("https://kuronami-hub.onrender.com${requestPath}"))()`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Source Locker — ${escapeHtml(fileName)}</title>
<style>
  :root{--bg1:#041226;--bg2:#071430;--bg3:#04192a;--card-from:#061830;--card-to:#031428}
  html,body{height:100%}
  body{
    margin:0;
    min-height:100%;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:24px;
    background:linear-gradient(180deg,var(--bg1),var(--bg2),var(--bg3));
    color:#e6eef8;
    font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial;
  }
  .wrap{width:100%;max-width:920px;display:flex;justify-content:center}
  .card{
    width:100%;
    max-width:720px;
    background:linear-gradient(180deg, rgba(6,24,48,0.95), rgba(3,20,40,0.90));
    border:1px solid rgba(15,23,42,0.7);
    box-shadow:0 10px 30px rgba(2,8,20,0.7);
    border-radius:12px;
    padding:20px;
  }
  .card-header{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
  .title{font-weight:700;font-size:18px}
  .desc{color:#9fb0c8;font-size:13px}
  .notice{margin-top:6px;color:#fca5a5;font-weight:600;text-align:center}
  .code-wrap{
    margin-top:12px;
    background:transparent;
    border-radius:8px;
    overflow:auto;
    padding:12px;
    border:1px solid rgba(80,120,160,0.06);
    max-height:420px;
  }
  pre{
    margin:0;
    font-family: Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace;
    font-size:14px;
    line-height:1.5;
    color:#d6deeb;
    white-space:pre;
    tab-size:4;
  }
  .snippet{
    margin-top:12px;
    background:rgba(10,20,36,0.6);
    padding:10px 12px;
    border-radius:8px;
    font-family: Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace;
    color:#a8d0ff;
    font-size:13px;
    overflow-wrap:anywhere;
  }
  .muted { color: #9fb0c8; font-size:13px; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card" role="main">
      <div class="card-header">
        <div class="title">Kuronami Hub</div>
      </div>

      <div class="muted">Source Locker.</div>

      <div class="snippet">${escapeHtml(loadstringSnippet)}</div>
    </div>
  </div>
</body>
</html>`;
}

// Middleware: intercept browser requests to /script/* and render the code viewer
app.use(async (req, res, next) => {
  try {
    const ua = req.get("User-Agent") || "";
    const isBrowser = isBrowserUA(ua);

    // Only intercept requests that target the /script/ path and are browsers
    if (isBrowser && req.path.startsWith("/script/")) {
      // map the requested path to actual file under scriptDir
      // e.g., /script/library.lua -> script/library.lua
      const relPath = req.path.replace(/^\/script\//, ""); // library.lua or sub/whatever.lua
      const absPath = path.join(scriptDir, relPath);

      // disallow directory traversal attempts
      if (!absPath.startsWith(scriptDir)) {
        return res.status(400).send("Bad request");
      }

      // if file doesn't exist, show 404-like page
      if (!fs.existsSync(absPath) || fs.statSync(absPath).isDirectory()) {
        const notFoundHtml = `<!doctype html><html><body style="background:#071430;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;"><div style="text-align:center"><h2>Not found</h2><p style="color:#9fb0c8">The requested script was not found.</p></div></body></html>`;
        return res.status(404).send(notFoundHtml);
      }

      const fileContents = fs.readFileSync(absPath, "utf8");
      const html = renderCodePage({
        requestPath: req.path,
        port: PORT,
        fileName: relPath,
        fileContents,
      });
      res.status(200).set("Content-Type", "text/html; charset=utf-8").send(html);
      return;
    }

    // If it's a browser but not /script, block (or you could optionally show other page)
    if (isBrowser) {
      // default block page for other paths
      const blocked = `<!doctype html><html><body style="background:linear-gradient(180deg,#041226,#071430,#04192a);color:#e6eef8;font-family:Inter,system-ui,Arial, sans-serif;display:flex;align-items:center;justify-content:center;height:100vh"><div style="max-width:560px;text-align:center;padding:24px;border-radius:12px;background:rgba(3,20,40,0.88);border:1px solid rgba(15,23,42,0.7);box-shadow:0 8px 30px rgba(2,8,20,0.7)"><h2 style="margin:0 0 8px">Access Denied</h2><p style="margin:0;color:#9fb0c8">You might get blacklisted if ur still trying to see our code.</p></div></body></html>`;
      return res.status(403).set("Content-Type", "text/html; charset=utf-8").send(blocked);
    }

    // Not a browser -> continue to static file serving (or other handlers)
    next();
  } catch (err) {
    console.error("Middleware error:", err);
    next();
  }
});

// Serve static files for non-browser clients (raw .lua)
app.use("/script", express.static(scriptDir, {
  // optional: set correct headers for text
  setHeaders(res, filePath) {
    if (filePath.endsWith(".lua")) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
  },
}));

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/script/library.lua`);
  console.log(`Browser-friendly viewer available (but raw file still served to non-browser clients).`);
});
