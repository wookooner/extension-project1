// --- Chapter 3: Evidence Weights ---
// Role: Single Source of Truth for Confidence Scoring
// Tunable constants for the Confidence Contract

import { EVIDENCE_TYPES } from './evidence_types.js';

export const EVIDENCE_WEIGHTS = Object.freeze({
  [EVIDENCE_TYPES.REDIRECT_URI_MATCH]: 0.6, // Very Strong: Parameter matches Context
  [EVIDENCE_TYPES.KNOWN_IDP]: 0.5,         // Strong: Allowlist match
  [EVIDENCE_TYPES.STRONG_PATH]: 0.3,       // Strong indicator of intent
  [EVIDENCE_TYPES.OAUTH_PARAMS]: 0.2,      // Structural signature
  [EVIDENCE_TYPES.OPENER_LINK]: 0.2,       // Contextual linkage
  [EVIDENCE_TYPES.TEMPORAL_CHAIN]: 0.2,    // Behavioral signature (Roundtrip)
  // Transition qualifiers handled dynamically in aux_constants
});
