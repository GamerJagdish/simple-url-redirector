// Shared utilities and rule list UI controller for Simple URL Redirector

function cleanDomain(value) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

let editingIndex = -1;
let undoTimeout = null;
let deletedRule = null;
let deletedIndex = -1;

function exportRulesToJson(rules) {
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    rules: Array.isArray(rules) ? rules : []
  };
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `redirect-rules-${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseAndValidateRules(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    return { valid: false, error: "Invalid JSON syntax." };
  }

  let rawRules = [];
  if (Array.isArray(parsed)) {
    rawRules = parsed;
  } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.rules)) {
    rawRules = parsed.rules;
  } else {
    return { valid: false, error: "JSON file does not contain a valid rules list." };
  }

  const validRules = [];
  let invalidCount = 0;

  for (const item of rawRules) {
    if (!item || typeof item !== "object") {
      invalidCount++;
      continue;
    }

    const isRegex = Boolean(item.isRegex);
    let from = typeof item.from === "string" ? item.from.trim() : "";
    let to = typeof item.to === "string" ? item.to.trim() : "";

    if (!from || !to) {
      invalidCount++;
      continue;
    }

    if (!isRegex) {
      from = cleanDomain(from);
      to = cleanDomain(to);
      if (!from || !to) {
        invalidCount++;
        continue;
      }
    } else {
      try {
        new RegExp(from);
      } catch (e) {
        invalidCount++;
        continue;
      }
    }

    const enabled = item.enabled !== false;
    validRules.push({ from, to, enabled, isRegex });
  }

  if (validRules.length === 0 && rawRules.length > 0) {
    return { valid: false, error: "No valid rules found in JSON file." };
  }

  return {
    valid: true,
    rules: validRules,
    totalParsed: rawRules.length,
    invalidCount
  };
}

function mergeRules(existingRules, incomingRules) {
  const current = Array.isArray(existingRules) ? [...existingRules] : [];
  const incoming = Array.isArray(incomingRules) ? incomingRules : [];

  let addedCount = 0;
  let duplicateCount = 0;

  const merged = [...current];

  for (const newRule of incoming) {
    const isDuplicate = merged.some(
      (r) => r.from.toLowerCase() === newRule.from.toLowerCase() && Boolean(r.isRegex) === Boolean(newRule.isRegex)
    );

    if (isDuplicate) {
      duplicateCount++;
    } else {
      merged.push(newRule);
      addedCount++;
    }
  }

  return {
    mergedRules: merged,
    addedCount,
    duplicateCount
  };
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
  if (elements.fromInput) elements.fromInput.value = "";
  if (elements.toInput) elements.toInput.value = "";
  if (elements.regexFromInput) {
    elements.regexFromInput.value = "";
    elements.regexFromInput.classList.remove("error");
  }
  if (elements.regexToInput) elements.regexToInput.value = "";
  if (elements.regexTestInput) elements.regexTestInput.value = "";
  if (elements.regexTestResult) {
    elements.regexTestResult.textContent = "";
    elements.regexTestResult.className = "test-result";
  }
}

function saveRules(rules, callback) {
  chrome.storage.sync.set({ rules }, () => {
    if (typeof callback === "function") callback();
  });
}

function renderRuleList(rules, elements, onUpdate) {
  if (!elements.ruleList) return;
  elements.ruleList.innerHTML = "";

  if (elements.emptyState) {
    elements.emptyState.style.display = rules.length === 0 ? "block" : "none";
  }
  if (elements.emptyMsg) {
    elements.emptyMsg.style.display = rules.length === 0 ? "block" : "none";
  }

  rules.forEach((rule, index) => {
    const li = document.createElement("li");
    li.className = "rule";

    const toggleWrap = document.createElement("label");
    toggleWrap.className = "mini-switch";
    const toggleInput = document.createElement("input");
    toggleInput.type = "checkbox";
    toggleInput.checked = rule.enabled !== false;
    toggleInput.addEventListener("change", () => {
      rule.enabled = toggleInput.checked;
      saveRules(rules, onUpdate);
    });
    const toggleSlider = document.createElement("span");
    toggleSlider.className = "mini-slider";
    toggleWrap.appendChild(toggleInput);
    toggleWrap.appendChild(toggleSlider);

    const fromTo = document.createElement("div");
    fromTo.className = "from-to";
    const fromEl = document.createElement("span");
    fromEl.className = "domain from";
    fromEl.textContent = rule.isRegex ? `Regex: ${rule.from}` : rule.from;
    fromEl.title = rule.from;
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = "to";
    const toEl = document.createElement("span");
    toEl.className = "domain to";
    toEl.textContent = rule.isRegex ? `Subst: ${rule.to}` : rule.to;
    toEl.title = rule.to;
    fromTo.appendChild(fromEl);
    fromTo.appendChild(arrow);
    fromTo.appendChild(toEl);

    const editBtn = document.createElement("button");
    editBtn.className = "edit";
    editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 18L19.9999 19.094C19.4695 19.6741 18.7502 20 18.0002 20C17.2501 20 16.5308 19.6741 16.0004 19.094C15.4693 18.5151 14.75 18.1901 14.0002 18.1901C13.2504 18.1901 12.5312 18.5151 12 19.094M3.00003 20H4.67457C5.16376 20 5.40835 20 5.63852 19.9447C5.84259 19.8957 6.03768 19.8149 6.21663 19.7053C6.41846 19.5816 6.59141 19.4086 6.93732 19.0627L19.5001 6.49998C20.3285 5.67156 20.3285 4.32841 19.5001 3.49998C18.6716 2.67156 17.3285 2.67156 16.5001 3.49998L3.93729 16.0627C3.59139 16.4086 3.41843 16.5816 3.29475 16.7834C3.18509 16.9624 3.10428 17.1574 3.05529 17.3615C3.00003 17.5917 3.00003 17.8363 3.00003 18.3255V20Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    editBtn.title = "Edit rule";
    editBtn.addEventListener("click", () => {
      editingIndex = index;
      if (elements.advancedToggle) {
        elements.advancedToggle.checked = rule.isRegex;
        elements.advancedToggle.dispatchEvent(new Event('change'));
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

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove";
    removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 6V5.2C16 4.0799 16 3.51984 15.782 3.09202C15.5903 2.71569 15.2843 2.40973 14.908 2.21799C14.4802 2 13.9201 2 12.8 2H11.2C10.0799 2 9.51984 2 9.09202 2.21799C8.71569 2.40973 8.40973 2.71569 8.21799 3.09202C8 3.51984 8 4.0799 8 5.2V6M10 11.5V16.5M14 11.5V16.5M3 6H21M19 6V17.2C19 18.8802 19 19.7202 18.673 20.362C18.3854 20.9265 17.9265 21.3854 17.362 21.673C16.7202 22 15.8802 22 14.2 22H9.8C8.11984 22 7.27976 22 6.63803 21.673C6.07354 21.3854 5.6146 20.9265 5.32698 20.362C5 19.7202 5 18.8802 5 17.2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    removeBtn.title = "Remove rule";
    removeBtn.addEventListener("click", () => {
      deletedRule = rules[index];
      deletedIndex = index;
      rules.splice(index, 1);
      saveRules(rules, onUpdate);
      showToast(elements.toast);

      if (editingIndex === index) {
        resetEditMode(elements);
      } else if (editingIndex > index) {
        editingIndex--;
      }
    });

    li.appendChild(toggleWrap);
    li.appendChild(fromTo);
    li.appendChild(editBtn);
    li.appendChild(removeBtn);
    elements.ruleList.appendChild(li);
  });
}

function addRuleFromInputs(elements, onUpdate) {
  const isAdvanced = elements.advancedToggle ? elements.advancedToggle.checked : false;
  let from, to;

  if (isAdvanced) {
    try {
      new RegExp(elements.regexFromInput.value);
    } catch(e) {
      return;
    }
    from = elements.regexFromInput.value.trim();
    to = elements.regexToInput.value.trim();
  } else {
    from = cleanDomain(elements.fromInput.value);
    to = cleanDomain(elements.toInput.value);
  }

  if (!from || !to) return;

  chrome.storage.sync.get(["rules"], (data) => {
    const rules = Array.isArray(data.rules) ? data.rules : [];

    if (editingIndex >= 0 && editingIndex < rules.length) {
      rules[editingIndex] = { from, to, enabled: rules[editingIndex].enabled, isRegex: isAdvanced };
    } else {
      rules.push({ from, to, enabled: true, isRegex: isAdvanced });
    }

    saveRules(rules, onUpdate);
    resetEditMode(elements);
    if (!isAdvanced && elements.fromInput) {
      elements.fromInput.focus();
    }
  });
}

function validateRegexInputs(elements) {
  if (!elements.regexFromInput) return;
  const pattern = elements.regexFromInput.value;
  const testUrl = elements.regexTestInput ? elements.regexTestInput.value : "";
  let regex = null;

  elements.regexFromInput.classList.remove("error");
  if (elements.regexTestResult) {
    elements.regexTestResult.textContent = "";
    elements.regexTestResult.className = "test-result";
  }

  if (!pattern) return;

  try {
    regex = new RegExp(pattern);
  } catch (e) {
    elements.regexFromInput.classList.add("error");
    if (elements.regexTestResult) {
      elements.regexTestResult.textContent = "Invalid regular expression";
      elements.regexTestResult.classList.add("no-match");
    }
    return;
  }

  if (testUrl && elements.regexTestResult) {
    if (regex.test(testUrl)) {
      const toPattern = elements.regexToInput ? elements.regexToInput.value : "";
      let replaced = "";
      try {
        replaced = testUrl.replace(regex, toPattern);
      } catch(e) {}
      elements.regexTestResult.textContent = replaced ? `Match! -> ${replaced}` : "Match!";
      elements.regexTestResult.classList.add("match");
    } else {
      elements.regexTestResult.textContent = "No match";
      elements.regexTestResult.classList.add("no-match");
    }
  }
}

function setupUndoButton(elements, onUpdate) {
  if (!elements.undoBtn) return;
  elements.undoBtn.addEventListener("click", () => {
    if (deletedRule) {
      chrome.storage.sync.get(["rules"], (data) => {
        const rules = Array.isArray(data.rules) ? data.rules : [];
        rules.splice(deletedIndex, 0, deletedRule);
        saveRules(rules, onUpdate);
        hideToast(elements.toast);
      });
    }
  });
}

function setupSegmentedControls() {
  document.querySelectorAll(".segmented-control").forEach((control) => {
    const checkbox = control.querySelector('input[type="checkbox"]');
    if (!checkbox) return;

    const simpleBtn = control.querySelector(".segment-simple");
    const advancedBtn = control.querySelector(".segment-advanced");

    if (simpleBtn) {
      simpleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (checkbox.checked) {
          checkbox.checked = false;
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    if (advancedBtn) {
      advancedBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    control.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        if (checkbox.checked) {
          checkbox.checked = false;
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else if (e.key === "ArrowRight") {
        if (!checkbox.checked) {
          checkbox.checked = true;
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupSegmentedControls);
} else {
  setupSegmentedControls();
}

