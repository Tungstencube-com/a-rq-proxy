const http = require("node:http");
const fs = require("node:fs");
const mime = require("node:path").extname;
const path = require("node:path");
const { server: wisp } = require("@mercuryworkshop/wisp-js/server");

const port = Number(process.env.PORT || 3000);
const root = path.join(__dirname, "templates/html/2.0.67-alpha.1");
const sourcesRoot = path.join(root, "games/sources");
const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".wasm": "application/wasm",
    ".swf": "application/x-shockwave-flash",
    ".json": "application/json; charset=utf-8"
};
const appRoutes = new Set(["/", "/games", "/apps", "/settings"]);
const catalogRoutes = new Set(["/api/games"]);
const gamePlayerRoute = "/play/game";

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function prepareGameHtml(source) {
    let html = source
        .replace(/<title[^>]*>[\s\S]*?<\/title>/i, "<title>RAPTOR Games</title>")
        .replace(/\s*<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi, "")
        .replace(/src=["']\/js\/all\.js["']/g, 'src="/games/sources/selenite-old/js/all.js"');

    if (!/<title[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, '$&<title>RAPTOR Games</title>');
    html = html.replace(/<head[^>]*>/i, '$&<link rel="icon" type="image/png" href="/favicon.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">');

    const controls = `<style>
html,body{width:100%;height:100%;min-width:100%;min-height:100%;margin:0;overflow:hidden;background:#000}
body>*:not(.raptor-game-bar){width:100vw!important;min-width:100vw!important;min-height:100vh!important}
#ruffle,#gameContainer,#game-container,ruffle-player,canvas,object,embed,.game-container{display:block;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important}
#ruffle:fullscreen,#gameContainer:fullscreen,#game-container:fullscreen,ruffle-player:fullscreen,canvas:fullscreen,object:fullscreen,embed:fullscreen,.game-container:fullscreen{width:100vw!important;height:100vh!important}
.raptor-game-bar{position:fixed;top:8px;left:8px;right:8px;z-index:2147483647;display:flex;align-items:center;gap:8px;height:40px;padding:6px 10px;border:1px solid rgba(112,255,128,.65);border-radius:10px;background:rgba(7,26,18,.94);box-shadow:0 0 16px rgba(104,222,119,.3);font:14px "Trebuchet MS","Segoe UI",sans-serif}
.raptor-game-title{flex:1;overflow:hidden;color:#d7f4d9;font-weight:700;text-overflow:ellipsis;white-space:nowrap}
.raptor-game-button{min-width:32px;height:28px;border:1px solid rgba(151,255,164,.55);border-radius:7px;background:rgba(66,126,75,.3);color:#d7f4d9;cursor:pointer;font:inherit}
.raptor-game-button .bi{font-size:14px;line-height:1}
.raptor-game-button:hover{border-color:rgba(180,255,190,.9);background:rgba(115,202,126,.4)}
</style><nav class="raptor-game-bar" id="raptorGameBar" aria-label="RAPTOR game controls"><button class="raptor-game-button" id="raptorClose" type="button" title="Close game" aria-label="Close game"><i class="bi bi-x-lg"></i></button><strong class="raptor-game-title">RAPTOR Games</strong><button class="raptor-game-button" id="raptorFullscreen" type="button" title="Fullscreen game" aria-label="Fullscreen game"><i class="bi bi-arrows-fullscreen"></i></button><button class="raptor-game-button" id="raptorDownload" type="button" title="Download HTML game" aria-label="Download HTML game"><i class="bi bi-download"></i></button></nav><script>
document.getElementById("raptorClose").onclick=()=>history.length>1?history.back():location.href="/games";
const raptorBar=document.getElementById("raptorGameBar");
const gameTarget=document.querySelector("#ruffle,#gameContainer,#game-container,ruffle-player,canvas,object,embed,.game-container")||document.body;
let bodyFullscreen=false;
document.getElementById("raptorFullscreen").onclick=async()=>{if(document.fullscreenElement)return;bodyFullscreen=gameTarget===document.body;if(bodyFullscreen)raptorBar.style.display="none";await gameTarget.requestFullscreen();};
document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement){raptorBar.style.display="";bodyFullscreen=false;}});
document.getElementById("raptorDownload").onclick=async()=>{const blob=await(await fetch(location.pathname)).blob();const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=(document.title.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"game")+".html";link.click();URL.revokeObjectURL(link.href);};
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&document.fullscreenElement)document.exitFullscreen();});
</script>`;
    return html.replace(/<body([^>]*)>/i, "$&" + controls);
}

function normalizeTitle(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^(the|game)/, "");
}

function titleFromIndex(indexPath, fallback) {
    try {
        const source = fs.readFileSync(indexPath, "utf8");
        const match = source.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i);
        return match ? match[1].replace(/\s*[|:-].*$/, "").trim() || fallback : fallback;
    } catch {
        return fallback;
    }
}

function findCover(directory) {
    const preferred = /(^|[-_.])(cover|thumb|thumbnail|splash|logo|icon)([-_.]|$)/i;
    const imageExtensions = /\.(png|jpe?g|webp|gif)$/i;
    const candidates = [];

    function collect(current, depth) {
        if (depth > 2) return;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const entryPath = path.join(current, entry.name);
            if (entry.isDirectory()) collect(entryPath, depth + 1);
            else if (imageExtensions.test(entry.name)) candidates.push(entryPath);
        }
    }

    try {
        collect(directory, 0);
    } catch {
        return "";
    }

    const cover = candidates.sort((left, right) => Number(preferred.test(path.basename(right))) - Number(preferred.test(path.basename(left))))[0];
    return cover ? "/" + path.relative(root, cover).split(path.sep).map(encodeURIComponent).join("/") : "";
}

