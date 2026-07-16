const masterToggle = document.getElementById("masterToggle");
const ruleCount = document.getElementById("ruleCount");
const emptyState = document.getElementById("emptyState");
const openOptions = document.getElementById("openOptions");
const advancedToggle = document.getElementById("advancedToggle");
const simpleInputs = document.getElementById("simpleInputs");
const advancedInputs = document.getElementById("advancedInputs");
const fromInput = document.getElementById("fromInput");
const toInput = document.getElementById("toInput");
const regexFromInput = document.getElementById("regexFromInput");
const regexToInput = document.getElementById("regexToInput");
const addBtn = document.getElementById("addBtn");
const ruleList = document.getElementById("ruleList");

function cleanDomain(value) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

function loadRules() {
  chrome.storage.sync.get(["rules", "enabled"], (data) => {
    const rules = Array.isArray(data.rules) ? data.rules : [];
    const activeRules = rules.filter((r) => r.from && r.to && r.enabled !== false);
    masterToggle.checked = data.enabled !== false;
    ruleCount.textContent = `${activeRules.length} rule${activeRules.length === 1 ? "" : "s"} active`;
    emptyState.style.display = rules.length === 0 ? "block" : "none";
    render(rules);
  });
}

function saveRules(rules) {
  chrome.storage.sync.set({ rules }, () => loadRules());
}

function render(rules) {
  ruleList.innerHTML = "";

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
      saveRules(rules);
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

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove";
    removeBtn.textContent = "✕";
    removeBtn.title = "Remove rule";
    removeBtn.addEventListener("click", () => {
      rules.splice(index, 1);
      saveRules(rules);
    });

    li.appendChild(toggleWrap);
    li.appendChild(fromTo);
    li.appendChild(removeBtn);
    ruleList.appendChild(li);
  });
}

function addRule() {
  const isAdvanced = advancedToggle.checked;
  let from, to;

  if (isAdvanced) {
    from = regexFromInput.value.trim();
    to = regexToInput.value.trim();
  } else {
    from = cleanDomain(fromInput.value);
    to = cleanDomain(toInput.value);
  }

  if (!from || !to) return;

  chrome.storage.sync.get(["rules"], (data) => {
    const rules = Array.isArray(data.rules) ? data.rules : [];
    rules.push({ from, to, enabled: true, isRegex: isAdvanced });
    saveRules(rules);
    if (isAdvanced) {
      regexFromInput.value = "";
      regexToInput.value = "";
    } else {
      fromInput.value = "";
      toInput.value = "";
      fromInput.focus();
    }
  });
}

masterToggle.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: masterToggle.checked });
});

openOptions.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

advancedToggle.addEventListener("change", () => {
  simpleInputs.style.display = advancedToggle.checked ? "none" : "grid";
  advancedInputs.style.display = advancedToggle.checked ? "grid" : "none";
});

addBtn.addEventListener("click", addRule);
[fromInput, toInput, regexFromInput, regexToInput].forEach((input) => {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addRule();
  });
});

document.addEventListener("DOMContentLoaded", loadRules);
chrome.storage.onChanged.addListener(loadRules);
