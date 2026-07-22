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
      if (enabled && rules.length > 0) {
        rewriteAnchors(document);
      }
    });
  }

  loadAndRun();

  chrome.runtime.sendMessage({ type: "CHECK_REDIRECT" }, (response) => {
    if (response && response.redirected && response.rule) {
      showNotification(response.rule);
    }
  });

  function showNotification(rule) {
    const div = document.createElement('div');
    Object.assign(div.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%) translateY(-20px)',
      background: '#1b1f27',
      color: '#e7e9ee',
      border: '1px solid #2a2f3a',
      padding: '8px 16px',
      borderRadius: '999px',
      fontSize: '13px',
      fontWeight: '500',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: '2147483647',
      opacity: '0',
      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    });

    const iconWrapper = document.createElement('span');
    Object.assign(iconWrapper.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    });
    iconWrapper.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style="width: 16px; height: 16px; fill: #6c8ef5;"><path d="M528 320C528 205.1 434.9 112 320 112C205.1 112 112 205.1 112 320C112 434.9 205.1 528 320 528C434.9 528 528 434.9 528 320zM64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320zM241.3 383.4C256.3 399 282.4 416 320 416C357.6 416 383.7 399 398.7 383.4C407.9 373.8 423.1 373.5 432.6 382.7C442.1 391.9 442.5 407.1 433.3 416.6C411.2 439.6 373.3 464 320 464C266.7 464 228.8 439.6 206.7 416.6C197.5 407 197.8 391.8 207.4 382.7C217 373.6 232.2 373.8 241.3 383.4zM208 272C208 254.3 222.3 240 240 240C257.7 240 272 254.3 272 272C272 289.7 257.7 304 240 304C222.3 304 208 289.7 208 272zM372 280C372 291 363 300 352 300C341 300 332 291 332 280C332 246.9 358.9 220 392 220L408 220C441.1 220 468 246.9 468 280C468 291 459 300 448 300C437 300 428 291 428 280C428 269 419 260 408 260L392 260C381 260 372 269 372 280z"/></svg>`;

    const text = document.createElement('span');
    let fromText = rule.from;
    if (rule.isRegex) {
      fromText = "matched rule";
    }
    text.textContent = `Redirected from ${fromText}`;

    div.appendChild(iconWrapper);
    div.appendChild(text);
    document.body.appendChild(div);

    div.offsetHeight; // trigger reflow

    div.style.opacity = '1';
    div.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
      div.style.opacity = '0';
      div.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => div.remove(), 300);
    }, 4000);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.rules || changes.enabled)) {
      loadAndRun();
    }
  });

  let frameScheduled = false;
  const pendingElements = new Set();

  function processPendingElements() {
    frameScheduled = false;
    if (!enabled || rules.length === 0 || pendingElements.size === 0) {
      pendingElements.clear();
      return;
    }
    pendingElements.forEach((node) => {
      rewriteAnchors(node);
    });
    pendingElements.clear();
  }

  const observer = new MutationObserver((mutations) => {
    if (!enabled || rules.length === 0) return;
    let hasAddedElements = false;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === 1) {
          pendingElements.add(node);
          hasAddedElements = true;
        }
      }
    }
    if (hasAddedElements && !frameScheduled) {
      frameScheduled = true;
      requestAnimationFrame(processPendingElements);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
