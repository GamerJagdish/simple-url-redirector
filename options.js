const elements = {
  fromInput: document.getElementById("fromInput"),
  toInput: document.getElementById("toInput"),
  regexFromInput: document.getElementById("regexFromInput"),
  regexToInput: document.getElementById("regexToInput"),
  regexTestInput: document.getElementById("regexTestInput"),
  regexTestResult: document.getElementById("regexTestResult"),
  addBtn: document.getElementById("addBtn"),
  ruleList: document.getElementById("ruleList"),
  emptyMsg: document.getElementById("emptyMsg"),
  advancedToggle: document.getElementById("advancedToggle"),
  simpleInputs: document.getElementById("simpleInputs"),
  advancedInputs: document.getElementById("advancedInputs"),
  toast: document.getElementById("toast"),
  undoBtn: document.getElementById("undoBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importBtn: document.getElementById("importBtn"),
  importFile: document.getElementById("importFile"),
  importUrlBtn: document.getElementById("importUrlBtn"),
  urlImportModal: document.getElementById("urlImportModal"),
  importUrlInput: document.getElementById("importUrlInput"),
  importUrlError: document.getElementById("importUrlError"),
  urlModalCancelBtn: document.getElementById("urlModalCancelBtn"),
  urlModalFetchBtn: document.getElementById("urlModalFetchBtn"),
  importModal: document.getElementById("importModal"),
  modalTotalCount: document.getElementById("modalTotalCount"),
  modalNewCount: document.getElementById("modalNewCount"),
  modalDuplicateCount: document.getElementById("modalDuplicateCount"),
  modalCancelBtn: document.getElementById("modalCancelBtn"),
  modalReplaceBtn: document.getElementById("modalReplaceBtn"),
  modalMergeBtn: document.getElementById("modalMergeBtn")
};

function showNotificationToast(message) {
  if (!elements.toast) return;
  elements.toast.style.display = "flex";
  const toastMsg = document.getElementById("toastMsg");
  if (toastMsg) toastMsg.textContent = message;
  if (elements.undoBtn) elements.undoBtn.style.display = "none";
  setTimeout(() => {
    hideToast(elements.toast);
    if (elements.undoBtn) elements.undoBtn.style.display = "block";
    if (toastMsg) toastMsg.textContent = "Rule deleted.";
  }, 3500);
}

function loadRules() {
  chrome.storage.sync.get(["rules"], (data) => {
    const rules = Array.isArray(data.rules) ? data.rules : [];
    renderRuleList(rules, elements, loadRules);
  });
}

if (elements.exportBtn) {
  elements.exportBtn.addEventListener("click", () => {
    chrome.storage.sync.get(["rules"], (data) => {
      const rules = Array.isArray(data.rules) ? data.rules : [];
      if (rules.length === 0) {
        showNotificationToast("No rules to export.");
        return;
      }
      exportRulesToJson(rules);
      showNotificationToast(`Exported ${rules.length} rule${rules.length === 1 ? "" : "s"}.`);
    });
  });
}

let pendingImportRules = null;

function hideImportModal() {
  if (elements.importModal) elements.importModal.style.display = "none";
  pendingImportRules = null;
}

function showUrlModalError(msg) {
  if (!elements.importUrlError) return;
  elements.importUrlError.textContent = msg;
  elements.importUrlError.style.display = "block";
}

function hideUrlImportModal() {
  if (elements.urlImportModal) elements.urlImportModal.style.display = "none";
  if (elements.importUrlInput) elements.importUrlInput.value = "";
  if (elements.importUrlError) {
    elements.importUrlError.textContent = "";
    elements.importUrlError.style.display = "none";
  }
}

if (elements.importUrlBtn) {
  elements.importUrlBtn.addEventListener("click", () => {
    if (elements.urlImportModal) {
      if (elements.importUrlError) elements.importUrlError.style.display = "none";
      elements.urlImportModal.style.display = "flex";
      if (elements.importUrlInput) elements.importUrlInput.focus();
    }
  });
}

if (elements.urlModalCancelBtn) {
  elements.urlModalCancelBtn.addEventListener("click", hideUrlImportModal);
}

async function handleUrlFetchAndImport() {
  if (!elements.importUrlInput || !elements.urlModalFetchBtn) return;
  const rawUrl = elements.importUrlInput.value.trim();

  if (!rawUrl) {
    showUrlModalError("Please enter a URL.");
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error();
    }
  } catch (err) {
    showUrlModalError("Please enter a valid HTTP or HTTPS URL.");
    return;
  }

  elements.urlModalFetchBtn.disabled = true;
  elements.urlModalFetchBtn.textContent = "Fetching...";
  if (elements.importUrlError) elements.importUrlError.style.display = "none";

  try {
    const response = await fetch(parsedUrl.href, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status} ${response.statusText || ""}`);
    }

    const text = await response.text();
    const result = parseAndValidateRules(text);

    if (!result.valid) {
      showUrlModalError(result.error || "Invalid rules format.");
      return;
    }

    chrome.storage.sync.get(["rules"], (data) => {
      const existingRules = Array.isArray(data.rules) ? data.rules : [];
      pendingImportRules = result.rules;
      hideUrlImportModal();

      if (existingRules.length === 0) {
        saveRules(result.rules, () => {
          loadRules();
          showNotificationToast(`Imported ${result.rules.length} rule${result.rules.length === 1 ? "" : "s"} from URL.`);
        });
      } else {
        const stats = mergeRules(existingRules, result.rules);
        if (elements.modalTotalCount) elements.modalTotalCount.textContent = result.rules.length;
        if (elements.modalNewCount) elements.modalNewCount.textContent = stats.addedCount;
        if (elements.modalDuplicateCount) elements.modalDuplicateCount.textContent = stats.duplicateCount;
        if (elements.importModal) elements.importModal.style.display = "flex";
      }
    });
  } catch (err) {
    showUrlModalError(err.message || "Failed to fetch rules from the provided URL.");
  } finally {
    elements.urlModalFetchBtn.disabled = false;
    elements.urlModalFetchBtn.textContent = "Fetch & Import";
  }
}

if (elements.urlModalFetchBtn) {
  elements.urlModalFetchBtn.addEventListener("click", handleUrlFetchAndImport);
}

if (elements.importUrlInput) {
  elements.importUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleUrlFetchAndImport();
  });
}

if (elements.importBtn && elements.importFile) {
  elements.importBtn.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = parseAndValidateRules(event.target.result);
      if (!result.valid) {
        showNotificationToast(result.error || "Invalid rules format.");
        elements.importFile.value = "";
        return;
      }

      chrome.storage.sync.get(["rules"], (data) => {
        const existingRules = Array.isArray(data.rules) ? data.rules : [];
        pendingImportRules = result.rules;

        if (existingRules.length === 0) {
          saveRules(result.rules, () => {
            loadRules();
            showNotificationToast(`Imported ${result.rules.length} rule${result.rules.length === 1 ? "" : "s"}.`);
          });
        } else {
          const stats = mergeRules(existingRules, result.rules);
          if (elements.modalTotalCount) elements.modalTotalCount.textContent = result.rules.length;
          if (elements.modalNewCount) elements.modalNewCount.textContent = stats.addedCount;
          if (elements.modalDuplicateCount) elements.modalDuplicateCount.textContent = stats.duplicateCount;
          if (elements.importModal) elements.importModal.style.display = "flex";
        }
      });
      elements.importFile.value = "";
    };
    reader.readAsText(file);
  });
}

if (elements.modalCancelBtn) {
  elements.modalCancelBtn.addEventListener("click", hideImportModal);
}

if (elements.modalMergeBtn) {
  elements.modalMergeBtn.addEventListener("click", () => {
    if (!pendingImportRules) return;
    chrome.storage.sync.get(["rules"], (data) => {
      const existingRules = Array.isArray(data.rules) ? data.rules : [];
      const stats = mergeRules(existingRules, pendingImportRules);
      saveRules(stats.mergedRules, () => {
        loadRules();
        hideImportModal();
        showNotificationToast(`Merged ${stats.addedCount} new rule${stats.addedCount === 1 ? "" : "s"}.`);
      });
    });
  });
}

if (elements.modalReplaceBtn) {
  elements.modalReplaceBtn.addEventListener("click", () => {
    if (!pendingImportRules) return;
    saveRules(pendingImportRules, () => {
      loadRules();
      hideImportModal();
      showNotificationToast(`Replaced all rules with ${pendingImportRules.length} imported rule${pendingImportRules.length === 1 ? "" : "s"}.`);
    });
  });
}

if (elements.cancelEditBtn) {
  elements.cancelEditBtn.addEventListener("click", () => resetEditMode(elements));
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
