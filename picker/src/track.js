// GA4 event helper for the calculator (plan task 3, 10/11/26).
//
// Sends a named event through the site-wide gtag loaded in <head>. If analytics
// is blocked or has not loaded, this does nothing: tracking must never break
// the calculator, so every call is wrapped.
//
// PRIVACY: the zip code is never passed here. The homepage and the funnel both
// promise it stays on the device. Only the coarse region (cool / warm /
// transition) and the tapped answers are sent.
//
// Events (names are what appear in GA4 > Reports > Engagement > Events):
//   picker_start         first answer given on the funnel (once per page load)
//   picker_complete      a recommendation was shown
//   picker_retail_click  a "Shop at ..." card button was clicked
export function track(name, params) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, params || {});
    }
  } catch (e) {
    /* never let analytics break the tool */
  }
}

let started = false;

/** Fire picker_start the first time the visitor answers anything. */
export function trackStartOnce() {
  if (started) return;
  started = true;
  track('picker_start');
}
