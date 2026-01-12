// --- Chapter 4: State Mapper ---
// Role: Decision Logic (State Machine) for Management State
// Inputs: Subtype (Level), Risk Score, Confidence, Context
// Output: MANAGEMENT_STATE

import { MANAGEMENT_STATE } from '../storage/management_state.js';
import { ActivityLevels } from '../signals/activity_levels.js';

/**
 * Maps classification results to a UI Management State.
 * @param {Object} params
 * @param {string} params.level - ActivityLevel
 * @param {number} params.score - Calculated Risk Score (0-100)
 * @param {number} params.confidence - Classification Confidence (0-1)
 * @param {string} [params.rp_domain] - If an RP was inferred
 * @param {number} [params.seenCount] - Total visit count (for frequency rules)
 * @param {boolean} [params.isPinned] - If user has pinned it (override)
 * @returns {string} MANAGEMENT_STATE enum value
 */
export function mapToManagementState({ level, score, confidence, rp_domain, seenCount = 0, isPinned = false }) {
  
  // 1. User Override (Highest Priority)
  if (isPinned) {
    return MANAGEMENT_STATE.PINNED;
  }

  // 2. SUGGESTED Rules (High Confidence & Impact)
  // Rule: High Confidence AND (Transaction OR (Account + RP))
  if (confidence >= 0.8) {
    if (level === ActivityLevels.TRANSACTION) {
      return MANAGEMENT_STATE.SUGGESTED;
    }
    // For Account activity, we prefer having an RP identified (OAuth) or strong DOM signals
    // If it's just a generic "login" page without RP context, it might be noise.
    if (level === ActivityLevels.ACCOUNT && (rp_domain || score >= 20)) {
      return MANAGEMENT_STATE.SUGGESTED;
    }
  }

  // 3. NEEDS_REVIEW Rules (Candidate)
  // Guard: Confidence must be decent (>= 0.6) OR Frequency is high
  const decentConfidence = confidence >= 0.6;
  const isFrequent = seenCount > 50; 

  if (level !== ActivityLevels.VIEW) {
     // If it's a "Sensitive" activity but low confidence or incomplete data
     if (decentConfidence || isFrequent) {
       return MANAGEMENT_STATE.NEEDS_REVIEW;
     }
  }

  // Special Case: High Frequency Views
  // If we visit a site very often, it might be worth reviewing even if passive.
  if (level === ActivityLevels.VIEW && isFrequent) {
    return MANAGEMENT_STATE.NEEDS_REVIEW;
  }

  // 4. Default
  return MANAGEMENT_STATE.NONE;
}
