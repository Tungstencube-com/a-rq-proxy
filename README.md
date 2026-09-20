# scramjet-templates

Ready-to-use setup files for [Scramjet](https://github.com/MercuryWorkshop/scramjet).
Pick a template, follow its README, and you have a working web proxy.

## Quick Note
If you're going to use these in your project, please do the following:
- Attribute MercuryWorkshop for Epoxy, Scramjet, and other MercuryWorkshop packages
- Attribute me (x8rr) for the Scramjet Templates repo, if you use any templates in this repo

## Templates

| Template | Path | Notes |
| --- | --- | --- |
| HTML/JS | [`templates/html/2.0.67-alpha.1`](templates/html/2.0.67-alpha.1) | No build step. Scramjet files are included, just serve the folder. |
| React | [`templates/react/2.0.67-alpha.1`](templates/react/2.0.67-alpha.1) | A component. You install the packages and copy the runtime files into `public/`. |

## Run the HTML proxy

Install the local static server once, then start the included proxy:

```sh
npm install
npm start
```

Open the local URL printed by the command, usually `http://localhost:3000`.
The proxy needs a localhost or HTTPS origin because it uses a service worker.

Each template's README has the full setup guide.

## Supported versions

- v2.0.67-alpha.1

## React note

The `react` template does not include the Scramjet, Epoxy, or Libcurl files. Install
them with your own package manager. We recommend [bun](https://bun.sh).
