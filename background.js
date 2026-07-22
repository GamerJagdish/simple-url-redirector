const RULES_KEY = "rules";
const ENABLED_KEY = "enabled";

function cleanDomain(str) {
  return str.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "").replace(/^www\./i, "").toLowerCase();
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

      if (rule.isRegex) {
        addRules.push({
          id: index + 1,
          priority: 1,
          action: {
            type: "redirect",
            redirect: {
              regexSubstitution: rule.to
            }
          },
          condition: {
            regexFilter: rule.from,
            resourceTypes: ["main_frame", "sub_frame"]
          }
        });
      } else {
        const cleanFrom = cleanDomain(rule.from);
        const cleanTo = cleanDomain(rule.to);
        if (!cleanFrom || !cleanTo) return;

        addRules.push({
          id: index + 1,
          priority: 1,
          action: {
            type: "redirect",
            redirect: {
              transform: {
                host: cleanTo
              }
            }
          },
          condition: {
            urlFilter: `||${cleanFrom}^`,
            resourceTypes: ["main_frame", "sub_frame"]
          }
        });
      }
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

function isRuleMatch(url, rule) {
  if (!rule.from || !rule.to || rule.enabled === false) return false;
  if (rule.isRegex) {
    try {
      return new RegExp(rule.from).test(url);
    } catch (e) {
      return false;
    }
  } else {
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname.replace(/^www\./i, "").toLowerCase();
      const fromHost = cleanDomain(rule.from);
      return host === fromHost || host === `www.${fromHost}`;
    } catch (e) {
      return false;
    }
  }
}

const pendingNotifications = new Map();

chrome.webRequest.onBeforeRedirect.addListener(
  async (details) => {
    if (details.tabId >= 0 && details.type === "main_frame") {
      const { rules, enabled } = await getState();
      if (!enabled) return;

      const matched = rules.find((r) => isRuleMatch(details.url, r));
      if (matched) {
        pendingNotifications.set(details.tabId, { rule: matched, time: Date.now() });
      }
    }
  },
  { urls: ["<all_urls>"] }
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CHECK_REDIRECT") {
    const tabId = sender.tab && sender.tab.id;
    if (tabId && pendingNotifications.has(tabId)) {
      const item = pendingNotifications.get(tabId);
      pendingNotifications.delete(tabId);
      if (Date.now() - item.time < 10000) {
        sendResponse({ redirected: true, rule: item.rule });
        return true;
      }
    }
    sendResponse({ redirected: false });
  }
  return true;
});
