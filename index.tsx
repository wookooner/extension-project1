import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Shield, 
  Activity, 
  Trash2, 
  Pause, 
  Play, 
  Clock, 
  BarChart2, 
  Globe, 
  AlertCircle,
  Construction,
  Settings as SettingsIcon,
  Save,
  Eraser,
  Eye,
  User,
  PenTool,
  CreditCard
} from 'lucide-react';

// Declare chrome to avoid TS errors
declare const chrome: any;

// --- Types ---

interface RawEvent {
  ts: number;
  domain: string;
  type: 'page_view';
}

interface DomainState {
  domain: string;
  first_seen: number;
  last_seen: number;
  visit_count_total: number;
}

interface AppSettings {
  collectionEnabled: boolean;
  maxEvents: number;
}

interface RetentionPolicy {
  raw_events_ttl_days: number;
  prune_inactive_domains_days: number;
  last_cleanup_ts: number;
}

// Chapter 4: Activity State
enum ActivityLevel {
  VIEW = "view",
  ACCOUNT = "account",
  UGC = "ugc",
  TRANSACTION = "transaction"
}

interface DomainActivityState {
  domain: string;
  last_estimation_level: ActivityLevel;
  last_estimation_ts: number;
  counts_by_level: Record<string, number>;
  last_account_touch_ts?: number;
  last_transaction_signal_ts?: number;
}

// --- ENVIRONMENT DETECTION ---

const isExtensionEnv = typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;

// --- API ABSTRACTION ---

const api = {
  get: (keys: string[]) => {
    if (isExtensionEnv) {
      return chrome.storage.local.get(keys);
    } else {
      // Mock for Web Preview
      return new Promise((resolve) => {
        const result: any = {};
        keys.forEach(k => {
          const item = localStorage.getItem(k);
          if (item) result[k] = JSON.parse(item);
        });
        resolve(result);
      });
    }
  },
  set: (items: Record<string, any>) => {
    if (isExtensionEnv) {
      return chrome.storage.local.set(items);
    } else {
      // Mock for Web Preview
      return new Promise<void>((resolve) => {
        Object.entries(items).forEach(([k, v]) => {
          localStorage.setItem(k, JSON.stringify(v));
        });
        window.dispatchEvent(new Event('storage')); 
        resolve();
      });
    }
  }
};

// --- Constants ---
const EVENTS_KEY = 'pdtm_events_v1';
const SETTINGS_KEY = 'pdtm_settings_v1';
const DOMAIN_STATE_KEY = 'pdtm_domain_state_v1';
const POLICY_KEY = 'pdtm_retention_policy_v1';
const ACTIVITY_STATE_KEY = 'pdtm_activity_state_v1'; // Chapter 4

const DEFAULT_POLICY: RetentionPolicy = {
  raw_events_ttl_days: 30,
  prune_inactive_domains_days: 180,
  last_cleanup_ts: 0
};

// --- HELPERS ---

const getActivityIcon = (level: ActivityLevel | undefined) => {
  switch (level) {
    case ActivityLevel.TRANSACTION: return <CreditCard size={12} className="text-rose-500" />;
    case ActivityLevel.UGC: return <PenTool size={12} className="text-purple-500" />;
    case ActivityLevel.ACCOUNT: return <User size={12} className="text-blue-500" />;
    default: return <Eye size={12} className="text-slate-400" />;
  }
};

const getActivityLabel = (level: ActivityLevel | undefined) => {
  switch (level) {
    case ActivityLevel.TRANSACTION: return "Transaction";
    case ActivityLevel.UGC: return "Created Content";
    case ActivityLevel.ACCOUNT: return "Account Access";
    default: return "Passive View";
  }
};

// --- COMPONENT: Popup UI ---

