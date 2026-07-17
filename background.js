const RULES_KEY = "rules";
const ENABLED_KEY = "enabled";

function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilter(fromDomain) {
  const clean = fromDomain.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const esc = escapeForRegex(clean.replace(/^www\./i, ""));
  return `^https?:\\/\\/(www\\.)?${esc}(\\/.*)?$`;
}

function buildSubstitution(toDomain) {
  const clean = toDomain.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const target = clean.replace(/^www\./i, "");
  return `https://${target}\\2`;
}

let cachedRules = [];
let cachedEnabled = true;
let isCacheInitialized = false;

async function getState() {
  if (!isCacheInitialized) {
    const data = await chrome.storage.sync.get([RULES_KEY, ENABLED_KEY]);
    cachedRules = Array.isArray(data[RULES_KEY]) ? data[RULES_KEY] : [];
    cachedEnabled = data[ENABLED_KEY] !== false;
    isCacheInitialized = true;
  }
  return {
    rules: cachedRules,
    enabled: cachedEnabled
  };
}

async function rebuildRules() {
  const { rules, enabled } = await getState();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((r) => r.id);

  const addRules = [];

  if (enabled) {
    rules.forEach((rule, index) => {
      if (!rule || !rule.from || !rule.to || rule.enabled === false) return;
      
      let regexFilter, regexSubstitution;
      
      if (rule.isRegex) {
        regexFilter = rule.from;
        regexSubstitution = rule.to;
      } else {
        regexFilter = buildFilter(rule.from);
        regexSubstitution = buildSubstitution(rule.to);
      }

      addRules.push({
        id: index + 1,
        priority: 1,
        action: {
          type: "redirect",
          redirect: {
            regexSubstitution
          }
        },
        condition: {
          regexFilter,
          resourceTypes: ["main_frame", "sub_frame"]
        }
      });
    });
  }

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules
  });
}

chrome.runtime.onInstalled.addListener(rebuildRules);
chrome.runtime.onStartup.addListener(rebuildRules);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes[RULES_KEY] || changes[ENABLED_KEY])) {
    if (changes[RULES_KEY]) {
      cachedRules = Array.isArray(changes[RULES_KEY].newValue) ? changes[RULES_KEY].newValue : [];
    }
    if (changes[ENABLED_KEY]) {
      cachedEnabled = changes[ENABLED_KEY].newValue !== false;
    }
    isCacheInitialized = true;
    rebuildRules();
  }
});

function isMatch(url, rule) {
  if (!rule.from || !rule.to || rule.enabled === false) return false;
  if (rule.isRegex) {
    try {
      const regex = new RegExp(rule.from);
      return regex.test(url);
    } catch (e) {
      return false;
    }
  } else {
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname.replace(/^www\./i, "").toLowerCase();
      const fromHost = rule.from.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "").toLowerCase();
      return host === fromHost || host === `www.${fromHost}`;
    } catch (e) {
      return false;
    }
  }
}

let pendingRedirects = {}; 
let confirmedRedirects = {}; 

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId === 0) {
    const { rules, enabled } = await getState();
    if (!enabled) return;
    
    for (const rule of rules) {
      if (isMatch(details.url, rule)) {
        pendingRedirects[details.tabId] = { rule, time: Date.now() };
        break;
      }
    }
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) {
    const pending = pendingRedirects[details.tabId];
    if (pending && Date.now() - pending.time < 5000) {
      confirmedRedirects[details.tabId] = pending.rule;
      delete pendingRedirects[details.tabId];
    } else {
      delete confirmedRedirects[details.tabId];
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CHECK_REDIRECT") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId && confirmedRedirects[tabId]) {
      sendResponse({ redirected: true, rule: confirmedRedirects[tabId] });
      delete confirmedRedirects[tabId]; 
    } else {
      sendResponse({ redirected: false });
    }
  }
});
