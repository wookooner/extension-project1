// --- Chapter 4: Management State ---
// Role: Single Source of Truth for Item Status
// Determines how an item appears in the UI.

export const MANAGEMENT_STATE = Object.freeze({
  NONE: 'none',                 // Passive, Hidden (View only)
  NEEDS_REVIEW: 'needs_review', // Soft list (Candidate)
  SUGGESTED: 'suggested',       // Hard list (Likely Account/Transaction)
  PINNED: 'pinned'              // User explicitly tracked (Hard list)
});

/**
 * Checks if the state implies the item is "Managed" (Hard List).
 * @param {string} state 
 * @returns {boolean}
 */
export function isManaged(state) {
  return state === MANAGEMENT_STATE.SUGGESTED || state === MANAGEMENT_STATE.PINNED;
}

/**
 * Checks if the state implies the item is visible in any list (Surfaced).
 * Used for denominator in accuracy metrics.
 * @param {string} state 
 * @returns {boolean}
 */
export function isSurfaced(state) {
  return state === MANAGEMENT_STATE.SUGGESTED || 
         state === MANAGEMENT_STATE.NEEDS_REVIEW || 
         state === MANAGEMENT_STATE.PINNED;
}