const Popup = () => {
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [domainStates, setDomainStates] = useState<Record<string, DomainState>>({});
  const [activityStates, setActivityStates] = useState<Record<string, DomainActivityState>>({});
  const [settings, setSettings] = useState<AppSettings>({ collectionEnabled: true, maxEvents: 1000 });
  const [policy, setPolicy] = useState<RetentionPolicy>(DEFAULT_POLICY);
  
  const [activeTab, setActiveTab] = useState<'recent' | 'top' | 'settings'>('recent');
  const [loading, setLoading] = useState(true);

  // Load Data
  const refreshData = async () => {
    const data = await api.get([EVENTS_KEY, SETTINGS_KEY, DOMAIN_STATE_KEY, POLICY_KEY, ACTIVITY_STATE_KEY]);
    setEvents(data[EVENTS_KEY] || []);
    setDomainStates(data[DOMAIN_STATE_KEY] || {});
    setActivityStates(data[ACTIVITY_STATE_KEY] || {});
    if (data[SETTINGS_KEY]) {
      setSettings(data[SETTINGS_KEY]);
    }
    setPolicy({ ...DEFAULT_POLICY, ...data[POLICY_KEY] });
    setLoading(false);
  };

  useEffect(() => {
    refreshData();

    if (isExtensionEnv) {
      const listener = (changes: any, areaName: string) => {
        if (areaName === 'local') {
          // Check for any relevant key changes
          if (Object.keys(changes).some(k => [EVENTS_KEY, SETTINGS_KEY, DOMAIN_STATE_KEY, POLICY_KEY, ACTIVITY_STATE_KEY].includes(k))) {
            refreshData();
          }
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    } else {
      const listener = () => refreshData();
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    }
  }, []);

  // Actions
  const handleClear = async () => {
    if (confirm('Permanently delete all tracking history?\n\n- Clears Events\n- Clears Domain Stats\n- Clears Activity Levels\n- PRESERVES your settings\n- RESETS Cleanup Timer')) {
      const data = await api.get([POLICY_KEY]);
      const currentPolicy = data[POLICY_KEY] || DEFAULT_POLICY;
      
      await api.set({ 
        [EVENTS_KEY]: [], 
        [DOMAIN_STATE_KEY]: {},
        [ACTIVITY_STATE_KEY]: {},
        [POLICY_KEY]: { ...currentPolicy, last_cleanup_ts: 0 }
      });
      
      if (isExtensionEnv) chrome.action.setBadgeText({ text: '' });
      refreshData();
    }
  };

  const handleTogglePause = async () => {
    const newStatus = !settings.collectionEnabled;
    await api.set({ 
      [SETTINGS_KEY]: { ...settings, collectionEnabled: newStatus } 
    });
    refreshData();
  };

  const handlePolicyChange = async (key: keyof RetentionPolicy, value: number) => {
    const newPolicy = { ...policy, [key]: value };
    await api.set({ [POLICY_KEY]: newPolicy });
    setPolicy(newPolicy);
  };

  const handleRunCleanup = async () => {
    if (isExtensionEnv) {
      try {
        const response: any = await chrome.runtime.sendMessage({ type: 'RUN_CLEANUP', force: true });
        if (chrome.runtime.lastError) {
          alert("Error connecting to Service Worker.");
          return;
        }
        if (response && response.success) {
          const { stats } = response;
          alert(stats ? `Cleanup complete.\n\nEvents Removed: ${stats.eventsRemoved}\nDomains Pruned: ${stats.domainsPruned}` : 'Cleanup ran but no action was needed.');
          refreshData();
        } else {
          alert('Cleanup failed: ' + (response?.error || 'Unknown error'));
        }
      } catch (e) {
        alert('Failed to trigger cleanup.');
      }
    } else {
      alert("Simulation for Cleanup not fully implemented in preview for Chapter 4 complex structures.");
    }
  };

  // Derived State
  const topDomains = useMemo(() => {
    return Object.values(domainStates)
      .sort((a, b) => b.visit_count_total - a.visit_count_total)
      .slice(0, 10);
  }, [domainStates]);

  const recentEvents = useMemo(() => {
    return [...events].slice(0, 20); 
  }, [events]);

  // Utility: Time format
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatRelative = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  if (loading) return <div className="h-full flex items-center justify-center text-slate-400">Loading...</div>;

  return (
    <div className="flex flex-col h-full bg-white font-sans text-slate-900">
      
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 shrink-0 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-indigo-400" />
          <h1 className="font-bold text-sm tracking-wide">PDTM <span className="text-slate-500 text-xs font-normal">v0.4</span></h1>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${settings.collectionEnabled ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300' : 'bg-amber-500/10 border-amber-500/50 text-amber-300'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${settings.collectionEnabled ? 'bg-indigo-400 animate-pulse' : 'bg-amber-400'}`} />
          {settings.collectionEnabled ? 'Active' : 'Paused'}
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-end">
        <div>
          <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">Total Visits</p>
          <div className="text-3xl font-bold text-slate-800 leading-none">
            {Object.values(domainStates).reduce((acc, curr) => acc + curr.visit_count_total, 0)}
          </div>
        </div>
        <div className="text-xs text-slate-400 text-right">
          <p>Activity Classification On</p>
          <p>Domains Tracked: {Object.keys(domainStates).length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('recent')}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'recent' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}
        >
          <Clock size={14} /> Recent
        </button>
        <button 
          onClick={() => setActiveTab('top')}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'top' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}
        >
          <BarChart2 size={14} /> Top Sites
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}
        >
          <SettingsIcon size={14} /> Settings
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-white p-0 scrollbar-thin">
        
        {/* TAB: RECENT */}
        {activeTab === 'recent' && (
          events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Activity size={32} className="mb-2 opacity-20" />
              <p className="text-sm">No recent traces.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentEvents.map((e, i) => {
                // Determine Level for this domain
                const actState = activityStates[e.domain];
                const level = actState ? actState.last_estimation_level : ActivityLevel.VIEW;
                
                return (
                  <li key={e.ts + '_' + i} className="p-3 hover:bg-slate-50 flex items-center gap-3 group animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <div className="bg-slate-100 p-1.5 rounded text-slate-500 relative">
                      <Globe size={14} />
                      {/* Badge */}
                      {level !== ActivityLevel.VIEW && (
                         <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100">
                            {getActivityIcon(level)}
                         </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-slate-800 truncate" title={e.domain}>{e.domain}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono">{formatTime(e.ts)}</span>
                        {level !== ActivityLevel.VIEW && (
                           <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                             {getActivityLabel(level)}
                           </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {/* TAB: TOP SITES */}
        {activeTab === 'top' && (
          topDomains.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <BarChart2 size={32} className="mb-2 opacity-20" />
              <p className="text-sm">No domain stats yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topDomains.map((state, i) => {
                const actState = activityStates[state.domain];
                const level = actState ? actState.last_estimation_level : ActivityLevel.VIEW;
                
                return (
                  <li key={state.domain} className="p-3 hover:bg-slate-50 flex items-center justify-between group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-mono w-5 h-5 flex items-center justify-center rounded ${i < 3 ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-slate-100 text-slate-500'}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate flex items-center gap-2">
                          {state.domain}
                          <span title={`Estimated: ${getActivityLabel(level)}`}>
                             {getActivityIcon(level)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          {(Date.now() - state.last_seen < 86400000) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="Active recently"></span>
                          )}
                          Last: {formatRelative(state.last_seen)}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                      {state.visit_count_total}
                    </span>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {/* TAB: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="p-4 space-y-6">
            
            {/* Legend for Activity Levels */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide flex items-center gap-1">
                <Activity size={12} /> Activity Estimates
              </div>
              <div className="space-y-2">
                 <div className="flex items-center gap-2 text-xs text-slate-700">
                   <CreditCard size={12} className="text-rose-500" />
                   <span className="font-medium">Transaction:</span> Checkout, Payment
                 </div>
                 <div className="flex items-center gap-2 text-xs text-slate-700">
                   <PenTool size={12} className="text-purple-500" />
                   <span className="font-medium">UGC:</span> Creating, Editing
                 </div>
                 <div className="flex items-center gap-2 text-xs text-slate-700">
                   <User size={12} className="text-blue-500" />
                   <span className="font-medium">Account:</span> Login, Settings
                 </div>
                 <div className="flex items-center gap-2 text-xs text-slate-700">
                   <Eye size={12} className="text-slate-400" />
                   <span className="font-medium">View:</span> Passive Browsing
                 </div>
              </div>
              <p className="mt-3 text-[10px] text-slate-400 leading-tight">
                * Estimations based on URL patterns and page elements. No content is stored.
              </p>
            </div>

            {/* Log Retention */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-slate-800 font-medium text-sm">
                <Clock size={16} className="text-indigo-500" />
                Raw Log Retention
              </div>
              <select 
                value={policy.raw_events_ttl_days}
                onChange={(e) => handlePolicyChange('raw_events_ttl_days', Number(e.target.value))}
                className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value={7}>7 Days</option>
                <option value={30}>30 Days (Recommended)</option>
                <option value={90}>90 Days</option>
                <option value={0}>Forever (No Auto-Delete)</option>
              </select>
            </div>

            {/* Domain Pruning */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-slate-800 font-medium text-sm">
                <Trash2 size={16} className="text-indigo-500" />
                Prune Inactive Services
              </div>
              <select 
                value={policy.prune_inactive_domains_days}
                onChange={(e) => handlePolicyChange('prune_inactive_domains_days', Number(e.target.value))}
                className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value={90}>90 Days</option>
                <option value={180}>6 Months (Recommended)</option>
                <option value={365}>1 Year</option>
                <option value={0}>Never Prune</option>
              </select>
            </div>

            {/* Manual Action */}
            <div className="pt-2 border-t border-slate-100">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-xs text-slate-400">
                   Last Cleanup: {policy.last_cleanup_ts ? formatRelative(policy.last_cleanup_ts) : 'Never'}
                 </span>
               </div>
               <button 
                onClick={handleRunCleanup}
                className="w-full py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-100 flex items-center justify-center gap-2"
               >
                 <Eraser size={14} /> Run Cleanup Now
               </button>
            </div>

          </div>
        )}

      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2 shrink-0">
        <button 
          onClick={handleTogglePause}
          className={`flex-1 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border transition-all active:scale-95
            ${settings.collectionEnabled 
              ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' 
              : 'bg-indigo-50 border-indigo-200 text-indigo-700'}`}
        >
          {settings.collectionEnabled ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}
        </button>
        <button 
          onClick={handleClear}
          className="flex-1 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center justify-center gap-1.5 transition-colors active:scale-95"
        >
          <Trash2 size={14} /> Clear Data
        </button>
      </div>
    </div>
  );
};

// --- SIMULATOR TOOL (Only for this Web Preview) ---

const DevSimulator = () => {
  const [simUrl, setSimUrl] = useState('https://www.google.com/account/login');
  
  const simulateVisit = async () => {
    try {
      const url = new URL(simUrl);
      if (!['http:', 'https:'].includes(url.protocol)) return alert('Invalid protocol');
      const domain = url.hostname;
      const timestamp = Date.now();
      
      const data = await api.get([EVENTS_KEY, SETTINGS_KEY, DOMAIN_STATE_KEY, ACTIVITY_STATE_KEY]);
      const settings = data[SETTINGS_KEY] || { collectionEnabled: true, maxEvents: 1000 };
      if (!settings.collectionEnabled) return alert('Collection Paused');

      const events = data[EVENTS_KEY] || [];
      const stateMap = data[DOMAIN_STATE_KEY] || {};
      const activityMap = data[ACTIVITY_STATE_KEY] || {};

      // 1. Dedupe Events
      if (events.length > 0 && events[0].domain === domain && (timestamp - events[0].ts < 2000)) {
        return console.log("Dedupe in Simulator");
      }

      // 2. Update Events
      const newEvent = { ts: timestamp, domain, type: 'page_view' };
      const updatedEvents = [newEvent, ...events].slice(0, settings.maxEvents);
      
      // 3. Update Domain State (Simulated Logic)
      const record = stateMap[domain] || {
        domain: domain,
        first_seen: timestamp,
        last_seen: 0,
        visit_count_total: 0
      };
      record.last_seen = timestamp;
      record.visit_count_total += 1;
      stateMap[domain] = record;

      // 4. Update Activity (Simplified for Simulator - no heuristics file import in browser)
      let level = ActivityLevel.VIEW;
      if (simUrl.includes('login')) level = ActivityLevel.ACCOUNT;
      if (simUrl.includes('edit')) level = ActivityLevel.UGC;
      if (simUrl.includes('checkout')) level = ActivityLevel.TRANSACTION;

      const actRecord = activityMap[domain] || {
        domain: domain,
        last_estimation_level: ActivityLevel.VIEW,
        last_estimation_ts: 0,
        counts_by_level: {}
      };
      actRecord.last_estimation_level = level;
      actRecord.last_estimation_ts = timestamp;
      if (!actRecord.counts_by_level[level]) actRecord.counts_by_level[level] = 0;
      actRecord.counts_by_level[level]++;
      activityMap[domain] = actRecord;

      // 5. Save
      await api.set({ 
        [EVENTS_KEY]: updatedEvents,
        [DOMAIN_STATE_KEY]: stateMap,
        [ACTIVITY_STATE_KEY]: activityMap
      });
      
    } catch (e) {
      alert('Invalid URL: ' + e);
    }
  };

  return (
    <div className="absolute -right-[340px] top-0 w-[320px] bg-slate-800 p-4 rounded-lg text-white shadow-xl border border-slate-600">
      <div className="flex items-center gap-2 mb-3 text-emerald-400">
        <Construction size={16} />
        <h3 className="font-bold text-sm">Dev Simulator</h3>
      </div>
      <p className="text-xs text-slate-300 mb-3">
        <b>Chapter 4 Active:</b> Activity Classification.<br/>
        Try URLs with 'login', 'edit', 'checkout'.
      </p>
      <input 
        value={simUrl} 
        onChange={e => setSimUrl(e.target.value)}
        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs mb-2 text-slate-200 font-mono"
      />
      <button 
        onClick={simulateVisit}
        className="w-full bg-indigo-600 hover:bg-indigo-500 py-1 rounded text-xs font-bold"
      >
        Simulate Visit
      </button>
    </div>
  );
};

// --- APP ENTRY ---

const App = () => {
  return (
    <div className="relative flex justify-center items-center h-full bg-slate-200">
      <div className="w-[360px] h-[500px] shadow-2xl relative">
        <Popup />
      </div>
      {!isExtensionEnv && <DevSimulator />}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);