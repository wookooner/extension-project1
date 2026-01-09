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
  CreditCard,
  AlertTriangle,
  Pin,
  CheckCircle,
  EyeOff,
  Tag
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
type ActivityLevelType = "view" | "account" | "ugc" | "transaction";

const ActivityLevels: Record<string, ActivityLevelType> = {
  VIEW: "view",
  ACCOUNT: "account",
  UGC: "ugc",
  TRANSACTION: "transaction"
};

interface DomainActivityState {
  domain: string;
  last_estimation_level: ActivityLevelType;
  last_estimation_ts: number;
  counts_by_level: Record<string, number>;
  last_account_touch_ts?: number;
  last_transaction_signal_ts?: number;
}

// Chapter 5: Risk & Overrides
interface RiskRecord {
  score: number; // 0-100
  confidence: string;
  reasons: string[];
  last_updated_ts: number;
}

interface UserOverride {
  pinned: boolean;
  whitelisted: boolean;
  ignored: boolean;
  category: string | null; // "finance", "auth", etc.
  updated_ts: number;
}

const CATEGORY_OPTIONS = [
  { value: 'finance', label: 'Finance' },
  { value: 'auth', label: 'Auth/SSO' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'social', label: 'Social' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'other', label: 'Other' },
];

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
const RISK_STATE_KEY = 'pdtm_risk_state_v1'; // Chapter 5
const USER_OVERRIDES_KEY = 'pdtm_user_overrides_v1'; // Chapter 5

const DEFAULT_POLICY: RetentionPolicy = {
  raw_events_ttl_days: 30,
  prune_inactive_domains_days: 180,
  last_cleanup_ts: 0
};

// --- HELPERS ---

const getActivityIcon = (level: ActivityLevelType | undefined) => {
  switch (level) {
    case ActivityLevels.TRANSACTION: return <CreditCard size={12} className="text-rose-500" />;
    case ActivityLevels.UGC: return <PenTool size={12} className="text-purple-500" />;
    case ActivityLevels.ACCOUNT: return <User size={12} className="text-blue-500" />;
    default: return <Eye size={12} className="text-slate-400" />;
  }
};

const getRiskColor = (score: number) => {
  if (score >= 70) return 'bg-rose-100 text-rose-700 border-rose-200';
  if (score >= 40) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
};

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatRelative = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(ts).toLocaleDateString();
};

// --- COMPONENT: Popup UI ---

