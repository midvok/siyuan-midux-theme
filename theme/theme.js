//=============================================================================
// Midux - theme script
//=============================================================================
// Adds the color presets to the Appearance Mode menu (sun icon) and saves
// the choice in the workspace.
//=============================================================================
(() => {
  "use strict";

  // Must match the preset partials in src/presets/
  const PRESETS = [
    { id: "sepium", label: "Sepium" },
    { id: "steel-grey", label: "Steel Grey" },
  ];
  const DEFAULT_PRESET = "sepium";
  const STORAGE_KEY = "midux-preset";
  const PRESET_ATTR = "data-midux-preset";

  const root = document.documentElement;
  let menuObserver = null;

  //-------------------------------------------------------------------------
  // Reads the saved preset from SiYuan's workspace storage.
  // - SiYuan loads data/storage/local.json into window.siyuan.storage
  //   before it loads theme.js.
  // - Falls back to the default for a missing or unknown id.
  //-------------------------------------------------------------------------
  function savedPreset() {
    const id = window.siyuan?.storage?.[STORAGE_KEY];
    return PRESETS.some((preset) => preset.id === id) ? id : DEFAULT_PRESET;
  }

  //-------------------------------------------------------------------------
  // Saves the preset to data/storage/local.json through the kernel API.
  // - Browser localStorage is not used: its origin includes the kernel
  //   port, which can change between launches.
  //-------------------------------------------------------------------------
  function savePreset(id) {
    if (window.siyuan?.storage) {
      window.siyuan.storage[STORAGE_KEY] = id;
    }
    fetch("/api/storage/setLocalStorageVal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Token ${window.siyuan?.config?.api?.token ?? ""}`,
      },
      body: JSON.stringify({ app: "midux", key: STORAGE_KEY, val: id }),
    }).catch((error) => console.warn("[Midux] saving preset failed:", error));
  }

  function applyPreset(id) {
    root.setAttribute(PRESET_ATTR, id);
  }

  //-------------------------------------------------------------------------
  // Builds one preset item with the same markup as SiYuan's menu items.
  //-------------------------------------------------------------------------
  function createPresetItem(preset) {
    const item = document.createElement("button");
    item.className = "b3-menu__item midux-preset";
    if (preset.id === root.getAttribute(PRESET_ATTR)) {
      item.classList.add("b3-menu__item--selected");
    }

    const swatch = document.createElement("span");
    swatch.className = "b3-menu__icon midux-swatch";
    swatch.dataset.preset = preset.id;
    const label = document.createElement("span");
    label.className = "b3-menu__label";
    label.textContent = preset.label;
    item.append(swatch, label);

    item.addEventListener("click", (event) => {
      // Keep SiYuan's menu handler from processing this click
      event.stopPropagation();
      applyPreset(preset.id);
      savePreset(preset.id);
      window.siyuan.menus.menu.remove();
    });
    return item;
  }

  //-------------------------------------------------------------------------
  // Extends the Appearance Mode menu each time it opens.
  // - SiYuan sets data-name="barmode" and adds its items in one step, so
  //   the observer runs after the built-in items exist.
  // - SiYuan empties .b3-menu__items on close, which removes ours too.
  //-------------------------------------------------------------------------
  function watchModeMenu() {
    const menu = document.getElementById("commonMenu");
    if (!menu) {
      return;
    }
    menuObserver = new MutationObserver(() => {
      const items = menu.querySelector(":scope > .b3-menu__items");
      if (menu.dataset.name !== "barmode" || !items || items.querySelector(".midux-preset")) {
        return;
      }
      const separator = document.createElement("button");
      separator.className = "b3-menu__separator";
      items.append(separator, ...PRESETS.map(createPresetItem));
    });
    menuObserver.observe(menu, { attributes: true, attributeFilter: ["data-name"] });
  }

  // SiYuan calls this before switching to another theme
  window.destroyTheme = () => {
    menuObserver?.disconnect();
    root.removeAttribute(PRESET_ATTR);
  };

  // 1. Apply the saved preset
  applyPreset(savedPreset());
  // 2. Hook into the Appearance Mode menu
  watchModeMenu();
})();
