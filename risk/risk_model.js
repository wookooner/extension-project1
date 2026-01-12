// --- Chapter 4: Risk Model ---
// Role: Calculate quantitative Risk Score
// Formula: Risk = Base * Confidence

import { ActivityLevels } from '../signals/activity_levels.js';

const BASE_SCORES = {
  [ActivityLevels.TRANSACTION]: 70,
  [ActivityLevels.ACCOUNT]: 30, // Standard Login
  [ActivityLevels.UGC]: 45,     // Creation
  [ActivityLevels.VIEW]: 5
};

/**
 * Computes the Base Score based on Activity Level.
 * @param {string} level - ActivityLevel
 * @returns {number}
 */
export function computeBaseScore(level) {
  return BASE_SCORES[level] || 5;
}

/**
 * Computes the final Risk Score.
 * @param {Object} params
 * @param {number} params.base - Base score from activity level
 * @param {number} params.confidence - Confidence (0-1)
 * @param {number} [params.modifiers] - Optional modifiers (not used in MVP)
 * @returns {number} Integer 0-100
 */
export function computeRiskScore({ base, confidence }) {
  // Simple Linear Model
  const raw = base * confidence;
  
  // Round to nearest integer
  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * Determines the Risk Confidence (for UI display).
 * Currently aliases the classification confidence.
 * @param {Object} params
 * @returns {number}
 */
export function computeRiskConfidence({ confidence }) {
  return confidence;
}
