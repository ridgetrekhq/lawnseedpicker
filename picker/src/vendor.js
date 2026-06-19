// Single place that wires up the no-build React stack.
// React + htm are pinned via the import map in index.html (esm.sh). htm gives us
// JSX-like templates with zero build step: html`<${Comp} prop=${x} />`.

import React from 'react';
import htm from 'htm';

export const html = htm.bind(React.createElement);
export const { useState, useMemo, useEffect, useCallback, Fragment } = React;
export default React;
