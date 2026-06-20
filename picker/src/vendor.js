// Single place that wires up the no-build React stack.
// React + htm are vendored locally (see ../vendor/) and resolved via the import
// map in index.html — no third-party requests at runtime. htm gives us
// JSX-like templates with zero build step: html`<${Comp} prop=${x} />`.

import React from 'react';
import htm from 'htm';

export const html = htm.bind(React.createElement);
export const { useState, useMemo, useEffect, useCallback, Fragment } = React;
export default React;
