# Scramjet for React (v2.0.67-alpha.1)

A [Scramjet](https://github.com/MercuryWorkshop/scramjet) web proxy as a React
component. `App.tsx` has a URL bar and an `<iframe>` that browses through Scramjet.

Unlike the HTML template, the Scramjet files are not vendored here. You install them
with your package manager and copy the runtime files into `public/`.

## Install

```sh
bun add @mercuryworkshop/scramjet@2.0.67-alpha.1 \
        @mercuryworkshop/scramjet-controller \
        @mercuryworkshop/epoxy-transport
```

Notes:
- Use `@mercuryworkshop/libcurl-transport` instead of epoxy if you prefer it.
- `@mercuryworkshop/scramjet-utils` is optional, for plugins and extra features.

## Set up

1. **Copy the runtime files into `public/`** so they're served at your site root.
   The controller expects them at these paths:

   | File | Path it needs to be served at |
   | --- | --- |
   | Scramjet runtime | `/scramjet/scramjet.js` |
   | Rewriter WASM | `/scramjet/scramjet.wasm` |
   | Controller inject script | `/controller/controller.inject.js` |
   | Controller SW script | `/controller/controller.sw.js` |

   You can copy them by hand, or do it on build with
   [vite-plugin-static-copy](https://github.com/sapphi-red/vite-plugin-static-copy)
   pointing at the files in `node_modules/@mercuryworkshop/...`.

2. **Put `sw.js` in `public/`** (it's already here). It must end up at your site
   root so its scope covers the whole app.

3. **Register the service worker and Scramjet scripts** in your entry HTML (`index.html`):

   ```html
   <script src="/scramjet/scramjet.js"></script>
   <script src="/controller/controller.api.js"></script>
   <script>
     if ("serviceWorker" in navigator) {
       navigator.serviceWorker.register("/sw.js");
     }
   </script>
   ```

4. **Set your wisp URL** in `App.tsx`:

   ```ts
   const transport = new EpoxyTransport({ wisp: "wss://your-wisp-server/" });
   ```

   Run your own with
   [wisp-server-node](https://github.com/MercuryWorkshop/wisp-server-node) or any
   other wisp implementation. Public servers get rate-limited and go down.

5. **Drop `<App />` into your app** wherever you want the proxy.

## How App.tsx works

```ts
const registration = await navigator.serviceWorker.ready;       // sw.js is active
const serviceworker = navigator.serviceWorker.controller ?? registration.active;

const transport = new EpoxyTransport({ wisp: "wss://your-wisp-server/" });
await transport.init();

const scramjet = new Controller({ serviceworker, transport, scramjetConfig: defaultConfig });
await scramjet.wait();

const frame = scramjet.createFrame(iframeRef.current);
frame.go(url);
```

`navigate()` reuses the existing frame with `scramjetRef.current.getFrames()[0].go(url)`.

## Troubleshooting

| Symptom | What's going on |
| --- | --- |
| `rewriter wasm does not have wasm magic (... 404)` | `/scramjet/scramjet.wasm` isn't being served. Copy it into `public/scramjet/`. |
| `Failed to register a ServiceWorker` | You're not on a secure context. Use localhost or https. |
| Old behaviour sticks around after edits | Unregister the SW in DevTools, Application, Service Workers, then hard refresh. |
| Pages time out or won't load | The wisp server is down or rate-limiting you. Use your own. |
| Version mismatch error at startup | Keep the controller and scramjet package versions in sync. |
