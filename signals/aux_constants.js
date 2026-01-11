// --- Chapter 0: Aux Constants ---
// Role: Magic numbers for confidence capping
// Immutable Contract

export const AUX_CONSTANTS = Object.freeze({
  MAX_BONUS: 0.1,  // Max total additive effect from Aux signals
  MIN_VAL: 0.05,   // Min value for a single Aux signal
  MAX_VAL: 0.10,   // Max value for a single Aux signal
  
  // Guard: If ONLY Aux evidence exists, Confidence cannot exceed this
  CAP_WITHOUT_STRONG_EVIDENCE: 0.6 
});
