const elements = {
  masterToggle: document.getElementById("masterToggle"),
  ruleCount: document.getElementById("ruleCount"),
  emptyState: document.getElementById("emptyState"),
  openOptions: document.getElementById("openOptions"),
  advancedToggle: document.getElementById("advancedToggle"),
  simpleInputs: document.getElementById("simpleInputs"),
  advancedInputs: document.getElementById("advancedInputs"),
  fromInput: document.getElementById("fromInput"),
  toInput: document.getElementById("toInput"),
  regexFromInput: document.getElementById("regexFromInput"),
  regexToInput: document.getElementById("regexToInput"),
  regexTestInput: document.getElementById("regexTestInput"),
  regexTestResult: document.getElementById("regexTestResult"),
  addBtn: document.getElementById("addBtn"),
  ruleList: document.getElementById("ruleList"),
  toast: document.getElementById("toast"),
  undoBtn: document.getElementById("undoBtn")
};

function loadRules() {
  chrome.storage.sync.get(["rules", "enabled"], (data) => {
    const rules = Array.isArray(data.rules) ? data.rules : [];
    const activeRules = rules.filter((r) => r.from && r.to && r.enabled !== false);
    if (elements.masterToggle) elements.masterToggle.checked = data.enabled !== false;
    if (elements.ruleCount) {
      elements.ruleCount.textContent = `${activeRules.length} rule${activeRules.length === 1 ? "" : "s"} active`;
    }
    renderRuleList(rules, elements, loadRules);
  });
}

if (elements.masterToggle) {
  elements.masterToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ enabled: elements.masterToggle.checked });
  });
}

if (elements.openOptions) {
  elements.openOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

if (elements.advancedToggle) {
  elements.advancedToggle.addEventListener("change", () => {
    elements.simpleInputs.style.display = elements.advancedToggle.checked ? "none" : "grid";
    elements.advancedInputs.style.display = elements.advancedToggle.checked ? "grid" : "none";
  });
}

if (elements.addBtn) {
  elements.addBtn.addEventListener("click", () => addRuleFromInputs(elements, loadRules));
}

if (elements.regexFromInput) elements.regexFromInput.addEventListener("input", () => validateRegexInputs(elements));
if (elements.regexToInput) elements.regexToInput.addEventListener("input", () => validateRegexInputs(elements));
if (elements.regexTestInput) elements.regexTestInput.addEventListener("input", () => validateRegexInputs(elements));

[elements.fromInput, elements.toInput, elements.regexFromInput, elements.regexToInput].forEach((input) => {
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addRuleFromInputs(elements, loadRules);
    });
  }
});

setupUndoButton(elements, loadRules);

document.addEventListener("DOMContentLoaded", loadRules);
chrome.storage.onChanged.addListener(loadRules);