function catalogEntryFromDirectory(directory, source, relativeDirectory, sourcePath = source) {
    const indexPath = path.join(directory, "index.html");
    if (!fs.existsSync(indexPath)) return null;

    const fallback = path.basename(directory).replace(/[-_]+/g, " ").replace(/\b\w/g, character => character.toUpperCase());
    const nestedGameDirectory = path.join(directory, "game");
    const hasNestedGame = fs.existsSync(path.join(nestedGameDirectory, "index.html"));
    const playableDirectory = hasNestedGame ? path.join(relativeDirectory, "game") : relativeDirectory;
    const playableIndex = hasNestedGame ? path.join(nestedGameDirectory, "index.html") : indexPath;
    return {
        name: titleFromIndex(playableIndex, fallback),
        url: "/games/sources/" + sourcePath + "/" + playableDirectory.split(path.sep).map(encodeURIComponent).join("/") + "/",
        image: findCover(directory),
        type: "html",
        source,
        available: true
    };
}

function scanSource(source, sourceRoot, relativeRoot = "", sourcePath = source) {
    const directory = path.join(sourceRoot, relativeRoot);
    let entries;
    try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
        return [];
    }

    return entries
        .filter(entry => entry.isDirectory() && !entry.name.startsWith("."))
        .map(entry => {
            const relativeDirectory = path.join(relativeRoot, entry.name);
            return catalogEntryFromDirectory(path.join(sourceRoot, relativeDirectory), source, relativeDirectory, sourcePath);
        })
        .filter(Boolean);
}

function buildGameCatalog() {
    const entries = [];
    const seen = new Set();

    function add(entry) {
        const key = normalizeTitle(entry.name);
        if (!key || seen.has(key)) return;
        seen.add(key);
        entries.push(entry);
    }

    scanSource("selenite", path.join(sourcesRoot, "selenite-old"), "", "selenite-old").forEach(add);
    scanSource("nate", path.join(sourcesRoot, "nate-games"), path.join("0", "g"), "nate-games").forEach(add);
    return entries;
}

