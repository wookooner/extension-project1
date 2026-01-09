// --- Chapter 5: User Overrides Repository ---
// Role: SSOT for User Preferences per Domain
// Stores: Pin, Whitelist, Ignore, Category Tags

export const USER_OVERRIDES_KEY = 'pdtm_user_overrides_v1';

/**
 * @typedef {Object} UserOverride
 * @property {boolean} pinned - Protected from retention pruning
 * @property {boolean} whitelisted - Lowers risk score manually
 * @property {boolean} ignored - Hidden from lists/risk calculation
 * @property {string} category - User-assigned category (e.g., 'finance')
 * @property {string} [notes] - Optional user notes
 * @property {number} updated_ts
 */

/**
 * Updates a specific override field for a domain.
 * @param {string} domain 
 * @param {Object} partialOverride - e.g. { pinned: true } or { category: 'finance' }
 * @param {Object} storageAPI 
 */
export async function updateUserOverride(domain, partialOverride, storageAPI) {
  const data = await storageAPI.get([USER_OVERRIDES_KEY]);
  const store = data[USER_OVERRIDES_KEY] || {};

  const current = store[domain] || {
    pinned: false,
    whitelisted: false,
    ignored: false,
    category: null,
    updated_ts: 0
  };

  const updated = {
    ...current,
    ...partialOverride,
    updated_ts: Date.now()
  };

  store[domain] = updated;
  await storageAPI.set({ [USER_OVERRIDES_KEY]: store });
  return updated;
}

/**
 * Gets overrides for a specific domain.
 */
export async function getUserOverride(domain, storageAPI) {
  const data = await storageAPI.get([USER_OVERRIDES_KEY]);
  const store = data[USER_OVERRIDES_KEY] || {};
  return store[domain] || null;
}