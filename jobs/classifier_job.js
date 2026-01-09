// --- Chapter 4: Classifier Job ---
// Role: Orchestration (Input -> Signals -> Heuristics -> Estimation)
// Does NOT write to storage directly (returns result or passes to storage helper).

import { extractUrlSignals, evaluateSignals } from '../signals/heuristics.js';
import { SIGNAL_CODES } from '../signals/signal_codes.js';

/**
 * Runs classification logic for a given URL and optional explicit signals.
 * @param {string} url 
 * @param {string[]} [explicitSignals] - Signals from content script or other sources
 * @returns {Object} ActivityEstimation
 */
export function classify(url, explicitSignals = []) {
  // Recommendation A: Signal Vocabulary Safety Check
  // Ensure we only process signals defined in our SSOT (signal_codes.ts).
  // This prevents 'undefined' behavior in heuristics if content scripts send garbage or mismatching codes.
  const knownCodes = new Set(Object.values(SIGNAL_CODES));
  
  const validatedSignals = explicitSignals.filter(signal => {
    if (knownCodes.has(signal)) return true;
    console.warn(`[PDTM Classifier] Dropped unknown signal: ${signal}`);
    return false;
  });

  // 1. Gather URL signals
  const urlSignals = extractUrlSignals(url);
  
  // 2. Combine with validated explicit signals
  const allSignals = [...urlSignals, ...validatedSignals];

  // 3. Evaluate
  return evaluateSignals(allSignals);
}