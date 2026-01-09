// --- Chapter 4: Content Probe ---
// Role: DOM Signal Detection
// Principle: Read-only, No Storage, Send "Codes" only

(function() {
  const SIGNAL_CODES = {
    DOM_PASSWORD: "dom_password",
    DOM_EDITOR: "dom_editor",
    DOM_PAYMENT: "dom_payment"
  };

  function probe() {
    const signals = new Set();

    // 1. Password Field
    if (document.querySelector('input[type="password"]')) {
      signals.add(SIGNAL_CODES.DOM_PASSWORD);
    }

    // 2. Editor (Simple Heuristic)
    if (document.querySelector('textarea, [contenteditable="true"]')) {
      // Basic filter to avoid search bars
      const editors = Array.from(document.querySelectorAll('textarea, [contenteditable="true"]'));
      const likelyEditor = editors.some(el => el.offsetHeight > 100); // Trivial size check
      if (likelyEditor) {
        signals.add(SIGNAL_CODES.DOM_EDITOR);
      }
    }

    // 3. Payment (Very conservative)
    if (document.querySelector('input[name="cc_number"], input[name="cardnumber"], #card-element')) {
      signals.add(SIGNAL_CODES.DOM_PAYMENT);
    }

    if (signals.size > 0) {
      chrome.runtime.sendMessage({
        type: "ACTIVITY_SIGNAL",
        payload: {
          url: window.location.href,
          signals: Array.from(signals),
          timestamp: Date.now()
        }
      });
    }
  }

  // Run once on idle
  // In a real app, we might use MutationObserver, but for Chapter 4 MVP, one-shot is sufficient.
  if (document.readyState === 'complete') {
    setTimeout(probe, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(probe, 1000));
  }

})();