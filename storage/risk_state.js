// --- Chapter 5: Risk State Repository ---
// Role: SSOT for Calculated Risk/Attention Scores
// "Management Score": Higher means "Needs more attention/management"

export const RISK_STATE_KEY = 'pdtm_risk_state_v1';

/**
 * @typedef {Object} RiskRecord
 * @property {number} score - 0 to 100
 * @property {string} confidence - "low" | "medium" | "high"
 * @property {string[]} reasons - List of RISK_REASONS codes
 * @property {number} last_updated_ts
 */

/**
 * Updates the risk record for a domain.
 * @param {string} domain 
 * @param {RiskRecord} record 
 * @param {Object} storageAPI 
 */
export async function updateRiskRecord(domain, record, storageAPI) {
  const data = await storageAPI.get([RISK_STATE_KEY]);
  const store = data[RISK_STATE_KEY] || {};

  store[domain] = record;
  
  await storageAPI.set({ [RISK_STATE_KEY]: store });
}