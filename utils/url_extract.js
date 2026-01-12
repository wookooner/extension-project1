// --- Chapter 3: URL Extraction Utility ---
// Role: Extract nested domains from parameters (e.g. redirect_uri)
// Privacy: NEVER return the full URL/Path/Query. Only the eTLD+1/Hostname.

import { getDomain, getETLDPlusOne } from './domain.js';

/**
 * Extracts the eTLD+1 domain from the 'redirect_uri' query parameter.
 * 
 * [PRIVACY EXCEPTION NOTICE]
 * Rule: "Do not access parameter values".
 * Exception: We strictly read 'redirect_uri' ONLY to extract the hostname.
 * Safeguard: The full value is processed in-memory and discarded immediately. 
 * It is NEVER stored, logged, or passed to other functions.
 * 
 * @param {string} urlStr - The full URL to parse
 * @returns {string|null} - The normalized domain of the redirect_uri, or null
 */
export function extractRedirectUriDomain(urlStr) {
  try {
    const url = new URL(urlStr);
    const params = url.searchParams;
    
    // Transient Read: Access value solely for extraction
    const redirectUri = params.get('redirect_uri') || params.get('return_to');
    
    if (!redirectUri) return null;

    // Immediate Sanitization: Convert to Hostname -> eTLD+1
    const hostname = getDomain(redirectUri);
    return getETLDPlusOne(hostname);
  } catch (e) {
    return null;
  }
}
