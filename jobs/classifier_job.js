// --- Chapter 4: Classifier Job ---
// Role: Orchestration (Input -> Signals -> Heuristics -> Estimation)
// Does NOT write to storage directly (returns result or passes to storage helper).

import { extractUrlSignals, evaluateSignals } from '../signals/heuristics.js';

/**
 * Runs classification logic for a given URL and optional explicit signals.
 * @param {string} url 
 * @param {string[]} [explicitSignals] - Signals from content script or other sources
 * @returns {Object} ActivityEstimation
 */
export function classify(url, explicitSignals = []) {
  // 1. Gather URL signals
  const urlSignals = extractUrlSignals(url);
  
  // 2. Combine with explicit signals
  const allSignals = [...urlSignals, ...explicitSignals];

  // 3. Evaluate
  return evaluateSignals(allSignals);
}