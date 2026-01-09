// --- Chapter 2: Service Worker (Background Script) ---
// Role: Sensor & Storage Coordinator
// Logic: Navigation -> Filter -> Dedupe -> Store Event -> Update Domain State
// Updated for Chapter 3: Triggers Retention Check
// Updated for Chapter 4: Activity Classification (Navigation + DOM Signals)

import { updateDomainState } from './storage/domain_state.js';
import { performRetentionCheck } from './jobs/retention_job.js';
import { classify } from './jobs/classifier_job.js';
import { updateActivityState } from './storage/activity_state.js';

const SETTINGS_KEY = 'pdtm_settings_v1';
const EVENTS_KEY = 'pdtm_events_v1';
const MAX_EVENTS_DEFAULT = 1000;

// Promise Chain for Serialization (Mutex-like behavior)
let updateQueue = Promise.resolve();

// 1. Utility: Extract Hostname
const getDomain = (urlStr) => {
  try {
    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.hostname;
  } catch (e) {
    return null;
  }
};

// 2. Init
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.local.get(SETTINGS_KEY);
  if (!settings[SETTINGS_KEY]) {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: { collectionEnabled: true, maxEvents: MAX_EVENTS_DEFAULT }
    });
  }
});

// 3. Main Event Listener (Navigation)
chrome.webNavigation.onCompleted.addListener((details) => {
  updateQueue = updateQueue.then(async () => {
    
    // Filter: Main Frame only
    if (details.frameId !== 0) return;

    const domain = getDomain(details.url);
    if (!domain) return;

    // Fetch Data
    const data = await chrome.storage.local.get([EVENTS_KEY, SETTINGS_KEY]);
    const settings = data[SETTINGS_KEY] || { collectionEnabled: true, maxEvents: MAX_EVENTS_DEFAULT };
    
    if (!settings.collectionEnabled) return;

    const events = data[EVENTS_KEY] || [];
    const timestamp = Date.now();

    // Dedupe (Burst Prevention: < 2s)
    if (events.length > 0) {
      const lastEvent = events[0];
      if (lastEvent.domain === domain && (timestamp - lastEvent.ts < 2000)) {
        return; 
      }
    }

    // A. Store Raw Event
    const newEvent = {
      ts: timestamp,
      domain: domain,
      type: 'page_view'
    };
    const updatedEvents = [newEvent, ...events].slice(0, settings.maxEvents);
    await chrome.storage.local.set({ [EVENTS_KEY]: updatedEvents });
    
    // B. Update Domain State (Basic Stats)
    await updateDomainState(domain, timestamp, chrome.storage.local);

    // C. Chapter 4: Activity Classification (URL-based)
    const estimation = classify(details.url, []); // No explicit signals yet
    await updateActivityState(domain, estimation, timestamp, chrome.storage.local);
    
    // D. Update Badge
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const todayCount = updatedEvents.filter(e => e.ts >= startOfToday).length;
    
    if (todayCount > 0) {
      const text = todayCount > 999 ? '1k+' : todayCount.toString();
      chrome.action.setBadgeText({ text });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' }); 
    } else {
      chrome.action.setBadgeText({ text: '' });
    }

    // E. Retention Check
    await performRetentionCheck(chrome.storage.local);

  }).catch(err => {
    console.error("PDTM Service Worker Error:", err);
  });
}, { url: [{ schemes: ['http', 'https'] }] });

// 4. Message Listener (UI & Content Scripts)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // A. Manual Cleanup (UI)
  if (message.type === 'RUN_CLEANUP') {
    updateQueue = updateQueue.then(async () => {
      const stats = await performRetentionCheck(chrome.storage.local, message.force);
      return stats;
    }).then((stats) => {
      sendResponse({ success: true, stats });
    }).catch((err) => {
      console.error("Manual Cleanup Error:", err);
      sendResponse({ success: false, error: err.message });
    });
    return true; 
  }

  // B. Activity Signal (Content Script)
  if (message.type === 'ACTIVITY_SIGNAL') {
    // Only accept from trusted content scripts (sender.tab must exist)
    if (!sender.tab || !sender.tab.url) return;

    const domain = getDomain(sender.tab.url);
    if (!domain) return;

    updateQueue = updateQueue.then(async () => {
      const { payload } = message; // { url, signals, timestamp }
      
      // Re-classify using the DOM signals
      const estimation = classify(payload.url, payload.signals);
      
      // Update State
      await updateActivityState(domain, estimation, payload.timestamp, chrome.storage.local);
      console.log(`[PDTM] DOM Signal processed for ${domain}:`, estimation.level);

    }).catch(err => {
      console.error("Signal Processing Error:", err);
    });
  }
});