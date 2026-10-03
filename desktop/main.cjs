const { app, BrowserWindow, shell } = require("electron");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const backendUrl = process.env.WEB_OSU_MANIA_API_URL || "https://webosumania.com";
const localPort = 38291;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function getWebRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.resolve(__dirname, "../dist/client");
}

function sendJson(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: message }));
}

async function handleRequest(request, response, webRoot) {
  const requestUrl = new URL(request.url, "http://127.0.0.1");

  if (requestUrl.pathname.startsWith("/api/")) {
    if (request.method !== "GET") {
      sendJson(response, 405, "Method not allowed");
      return;
    }

    try {
      const upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, backendUrl);
      const upstream = await fetch(upstreamUrl, {
        headers: { Accept: request.headers.accept || "*/*" },
        signal: AbortSignal.timeout(30000),
      });
      const headers = {};
      for (const name of ["cache-control", "content-type", "retry-after"]) {
        const value = upstream.headers.get(name);
        if (value) headers[name] = value;
      }
      response.writeHead(upstream.status, headers);
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      sendJson(response, 503, "Offline: connect to the internet to search or download beatmaps.");
    }
    return;
  }

  let requestedPath;
  try {
    requestedPath = decodeURIComponent(requestUrl.pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const filePath = path.resolve(webRoot, `.${requestedPath}`);
  if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    const resolvedFile = stats.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const content = await fs.readFile(resolvedFile);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(resolvedFile)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
  } catch {
    try {
      const content = await fs.readFile(path.join(webRoot, "index.html"));
      response.writeHead(200, { "Content-Type": mimeTypes[".html"] });
      response.end(content);
    } catch {
      sendJson(response, 500, "The standalone web build is missing. Rebuild the desktop app.");
    }
  }
}

async function createWindow() {
  const webRoot = getWebRoot();
  const server = http.createServer((request, response) => {
    void handleRequest(request, response, webRoot);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(localPort, "127.0.0.1", resolve);
  });

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 920,
    minHeight: 640,
    title: "Web osu!mania",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
  window.on("closed", () => server.close());
  await window.loadURL(`http://127.0.0.1:${localPort}/`);
}

const hasSingleInstance = app.requestSingleInstanceLock();
if (!hasSingleInstance) {
  app.quit();
} else {
  app.whenReady().then(createWindow).catch((error) => {
  console.error(error);
  app.quit();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
