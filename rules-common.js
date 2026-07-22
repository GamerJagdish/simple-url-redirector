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
    editBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
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
    removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
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

