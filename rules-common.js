// Shared utilities and rule list UI controller for Simple URL Redirector

let editingIndex = -1;
let undoTimeout = null;
let deletedRule = null;
let deletedIndex = -1;

const EDIT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 18L19.9999 19.094C19.4695 19.6741 18.7502 20 18.0002 20C17.2501 20 16.5308 19.6741 16.0004 19.094C15.4693 18.5151 14.75 18.1901 14.0002 18.1901C13.2504 18.1901 12.5312 18.5151 12 19.094M3.00003 20H4.67457C5.16376 20 5.40835 20 5.63852 19.9447C5.84259 19.8957 6.03768 19.8149 6.21663 19.7053C6.41846 19.5816 6.59141 19.4086 6.93732 19.0627L19.5001 6.49998C20.3285 5.67156 20.3285 4.32841 19.5001 3.49998C18.6716 2.67156 17.3285 2.67156 16.5001 3.49998L3.93729 16.0627C3.59139 16.4086 3.41843 16.5816 3.29475 16.7834C3.18509 16.9624 3.10428 17.1574 3.05529 17.3615C3.00003 17.5917 3.00003 17.8363 3.00003 18.3255V20Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const REMOVE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 6V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H11.2C10.0799 2 9.51984 2 9.09202 2.21799C8.71569 2.40973 8.40973 2.71569 8.21799 3.09202C8 3.51984 8 4.0799 8 5.2V6M10 11.5V16.5M14 11.5V16.5M3 6H21M19 6V17.2C19 18.8802 19 19.7202 18.673 20.362C18.3854 20.9265 17.9265 21.3854 17.362 21.673C16.7202 22 15.8802 22 14.2 22H9.8C8.11984 22 7.27976 22 6.63803 21.673C6.07354 21.3854 5.6146 20.9265 5.32698 20.362C5 19.7202 5 18.8802 5 17.2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function cleanDomain(value) {
  return (value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function saveRules(rules, callback) {
  chrome.storage.sync.set({ rules }, () => callback?.());
}

function exportRulesToJson(rules) {
  const exportData = { version: 1, exportedAt: new Date().toISOString(), rules: Array.isArray(rules) ? rules : [] };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `redirect-rules-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseAndValidateRules(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { valid: false, error: "Invalid JSON syntax." };
  }

  const rawRules = Array.isArray(parsed) ? parsed : parsed?.rules;
  if (!Array.isArray(rawRules)) {
    return { valid: false, error: "JSON file does not contain a valid rules list." };
  }

  const validRules = [];
  let invalidCount = 0;

  for (const item of rawRules) {
    if (!item || typeof item !== "object") { invalidCount++; continue; }
    const isRegex = Boolean(item.isRegex);
    let from = typeof item.from === "string" ? item.from.trim() : "";
    let to = typeof item.to === "string" ? item.to.trim() : "";
    if (!from || !to) { invalidCount++; continue; }

    if (!isRegex) {
      from = cleanDomain(from);
      to = cleanDomain(to);
      if (!from || !to) { invalidCount++; continue; }
    } else {
      try { new RegExp(from); } catch { invalidCount++; continue; }
    }

    validRules.push({ from, to, enabled: item.enabled !== false, isRegex });
  }

  if (validRules.length === 0 && rawRules.length > 0) {
    return { valid: false, error: "No valid rules found in JSON file." };
  }

  return { valid: true, rules: validRules, totalParsed: rawRules.length, invalidCount };
}

function mergeRules(existingRules = [], incomingRules = []) {
  const merged = Array.isArray(existingRules) ? [...existingRules] : [];
  const incoming = Array.isArray(incomingRules) ? incomingRules : [];
  let addedCount = 0;
  let duplicateCount = 0;

  for (const rule of incoming) {
    const isDup = merged.some(
      (r) => r.from.toLowerCase() === rule.from.toLowerCase() && Boolean(r.isRegex) === Boolean(rule.isRegex)
    );
    if (isDup) {
      duplicateCount++;
    } else {
      merged.push(rule);
      addedCount++;
    }
  }

  return { mergedRules: merged, addedCount, duplicateCount };
}

function showToast(toastEl) {
  if (!toastEl) return;
  toastEl.style.display = "flex";
  clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => hideToast(toastEl), 5000);
}

function hideToast(toastEl) {
  if (!toastEl) return;
  toastEl.style.display = "none";
  deletedRule = null;
}

function resetEditMode(elements) {
  editingIndex = -1;
  if (elements.addBtn) elements.addBtn.textContent = "Add rule";
  if (elements.cancelEditBtn) elements.cancelEditBtn.style.display = "none";

  [elements.fromInput, elements.toInput, elements.regexFromInput, elements.regexToInput, elements.regexTestInput].forEach(
    (el) => el && (el.value = "")
  );
  elements.regexFromInput?.classList.remove("error");
  if (elements.regexTestResult) {
    elements.regexTestResult.textContent = "";
    elements.regexTestResult.className = "test-result";
  }
}

function createEl(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  children.flat().forEach((child) => {
    if (child) el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  });
  return el;
}

function renderRuleList(rules, elements, onUpdate) {
  if (!elements.ruleList) return;
  elements.ruleList.innerHTML = "";

  const isEmpty = rules.length === 0;
  if (elements.emptyState) elements.emptyState.style.display = isEmpty ? "block" : "none";
  if (elements.emptyMsg) elements.emptyMsg.style.display = isEmpty ? "block" : "none";

  rules.forEach((rule, index) => {
    const toggleInput = createEl("input", { type: "checkbox", checked: rule.enabled !== false });
    toggleInput.addEventListener("change", () => {
      rule.enabled = toggleInput.checked;
      saveRules(rules, onUpdate);
    });

    const editBtn = createEl("button", { className: "edit", innerHTML: EDIT_ICON, title: "Edit rule" });
    editBtn.addEventListener("click", () => {
      editingIndex = index;
      if (elements.advancedToggle) {
        elements.advancedToggle.checked = Boolean(rule.isRegex);
        elements.advancedToggle.dispatchEvent(new Event("change"));
      }
      if (rule.isRegex) {
        if (elements.regexFromInput) elements.regexFromInput.value = rule.from;
        if (elements.regexToInput) elements.regexToInput.value = rule.to;
      } else {
        if (elements.fromInput) elements.fromInput.value = rule.from;
        if (elements.toInput) elements.toInput.value = rule.to;
      }
      if (elements.addBtn) elements.addBtn.textContent = "Save edit";
      if (elements.cancelEditBtn) elements.cancelEditBtn.style.display = "block";
    });

    const removeBtn = createEl("button", { className: "remove", innerHTML: REMOVE_ICON, title: "Remove rule" });
    removeBtn.addEventListener("click", () => {
      deletedRule = rules[index];
      deletedIndex = index;
      rules.splice(index, 1);
      saveRules(rules, onUpdate);
      showToast(elements.toast);

      if (editingIndex === index) resetEditMode(elements);
      else if (editingIndex > index) editingIndex--;
    });

    const li = createEl(
      "li",
      { className: "rule" },
      createEl("label", { className: "mini-switch" }, toggleInput, createEl("span", { className: "mini-slider" })),
      createEl(
        "div",
        { className: "from-to" },
        createEl("span", { className: "domain from", textContent: rule.isRegex ? `Regex: ${rule.from}` : rule.from, title: rule.from }),
        createEl("span", { className: "arrow", textContent: "to" }),
        createEl("span", { className: "domain to", textContent: rule.isRegex ? `Subst: ${rule.to}` : rule.to, title: rule.to })
      ),
      editBtn,
      removeBtn
    );

    elements.ruleList.appendChild(li);
  });
}

function addRuleFromInputs(elements, onUpdate) {
  const isAdvanced = Boolean(elements.advancedToggle?.checked);
  let from = "", to = "";

  if (isAdvanced) {
    try { new RegExp(elements.regexFromInput.value); } catch { return; }
    from = elements.regexFromInput.value.trim();
    to = elements.regexToInput.value.trim();
  } else {
    from = cleanDomain(elements.fromInput.value);
    to = cleanDomain(elements.toInput.value);
  }

  if (!from || !to) return;

  chrome.storage.sync.get(["rules"], (data) => {
    const rules = Array.isArray(data.rules) ? data.rules : [];
    const newRule = { from, to, enabled: true, isRegex: isAdvanced };

    if (editingIndex >= 0 && editingIndex < rules.length) {
      rules[editingIndex] = { ...newRule, enabled: rules[editingIndex].enabled };
    } else {
      rules.push(newRule);
    }

    saveRules(rules, onUpdate);
    resetEditMode(elements);
    if (!isAdvanced) elements.fromInput?.focus();
  });
}

function validateRegexInputs(elements) {
  if (!elements.regexFromInput) return;
  const pattern = elements.regexFromInput.value;
  const testUrl = elements.regexTestInput?.value ?? "";

  elements.regexFromInput.classList.remove("error");
  if (elements.regexTestResult) {
    elements.regexTestResult.textContent = "";
    elements.regexTestResult.className = "test-result";
  }

  if (!pattern) return;

  let regex;
  try {
    regex = new RegExp(pattern);
  } catch {
    elements.regexFromInput.classList.add("error");
    if (elements.regexTestResult) {
      elements.regexTestResult.textContent = "Invalid regular expression";
      elements.regexTestResult.classList.add("no-match");
    }
    return;
  }

  if (testUrl && elements.regexTestResult) {
    if (regex.test(testUrl)) {
      const toPattern = elements.regexToInput?.value ?? "";
      let replaced = "";
      try { replaced = testUrl.replace(regex, toPattern); } catch {}
      elements.regexTestResult.textContent = replaced ? `Match! -> ${replaced}` : "Match!";
      elements.regexTestResult.classList.add("match");
    } else {
      elements.regexTestResult.textContent = "No match";
      elements.regexTestResult.classList.add("no-match");
    }
  }
}

function setupUndoButton(elements, onUpdate) {
  elements.undoBtn?.addEventListener("click", () => {
    if (!deletedRule) return;
    chrome.storage.sync.get(["rules"], (data) => {
      const rules = Array.isArray(data.rules) ? data.rules : [];
      rules.splice(deletedIndex, 0, deletedRule);
      saveRules(rules, onUpdate);
      hideToast(elements.toast);
    });
  });
}

function setSegmentedChecked(checkbox, targetChecked) {
  if (checkbox.checked !== targetChecked) {
    checkbox.checked = targetChecked;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function setupSegmentedControls() {
  document.querySelectorAll(".segmented-control").forEach((control) => {
    const checkbox = control.querySelector('input[type="checkbox"]');
    if (!checkbox) return;

    control.querySelector(".segment-simple")?.addEventListener("click", (e) => {
      e.stopPropagation();
      setSegmentedChecked(checkbox, false);
    });

    control.querySelector(".segment-advanced")?.addEventListener("click", (e) => {
      e.stopPropagation();
      setSegmentedChecked(checkbox, true);
    });

    control.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") setSegmentedChecked(checkbox, false);
      else if (e.key === "ArrowRight") setSegmentedChecked(checkbox, true);
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setSegmentedChecked(checkbox, !checkbox.checked);
      }
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupSegmentedControls);
} else {
  setupSegmentedControls();
}
