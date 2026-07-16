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

async function getState() {
  const data = await chrome.storage.sync.get([RULES_KEY, ENABLED_KEY]);
  return {
    rules: Array.isArray(data[RULES_KEY]) ? data[RULES_KEY] : [],
    enabled: data[ENABLED_KEY] !== false
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
    rebuildRules();
  }
});
