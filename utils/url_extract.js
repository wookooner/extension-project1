// --- Chapter 3: URL Extraction Utility ---
// Role: Extract nested domains from parameters (e.g. redirect_uri)
// Privacy: NEVER return the full URL/Path/Query. Only the eTLD+1/Hostname.

import { getDomain, getETLDPlusOne } from './domain.js';

/**
 * Extracts the eTLD+1 domain from the 'redirect_uri' query parameter.
 * @param {string} urlStr - The full URL to parse
 * @returns {string|null} - The normalized domain of the redirect_uri, or null
 */
export function extractRedirectUriDomain(urlStr) {
  try {
    const url = new URL(urlStr);
    const params = url.searchParams;
    
    // Common standard param name
    const redirectUri = params.get('redirect_uri') || params.get('return_to');
    
    if (!redirectUri) return null;

    // Use existing domain utility to ensure consistency (eTLD+1)
    const hostname = getDomain(redirectUri);
    return getETLDPlusOne(hostname);
  } catch (e) {
    return null;
  }
}
