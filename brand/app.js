/* Jobby McJobberson — brand site behaviour.
 *
 * Deliberately tiny: a marketing page needs no framework. The tool count on the
 * page is a static claim, not a live fetch — GET /api/tools/catalog is
 * key-gated, so the browser cannot read it, and shipping the number from markup
 * is more honest than a fetch that always fails and silently falls back anyway.
 * It is kept in step with the fleet by hand (177 as of this writing).
 */
(function () {
  'use strict';

  // Deep links open their <details> so an anchored FAQ link lands on the answer
  // rather than a closed row.
  function openDeepLinkedDetails() {
    if (!window.location.hash) return;
    var target;
    try { target = document.querySelector(window.location.hash); } catch (e) { return; }
    if (target && target.tagName === 'DETAILS') target.open = true;
  }

  function init() {
    openDeepLinkedDetails();
    window.addEventListener('hashchange', openDeepLinkedDetails);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
