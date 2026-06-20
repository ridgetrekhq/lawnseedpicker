# Vendored libraries

Local copies of the runtime dependencies so the site makes **zero third-party
requests** — nothing about a visitor or their zip ever leaves their browser.

| File | Package | Version | Source |
|------|---------|---------|--------|
| `react.js` | react | 18.3.1 | `https://esm.sh/react@18.3.1/es2022/react.bundle.mjs` |
| `react-dom-client.js` | react-dom/client | 18.3.1 | `https://esm.sh/react-dom@18.3.1/X-ZXJlYWN0/es2022/client.bundle.mjs` (built with `react` external) |
| `htm.js` | htm | 3.1.1 | `https://esm.sh/htm@3.1.1/es2022/htm.bundle.mjs` |

`react-dom-client.js` imports a bare `react` specifier, resolved to `./react.js`
by the import map in `../index.html` (so React is a single shared instance).

## Refreshing / bumping a version

Re-download the bundle(s) and overwrite the file(s) (PowerShell):

```powershell
Invoke-WebRequest 'https://esm.sh/react@18.3.1/es2022/react.bundle.mjs' -OutFile react.js
Invoke-WebRequest 'https://esm.sh/react-dom@18.3.1/X-ZXJlYWN0/es2022/client.bundle.mjs' -OutFile react-dom-client.js
Invoke-WebRequest 'https://esm.sh/htm@3.1.1/es2022/htm.bundle.mjs' -OutFile htm.js
```

For a new React version, confirm `react-dom-client.js` still imports only the
bare `react` specifier (no absolute CDN URLs) before committing.