const Popup = () => {
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [domainStates, setDomainStates] = useState<Record<string, DomainState>>({});
  const [activityStates, setActivityStates] = useState<Record<string, DomainActivityState>>({});
  const [riskStates, setRiskStates] = useState<Record<string, RiskRecord>>({});
  const [overrides, setOverrides] = useState<Record<string, UserOverride>>({});
  
  const [settings, setSettings] = useState<AppSettings>({ collectionEnabled: true, maxEvents: 1000 });
  const [policy, setPolicy] = useState<RetentionPolicy>(DEFAULT_POLICY);
  
  const [activeTab, setActiveTab] = useState<'recent' | 'risk' | 'settings'>('recent');
  const [loading, setLoading] = useState(true);

  // Load Data
  const refreshData = async () => {
    const data = await api.get([EVENTS_KEY, SETTINGS_KEY, DOMAIN_STATE_KEY, POLICY_KEY, ACTIVITY_STATE_KEY, RISK_STATE_KEY, USER_OVERRIDES_KEY]);
    setEvents(data[EVENTS_KEY] || []);
    setDomainStates(data[DOMAIN_STATE_KEY] || {});
    setActivityStates(data[ACTIVITY_STATE_KEY] || {});
    setRiskStates(data[RISK_STATE_KEY] || {});
    setOverrides(data[USER_OVERRIDES_KEY] || {});

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
        if (areaName === 'local') refreshData();
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
  const handleTogglePause = async () => {
    const newStatus = !settings.collectionEnabled;
    await api.set({ [SETTINGS_KEY]: { ...settings, collectionEnabled: newStatus } });
    refreshData();
  };

  const handleClear = async () => {
    if (confirm('Permanently delete all tracking history?')) {
      const data = await api.get([POLICY_KEY]);
      await api.set({ 
        [EVENTS_KEY]: [], 
        [DOMAIN_STATE_KEY]: {},
        [ACTIVITY_STATE_KEY]: {},
        [RISK_STATE_KEY]: {},
        [POLICY_KEY]: { ...(data[POLICY_KEY] || DEFAULT_POLICY), last_cleanup_ts: 0 }
      });
      if (isExtensionEnv) chrome.action.setBadgeText({ text: '' });
      refreshData();
    }
  };

  const handleOverride = async (domain: string, partial: Partial<UserOverride>) => {
    if (isExtensionEnv) {
      await chrome.runtime.sendMessage({ type: 'SET_OVERRIDE', payload: { domain, overrides: partial } });
    } else {
      // Mock for simulator
      const current = overrides[domain] || { pinned: false, whitelisted: false, ignored: false, category: null, updated_ts: 0 };
      const updated = { ...current, ...partial, updated_ts: Date.now() };
      const newOverrides = { ...overrides, [domain]: updated };
      await api.set({ [USER_OVERRIDES_KEY]: newOverrides });
      refreshData();
    }
  };

  const handleRunCleanup = async () => {
    if (isExtensionEnv) {
      const response: any = await chrome.runtime.sendMessage({ type: 'RUN_CLEANUP', force: true });
      if (response?.success) refreshData();
    }
  };

  // Derived Data
  const recentEvents = useMemo(() => [...events].slice(0, 20), [events]);
  
  const riskList = useMemo(() => {
    // Combine RiskState + Overrides + ActivityState for the list
    return Object.keys(riskStates)
      .map(domain => {
        const risk = riskStates[domain];
        const override = overrides[domain];
        const activity = activityStates[domain];
        
        // Filter ignored domains (unless viewing settings/debug)
        if (override?.ignored) return null;

        return {
          domain,
          score: risk.score,
          reasons: risk.reasons,
          level: activity?.last_estimation_level,
          pinned: override?.pinned || false,
          whitelisted: override?.whitelisted || false,
          category: override?.category || null
        };
      })
      .filter(item => item !== null)
      .sort((a, b) => (b?.score || 0) - (a?.score || 0)); // Sort by Score DESC
  }, [riskStates, overrides, activityStates]);

  if (loading) return <div className="h-full flex items-center justify-center text-slate-400">Loading...</div>;

  return (
    <div className="flex flex-col h-full bg-white font-sans text-slate-900">
      
      {/* Header */}
      <div className="bg-slate-900 text-white p-4 shrink-0 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-indigo-400" />
          <h1 className="font-bold text-sm tracking-wide">PDTM <span className="text-slate-500 text-xs font-normal">v0.5</span></h1>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${settings.collectionEnabled ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300' : 'bg-amber-500/10 border-amber-500/50 text-amber-300'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${settings.collectionEnabled ? 'bg-indigo-400 animate-pulse' : 'bg-amber-400'}`} />
          {settings.collectionEnabled ? 'Active' : 'Paused'}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('recent')}
          className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'recent' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}
        >
          <Clock size={14} /> Recent
        </button>
        <button 
          onClick={() => setActiveTab('risk')}
          className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'risk' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}
        >
          <AlertTriangle size={14} /> Attention
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 text-xs font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'settings' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 bg-slate-50 hover:bg-slate-100'}`}
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
                const actState = activityStates[e.domain];
                const level = actState ? actState.last_estimation_level : "view";
                return (
                  <li key={e.ts + '_' + i} className="p-3 hover:bg-slate-50 flex items-center gap-3">
                    <div className="bg-slate-100 p-1.5 rounded text-slate-500 relative">
                      <Globe size={14} />
                      {level !== "view" && (
                         <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100">
                            {getActivityIcon(level)}
                         </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{e.domain}</div>
                      <div className="text-xs text-slate-400 font-mono">{formatTime(e.ts)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {/* TAB: ATTENTION (RISK) */}
        {activeTab === 'risk' && (
          riskList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <Shield size={32} className="mb-2 opacity-20" />
              <p className="text-sm">No significant activity analyzed yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 pb-20">
              {riskList.map((item: any) => (
                <li key={item.domain} className="p-3 hover:bg-slate-50 group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                       {/* Score Badge */}
                       <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskColor(item.score)}`}>
                         {item.score}
                       </div>
                       <div className="font-medium text-slate-800 text-sm truncate flex items-center gap-1">
                         {item.pinned && <Pin size={10} className="text-indigo-500 fill-indigo-500" />}
                         {item.domain}
                       </div>
                    </div>
                    <div className="flex items-center gap-1">
                       <button 
                         onClick={() => handleOverride(item.domain, { pinned: !item.pinned })}
                         className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${item.pinned ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}
                         title="Pin to prevent deletion"
                       >
                         <Pin size={14} />
                       </button>
                       <button 
                         onClick={() => handleOverride(item.domain, { whitelisted: !item.whitelisted })}
                         className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${item.whitelisted ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'}`}
                         title="Mark as safe (Reduce score)"
                       >
                         <CheckCircle size={14} />
                       </button>
                       <button 
                         onClick={() => handleOverride(item.domain, { ignored: true })}
                         className="p-1.5 rounded hover:bg-slate-200 text-slate-400 hover:text-red-500 transition-colors"
                         title="Ignore/Hide"
                       >
                         <EyeOff size={14} />
                       </button>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="pl-0.5 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <div className="flex items-center gap-1">
                        {getActivityIcon(item.level)}
                        <span className="capitalize">{item.level}</span>
                      </div>
                      <span className="text-slate-300">|</span>
                      {item.reasons.length > 0 ? (
                        <span className="truncate max-w-[150px]">{item.reasons.map((r:string) => r.replace('level_', '').replace('cat_', '')).join(', ')}</span>
                      ) : <span>Passive</span>}
                    </div>
                    
                    {/* Category Dropdown */}
                    <div className="flex items-center gap-2">
                      <Tag size={10} className="text-slate-400" />
                      <select 
                        className="text-[10px] bg-slate-100 border-none rounded py-0.5 px-1 text-slate-600 focus:ring-1 focus:ring-indigo-500 cursor-pointer w-24"
                        value={item.category || ''}
                        onChange={(e) => handleOverride(item.domain, { category: e.target.value || null })}
                      >
                        <option value="">No Tag</option>
                        {CATEGORY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}

        {/* TAB: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="p-4 space-y-6">
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-amber-800 text-xs">
              <h3 className="font-bold flex items-center gap-2 mb-1"><AlertTriangle size={12}/> Attention Score</h3>
              <p>Scores are estimated based on interaction depth (Transactions, Logins) and frequency. They indicate "Management Necessity", not necessarily maliciousness.</p>
            </div>
            
            <button 
                onClick={handleRunCleanup}
                className="w-full py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 flex items-center justify-center gap-2"
               >
                 <Eraser size={14} /> Run Policy Cleanup
            </button>
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
          <Trash2 size={14} /> Reset
        </button>
      </div>
    </div>
  );
};

// --- SIMULATOR TOOL ---
const DevSimulator = () => {
  const [simUrl, setSimUrl] = useState('https://www.google.com/account/login');
  
  const simulateVisit = async () => {
    try {
      const url = new URL(simUrl);
      if (!['http:', 'https:'].includes(url.protocol)) return alert('Invalid protocol');
      await chrome.webNavigation.onCompleted.dispatch({ frameId: 0, url: simUrl, timeStamp: Date.now() });
    } catch (e) {
      alert('Simulation requires running via extension context or improved mock.');
    }
  };

  return (
    <div className="absolute -right-[340px] top-0 w-[320px] bg-slate-800 p-4 rounded-lg text-white shadow-xl border border-slate-600">
      <div className="flex items-center gap-2 mb-3 text-emerald-400">
        <Construction size={16} />
        <h3 className="font-bold text-sm">Dev Simulator</h3>
      </div>
      <p className="text-xs text-slate-300 mb-3">Chapter 5: Check 'Attention' tab after visiting.</p>
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