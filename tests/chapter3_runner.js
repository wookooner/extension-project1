// --- Chapter 3: Test Runner ---
// Run with node: node tests/chapter3_runner.js
// Mock chrome.storage.session for tests

import { extractRedirectUriDomain } from '../utils/url_extract.js';
import { extractUrlSignals } from '../signals/heuristics.js';
import { EVIDENCE_TYPES } from '../signals/evidence_types.js';

// Mock Dependencies (Since we can't load all session store dependencies in generic node runner easily without complex mocking)
// We focus on unit testing the new utilities.

console.log("🚦 Running Chapter 3 Inference Tests...\n");

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`✅ ${desc}`);
    passed++;
  } else {
    console.error(`❌ ${desc}`);
    failed++;
  }
}

// --- Test Suite 1: URL Extraction (Redirect URI) ---

const t1_url = "https://accounts.google.com/o/oauth2/auth?redirect_uri=https%3A%2F%2Fwww.twitter.com%2Fcallback&response_type=code";
const t1_res = extractRedirectUriDomain(t1_url);
assert("Extracts twitter.com from redirect_uri", t1_res === "twitter.com");

const t2_url = "https://login.live.com/oauth20_authorize.srf?client_id=123"; // No redirect_uri
const t2_res = extractRedirectUriDomain(t2_url);
assert("Returns null if redirect_uri missing", t2_res === null);

const t3_url = "https://auth.example.com?return_to=https://app.example.com/dashboard"; // return_to fallback
const t3_res = extractRedirectUriDomain(t3_url);
assert("Extracts example.com from return_to", t3_res === "example.com");

// --- Test Suite 2: Heuristics Integration (Keyword Guard) ---

const authorUrl = "https://example.com/author/john-doe";
const signals = extractUrlSignals(authorUrl); // Should return ['url_login'] because 'auth' matches
// However, Chapter 2/3 classifier logic downgrades this.
// Here we verify heuristics behavior is unchanged, so Classifier can do its job.
assert("Heuristics still flags /author as URL_LOGIN (to be guarded later)", signals.includes("url_login"));


console.log(`\nResults: ${passed} Passed, ${failed} Failed.`);
console.log("(Note: Full integration tests require Chrome Runtime mocks for Session Store)");
