// --- Chapter 3: RP/IdP Inference Logic ---
// Role: Deduce Relaying Party (RP) and Identity Provider (IdP) candidates.
// Orchestrates URL extraction and Session Graph lookups.

import { extractRedirectUriDomain } from './url_extract.js';
import { getDomain, getETLDPlusOne } from './domain.js';
import { getTabOpenerId, getLastDomainForTab, getSessionContext } from '../storage/session_store.js';
import { isRoundtrip } from './roundtrip.js';
import { EVIDENCE_TYPES } from '../signals/evidence_types.js';

/**
 * Attempts to infer the RP domain from the redirect_uri parameter.
 * @param {string} url 
 * @returns {string|null} The normalized RP domain or null.
 */
export function inferRpFromRedirectUri(url) {
  return extractRedirectUriDomain(url);
}

/**
 * Attempts to infer the RP domain from the tab's opener (parent).
 * If the current tab is the IdP, the opener is likely the RP.
 * @param {number} tabId 
 * @returns {Promise<string|null>} The normalized RP domain or null.
 */
export async function inferRpFromOpener(tabId) {
  const openerId = await getTabOpenerId(tabId);
  if (!openerId) return null;

  // Get the last domain visited by the opener tab
  return await getLastDomainForTab(openerId);
}

/**
 * Infers the IdP domain from the current URL.
 * Simple normalization of current host.
 * @param {string} url 
 * @returns {string|null}
 */
export function inferIdpDomain(url) {
  const hostname = getDomain(url);
  return getETLDPlusOne(hostname);
}

/**
 * Checks if a valid temporal roundtrip exists in the session context.
 * Checks: RP -> IdP -> RP
 * @param {number} tabId 
 * @param {string} rpDomain 
 * @param {string} idpDomain 
 * @returns {Promise<boolean>}
 */
export async function checkTemporalRoundtrip(tabId, rpDomain, idpDomain) {
  if (!rpDomain || !idpDomain || rpDomain === idpDomain) return false;

  const context = await getSessionContext(tabId);
  if (!context || !context.events) return false;

  return isRoundtrip({
    rpCandidate: rpDomain,
    idpCandidate: idpDomain,
    events: context.events
  });
}
