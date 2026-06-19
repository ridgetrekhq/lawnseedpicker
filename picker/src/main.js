// App entry point. Mounts the current screen into #app.
import React, { html } from './vendor.js';
import { createRoot } from 'react-dom/client';
import { FunnelScreen } from './ui/FunnelScreen.js';

function App() {
  return html`<${FunnelScreen} />`;
}

const root = createRoot(document.getElementById('app'));
root.render(html`<${App} />`);