const server = http.createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const requestUrl = new URL(request.url, "http://localhost");

    if (requestPath === gamePlayerRoute) {
        const gamePath = requestUrl.searchParams.get("url") || "";
        const gameName = requestUrl.searchParams.get("name") || "Game";
        const localGamePath = path.resolve(root, "." + gamePath);
        const sourcesPath = path.join(root, "games/sources") + path.sep;

        if (!gamePath.startsWith("/games/sources/") || !localGamePath.startsWith(sourcesPath)) {
            response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Invalid local game path");
            return;
        }

        const safeGamePath = escapeHtml(gamePath);
        const safeGameName = escapeHtml(gameName);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(`<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>RAPTOR Games</title>
    <link rel="icon" type="image/png" href="/favicon.png">
    <style>
        :root { color-scheme: dark; font-family: "Trebuchet MS", "Segoe UI", sans-serif; }
        * { box-sizing: border-box; }
        html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #020b07; }
        .player-shell { display: flex; width: 100%; height: 100%; flex-direction: column; }
        .player-bar { display: flex; flex: 0 0 48px; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid rgba(112, 255, 128, 0.5); background: rgba(7, 26, 18, 0.96); box-shadow: 0 0 16px rgba(104, 222, 119, 0.24); }
        .player-title { flex: 1; min-width: 0; overflow: hidden; color: #d7f4d9; font-size: 14px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
        .player-button { display: inline-flex; min-width: 34px; height: 32px; align-items: center; justify-content: center; border: 1px solid rgba(151, 255, 164, 0.5); border-radius: 8px; background: rgba(66, 126, 75, 0.28); color: #d7f4d9; cursor: pointer; font: inherit; }
        .player-button:hover { border-color: rgba(180, 255, 190, 0.9); background: rgba(115, 202, 126, 0.35); }
        .player-frame { width: 100%; flex: 1; min-height: 0; border: 0; background: #000; }
    </style>
</head>
<body>
    <main class="player-shell" id="playerShell">
        <nav class="player-bar" aria-label="Game controls">
            <button class="player-button" id="closeButton" type="button" title="Close game" aria-label="Close game">×</button>
            <strong class="player-title">${safeGameName}</strong>
            <button class="player-button" id="fullscreenButton" type="button" title="Fullscreen" aria-label="Fullscreen">⛶</button>
            <button class="player-button" id="downloadButton" type="button" title="Download HTML game" aria-label="Download HTML game">↓</button>
        </nav>
        <iframe class="player-frame" id="gameFrame" title="${safeGameName}" src="${safeGamePath}" allow="fullscreen"></iframe>
    </main>
    <script>
        const gameFrame = document.getElementById("gameFrame");
        const playerShell = document.getElementById("playerShell");
        document.getElementById("closeButton").addEventListener("click", () => {
            if (history.length > 1) history.back();
            else location.href = "/games";
        });
        document.getElementById("fullscreenButton").addEventListener("click", async () => {
            const target = gameFrame.requestFullscreen ? gameFrame : playerShell;
            if (!document.fullscreenElement) await target.requestFullscreen();
        });
        document.getElementById("downloadButton").addEventListener("click", async () => {
            const response = await fetch(gameFrame.src);
            const blob = await response.blob();
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = ${JSON.stringify(gameName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "game")}.concat(".html");
            link.click();
            URL.revokeObjectURL(link.href);
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && document.fullscreenElement) document.exitFullscreen();
        });
    </script>
</body>
</html>`);
        return;
    }

    if (catalogRoutes.has(requestPath)) {
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(buildGameCatalog()));
        return;
    }

    const filePath = path.resolve(root, "." + requestPath);
    const safePath = appRoutes.has(requestPath)
        ? path.join(root, "index.html")
        : filePath.startsWith(root + path.sep) ? filePath : path.join(root, "index.html");
    const resolvedPath = appRoutes.has(requestPath)
        ? path.join(root, "index.html")
        : requestPath.endsWith("/")
            ? path.join(filePath, "index.html")
            : safePath;

    fs.stat(resolvedPath, (error, stats) => {
        if (error || !stats.isFile()) {
            response.writeHead(404);
            response.end("Not found");
            return;
        }

        response.writeHead(200, {
            "Content-Type": contentTypes[mime(resolvedPath)] || "application/octet-stream"
        });

        if (resolvedPath.startsWith(path.join(root, "games/sources") + path.sep) && path.extname(resolvedPath) === ".html") {
            fs.readFile(resolvedPath, "utf8", (readError, source) => {
                if (readError) {
                    response.writeHead(500);
                    response.end("Unable to load game");
                    return;
                }
                response.end(prepareGameHtml(source));
            });
            return;
        }

        fs.createReadStream(resolvedPath).pipe(response);
    });
});

server.on("upgrade", (request, socket, head) => {
    wisp.routeRequest(request, socket, head);
});

server.listen(port, "0.0.0.0", () => {
    console.log(`Proxy available at http://localhost:${port}`);
    console.log(`Wisp WebSocket available at ws://localhost:${port}/`);
});