(function () {
  let rules = [];
  let enabled = true;

  function normalizeDomain(d) {
    return d.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "").toLowerCase();
  }

  function rewriteAnchors(root) {
    if (!enabled || rules.length === 0) return;
    const anchors = root.querySelectorAll ? root.querySelectorAll("a[href]") : [];
    anchors.forEach((a) => {
      let url;
      try {
        url = new URL(a.href, location.href);
      } catch (e) {
        return;
      }
      
      let newHref = null;
      
      for (const rule of rules) {
        if (!rule.from || !rule.to || rule.enabled === false) continue;
        
        if (rule.isRegex) {
          try {
            const regex = new RegExp(rule.from);
            const match = a.href.match(regex);
            if (match) {
              newHref = a.href.replace(regex, rule.to);
              break;
            }
          } catch (e) {
            continue;
          }
        } else {
          const host = url.hostname.replace(/^www\./i, "").toLowerCase();
          if (host === normalizeDomain(rule.from)) {
            url.hostname = normalizeDomain(rule.to);
            newHref = url.toString();
            break;
          }
        }
      }
      
      if (newHref && a.href !== newHref) {
        a.href = newHref;
      }
    });
  }

  function loadAndRun() {
    chrome.storage.sync.get(["rules", "enabled"], (data) => {
      rules = Array.isArray(data.rules) ? data.rules : [];
      enabled = data.enabled !== false;
      rewriteAnchors(document);
    });
  }

  loadAndRun();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.rules || changes.enabled)) {
      loadAndRun();
    }
  });

  const observer = new MutationObserver((mutations) => {
    if (!enabled || rules.length === 0) return;
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) rewriteAnchors(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
