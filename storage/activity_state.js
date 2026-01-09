// --- Chapter 4: Activity State Repository ---
// Role: SSOT for Activity Classification Aggregates
// Stores "What kind of actions" happen on a domain.

import { ActivityLevel } from '../signals/activity_levels.js';

export const ACTIVITY_STATE_KEY = 'pdtm_activity_state_v1';

/**
 * @typedef {Object} DomainActivityState
 * @property {string} domain
 * @property {string} last_estimation_level - ActivityLevel enum value
 * @property {number} last_estimation_ts
 * @property {Object.<string, number>} counts_by_level - { view: 10, account: 2 ... }
 * @property {number} [last_account_touch_ts]
 * @property {number} [last_transaction_signal_ts]
 */

/**
 * Updates the activity state for a domain based on a new estimation.
 * @param {string} domain 
 * @param {Object} estimation - { level, confidence, reasons }
 * @param {number} timestamp 
 * @param {Object} storageAPI 
 */
export async function updateActivityState(domain, estimation, timestamp, storageAPI) {
  const data = await storageAPI.get([ACTIVITY_STATE_KEY]);
  const stateMap = data[ACTIVITY_STATE_KEY] || {};

  const record = stateMap[domain] || {
    domain: domain,
    last_estimation_level: ActivityLevel.VIEW,
    last_estimation_ts: 0,
    counts_by_level: {
      [ActivityLevel.VIEW]: 0,
      [ActivityLevel.ACCOUNT]: 0,
      [ActivityLevel.UGC]: 0,
      [ActivityLevel.TRANSACTION]: 0
    }
  };

  // 1. Increment Count
  if (!record.counts_by_level[estimation.level]) {
    record.counts_by_level[estimation.level] = 0;
  }
  record.counts_by_level[estimation.level]++;

  // 2. Update Metadata
  record.last_estimation_level = estimation.level;
  record.last_estimation_ts = timestamp;

  // 3. Track specific critical timestamps
  if (estimation.level === ActivityLevel.ACCOUNT) {
    record.last_account_touch_ts = timestamp;
  } else if (estimation.level === ActivityLevel.TRANSACTION) {
    record.last_transaction_signal_ts = timestamp;
  }

  // 4. Save
  stateMap[domain] = record;
  await storageAPI.set({ [ACTIVITY_STATE_KEY]: stateMap });
}