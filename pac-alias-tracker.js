// ==UserScript==
// @name         PAC Profile Alias Tracker
// @namespace    pac-helper
// @description  Tracks past player names per PAC profile ID when opening the profile modal. Shows aliases, copy/export/import, and global search.
// @version      1.1
// @match        *://pokemon-auto-chess.com/*
// @match        *://*.pokemon-auto-chess.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // ---------- Config ----------
  const STORAGE_KEY = "pac_profile_aliases_v1";
  const MAX_NAMES_PER_PLAYER = 100;
  const PANEL_ID = "pac-alias-panel";
  const SEARCH_INPUT_ID = `${PANEL_ID}-search`;
  const SEARCH_RESULTS_ID = `${PANEL_ID}-search-results`;

  // How far to push the panel to the left of the profile modal (tweak if you want)
  const PANEL_OUTSIDE_OFFSET_PX = 295;

  // ? Draggable position persistence
  const PANEL_POS_KEY = "pac_alias_panel_pos_v1";

  // Fonts
  if (!document.querySelector('link[href*="Jost"]')) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Jost:wght@400;700&display=swap";
    document.head.appendChild(l);
  }

  // Avoid double boot
  if (window.__pacAliasTrackerBootstrapped) return;
  window.__pacAliasTrackerBootstrapped = true;

  // ---------- Storage ----------
  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { players: {}, nameIndex: {} };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { players: {}, nameIndex: {} };
      if (!parsed.players || typeof parsed.players !== "object") parsed.players = {};
      if (!parsed.nameIndex || typeof parsed.nameIndex !== "object") parsed.nameIndex = {};
      return parsed;
    } catch {
      return { players: {}, nameIndex: {} };
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function rebuildIndex(store) {
    const idx = {};
    for (const [id, p] of Object.entries(store.players || {})) {
      const names = Array.isArray(p?.names) ? p.names : [];
      for (const n of names) {
        if (!idx[n]) idx[n] = [];
        if (!idx[n].includes(id)) idx[n].push(id);
      }
    }
    store.nameIndex = idx;
  }

  function ensurePlayer(store, id) {
    if (!store.players[id]) store.players[id] = { names: [], lastSeen: Date.now() };
    if (!Array.isArray(store.players[id].names)) store.players[id].names = [];
    if (typeof store.players[id].lastSeen !== "number") store.players[id].lastSeen = Date.now();
    return store.players[id];
  }

function addAlias(store, id, name) {
  if (!id || !name) return { added: false };

  const p = ensurePlayer(store, id);
  p.lastSeen = Date.now();

  const idx = p.names.indexOf(name);

  if (idx === -1) {
    // New name ? add to front
    p.names.unshift(name);
    if (p.names.length > MAX_NAMES_PER_PLAYER) {
      p.names.length = MAX_NAMES_PER_PLAYER;
    }
  } else if (idx > 0) {
    // Existing name ? move to front
    p.names.splice(idx, 1);
    p.names.unshift(name);
  }
  // idx === 0 ? already most recent, do nothing

  rebuildIndex(store);
  saveStore(store);

  return { added: idx !== 0 };
}



  // ---------- Profile modal + ID detection ----------
  let lastModalName = "";
  let lastModalSeenAt = 0;

  function isProfileModalOpen() {
    return !!document.querySelector(".profile-modal");
  }

  function getCurrentModalName() {
    const modal = document.querySelector(".profile-modal");
    if (!modal) return "";
    const h2 = modal.querySelector("h2");
    if (!h2) return "";
    const txt = (h2.textContent || "").trim();
    return txt.replace(/\s+Profile\s*$/i, "").trim();
  }

  function markModalNameSnapshot() {
    const name = getCurrentModalName();
    if (name) {
      lastModalName = name;
      lastModalSeenAt = Date.now();
    }
  }

  function pickBestNameForRequest() {
    const nowName = getCurrentModalName();
    if (nowName) return nowName;
    if (lastModalName && Date.now() - lastModalSeenAt < 800) return lastModalName;
    return "";
  }

  function extractIdFromGameHistoryUrl(url) {
    try {
      const u = new URL(url, location.origin);
      const m = u.pathname.match(/\/game-history\/([^/]+)/);
      return m ? m[1] : "";
    } catch {
      const m = String(url).match(/\/game-history\/([^/?#]+)/);
      return m ? m[1] : "";
    }
  }

  // ---------- Render guards ----------
  let isRendering = false;
  let pendingRender = null;

  function scheduleRender(next) {
    panelState = { ...panelState, ...next };
    if (pendingRender) return;
    pendingRender = setTimeout(() => {
      pendingRender = null;
      renderOrUpdatePanel();
    }, 0);
  }

  // ---------- Mounting / positioning ----------
function ensureParentsAllowOverflow() {
  const profileModal = document.querySelector(".profile-modal");

  // helper: walk up a few parents and un-clip them
  function unclipChain(el) {
    let cur = el;
    for (let i = 0; i < 8 && cur; i++) {
      try {
        cur.style.overflow = "visible";
        cur.style.overflowX = "visible";
        cur.style.overflowY = "visible";
      } catch {}
      cur = cur.parentElement;
    }
  }

  if (profileModal) {
    // keep our original behavior
    profileModal.style.overflow = "visible";
    profileModal.style.overflowX = "visible";
    profileModal.style.overflowY = "visible";

    const cs = getComputedStyle(profileModal);
    if (cs.position === "static") profileModal.style.position = "relative";

    // ? new: unclip ancestors too
    unclipChain(profileModal);
  }

  // also unclip common dialog containers
  const dialog = document.querySelector("dialog[open]");
  if (dialog) unclipChain(dialog);

  const modalBody = document.querySelector("dialog[open] .modal-body");
  if (modalBody) unclipChain(modalBody);
}


  function ensurePanelMounted(panel) {
    const host = document.querySelector(".profile-modal");
    if (!host || !panel) return;

    ensureParentsAllowOverflow();

    if (panel.parentElement !== host) {
      host.appendChild(panel);
    }
  }

  function loadPanelPos() {
    try {
      const raw = localStorage.getItem(PANEL_POS_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p || typeof p !== "object") return null;
      if (typeof p.left !== "number" || typeof p.top !== "number") return null;
      return p;
    } catch {
      return null;
    }
  }

  function savePanelPos(left, top) {
    localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left, top }));
  }

  function resetPanelPos(panel) {
    localStorage.removeItem(PANEL_POS_KEY);
    // apply default immediately
    panel.style.top = "-72px";
    panel.style.left = `-${PANEL_OUTSIDE_OFFSET_PX}px`;
  }

  function ensurePanelPosition(panel) {
    if (!panel) return;
    panel.style.position = "absolute";
    panel.style.zIndex = "999999";
    panel.style.pointerEvents = "auto";

    const saved = loadPanelPos();
    if (saved) {
      panel.style.left = `${saved.left}px`;
      panel.style.top = `${saved.top}px`;
    } else {
      panel.style.top = "-72px";
      panel.style.left = `-${PANEL_OUTSIDE_OFFSET_PX}px`;
    }
  }

  // ---------- Drag manager (single global listeners; rebind handle per render) ----------
  const dragState = {
    active: false,
    panel: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    parentRect: null,
  };

  function isTypingTarget(t) {
    if (!(t instanceof HTMLElement)) return false;
    return t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
  }

  function attachGlobalDragListenersOnce() {
    if (window.__pacAliasDragListeners) return;
    window.__pacAliasDragListeners = true;

    window.addEventListener(
      "pointermove",
      (e) => {
        if (!dragState.active || !dragState.panel) return;

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;

        const parentRect = dragState.parentRect;
        if (!parentRect) return;

        const newLeft = Math.round(dragState.startLeft + dx);
        const newTop = Math.round(dragState.startTop + dy);

        dragState.panel.style.left = `${newLeft}px`;
        dragState.panel.style.top = `${newTop}px`;

        savePanelPos(newLeft, newTop);

        e.preventDefault();
        e.stopPropagation();
      },
      true
    );

    const stop = () => {
      dragState.active = false;
      dragState.panel = null;
      dragState.parentRect = null;
    };

    window.addEventListener("pointerup", stop, true);
    window.addEventListener("pointercancel", stop, true);
  }

  function enableDragging(panel, headerEl) {
    if (!panel || !headerEl) return;

    attachGlobalDragListenersOnce();

    headerEl.style.cursor = "grab";

    headerEl.addEventListener(
      "pointerdown",
      (e) => {
        // don't start drag when clicking buttons in header
        const target = e.target instanceof HTMLElement ? e.target : null;
        if (!target) return;
        if (isTypingTarget(target)) return;
        if (target.closest("button")) return;

        // compute current left/top relative to offsetParent
        const parent = panel.offsetParent || panel.parentElement;
        const parentRect = parent.getBoundingClientRect();
        const rect = panel.getBoundingClientRect();

        const currentLeft = rect.left - parentRect.left;
        const currentTop = rect.top - parentRect.top;

        dragState.active = true;
        dragState.panel = panel;
        dragState.startX = e.clientX;
        dragState.startY = e.clientY;
        dragState.startLeft = currentLeft;
        dragState.startTop = currentTop;
        dragState.parentRect = parentRect;

        headerEl.style.cursor = "grabbing";

        e.preventDefault();
        e.stopPropagation();
      },
      true
    );

    headerEl.addEventListener(
      "pointerup",
      () => {
        headerEl.style.cursor = "grab";
      },
      true
    );
  }

  // ---------- UI State ----------
  let panelState = {
    profileId: "",
    currentName: "",
    justAdded: false,
    searchQuery: "",
    importExpanded: false,
  };

  function headerButton(text, title) {
    const b = document.createElement("button");
    b.textContent = text;
    b.title = title;
    b.style.cssText = `
      border: 0;
      background: transparent;
      color: #fff;
      padding: 6px 10px;
      cursor: var(--cursor-hover, pointer);
      border-radius: 3px;
      font-size: 1rem;
      font-weight: 700;
      line-height: 1;
      user-select: none;
      transition: filter .15s;
    `;
    return b;
  }

  function wrapHeaderButton(btn) {
    const plate = document.createElement("div");
    plate.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 2px;
      background: transparent;
      cursor: var(--cursor-hover, pointer);
      user-select: none;
      transition: background-color .15s;
    `;
    btn.style.display = "inline-flex";
    btn.style.cursor = "inherit";
    plate.appendChild(btn);
    plate.addEventListener("mouseenter", () => (plate.style.backgroundColor = "rgba(255,255,255,0.15)"));
    plate.addEventListener("mouseleave", () => (plate.style.backgroundColor = "transparent"));
    return plate;
  }

  function smallButtonCss(danger = false) {
    return `
      padding: 7px 10px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,.18);
      background: ${danger ? "rgba(0,0,0,.25)" : "rgba(0,0,0,.18)"};
      color: #fff;
      cursor: var(--cursor-hover, pointer);
      font-weight: 800;
      font-size: 12px;
      white-space: nowrap;
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[c]));
  }

  // ---------- ID masking / click-to-reveal ----------
  function maskId(id) {
    if (!id) return "";
    return "•".repeat(Math.min(20, Math.max(8, String(id).length)));
  }

  function createRevealIdSpan(id, prefix = "ID: ") {
    const el = document.createElement("span");
    el.style.cssText = `
      font-family: monospace;
      opacity: .9;
      cursor: pointer;
      user-select: none;
    `;

    let revealed = false;

    const render = () => {
      el.textContent = revealed ? `${prefix}${id}` : `${prefix}${maskId(id)} (click to show)`;
    };

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      revealed = !revealed;
      render();

      if (revealed) {
        setTimeout(() => {
          revealed = false;
          render();
        }, 6000);
      }
    });

    render();
    return el;
  }

  function buildSearchHtml(store, q) {
    const query = (q || "").trim();
    if (!query) return `<div style="opacity:.85;">Search results will appear here.</div>`;

    const hits = Object.keys(store.nameIndex || {}).filter((n) => n.includes(query));
    if (hits.length === 0) {
      return `<div style="opacity:.85;">No matches for "<span style="font-family:monospace;">${escapeHtml(query)}</span>".</div>`;
    }

    const limited = hits.slice(0, 30);
    const lines = [];
    for (const name of limited) {
      const ids = store.nameIndex[name] || [];
      for (const id of ids.slice(0, 5)) lines.push({ name, id });
    }

    let html = lines
      .slice(0, 40)
      .map(
        (x) => `
        <div style="display:flex;gap:8px;align-items:center;margin:4px 0;">
          <span style="font-weight:700;">${escapeHtml(x.name)}</span>
          <span style="opacity:.8;">?</span>
          <span class="pac-alias-id"
                data-id="${escapeHtml(x.id)}"
                style="font-family:monospace;opacity:.95;cursor:pointer;user-select:none;">
            ${escapeHtml(maskId(x.id))} (click)
          </span>
        </div>`
      )
      .join("");

    if (hits.length > 30) html += `<div style="opacity:.7;margin-top:6px;">Showing first 30 name hits…</div>`;
    return html;
  }

  async function safeCopy(text) {
    try {
      await navigator.clipboard.writeText(text || "");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text || "";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
  }

  function flashButton(btn) {
    const old = btn.textContent;
    btn.textContent = "Copied ?";
    setTimeout(() => (btn.textContent = old), 800);
  }

  function mergeStores(base, incoming) {
    const out = loadStore();
    out.players = base && typeof base.players === "object" ? base.players : {};

    const incPlayers = incoming?.players;
    if (incPlayers && typeof incPlayers === "object") {
      for (const [id, p] of Object.entries(incPlayers)) {
        if (!id) continue;
        const names = Array.isArray(p?.names) ? p.names.filter((x) => typeof x === "string" && x.trim()) : [];
        const dst = ensurePlayer(out, id);
        for (const n of names) {
          if (!dst.names.includes(n)) dst.names.push(n);
        }
        if (dst.names.length > MAX_NAMES_PER_PLAYER) dst.names.length = MAX_NAMES_PER_PLAYER;
        dst.lastSeen = Math.max(dst.lastSeen || 0, p?.lastSeen || 0, Date.now());
      }
    }

    rebuildIndex(out);
    return out;
  }

  function createPanel() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = `
      background: var(--color-bg-primary, #61738A);
      color: #fff;
      border-radius: 12px;
      border: 4px solid #000;
      font-family: Jost, system-ui, sans-serif;
      font-size: 13px;
      min-width: 280px;
      max-width: 280px;
      box-shadow: 0 3px 5px rgba(0,0,0,.35);
      user-select: none;
      box-sizing: border-box;
      overflow: hidden;
      pointer-events: auto;
    `;

    // bubble-phase block so clicks still reach buttons first
    const stopBubble = (e) => {
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    };
    ["pointerdown", "mousedown", "mouseup", "click", "touchstart"].forEach((evt) => {
      panel.addEventListener(evt, stopBubble, false);
    });

    // Block game hotkeys while typing in our inputs/textareas
    const keyboardBlocker = (e) => {
      const active = document.activeElement;
      if (!active) return;
      if (panel.contains(active) && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
        e.stopImmediatePropagation();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", keyboardBlocker, true);
    window.addEventListener("keypress", keyboardBlocker, true);
    window.addEventListener("keyup", keyboardBlocker, true);

    const origRemove = panel.remove.bind(panel);
    panel.remove = () => {
      window.removeEventListener("keydown", keyboardBlocker, true);
      window.removeEventListener("keypress", keyboardBlocker, true);
      window.removeEventListener("keyup", keyboardBlocker, true);
      origRemove();
    };

    ensurePanelMounted(panel);
    ensurePanelPosition(panel);

    return panel;
  }

  function renderOrUpdatePanel() {
    if (isRendering) return;
    isRendering = true;

    try {
      if (!isProfileModalOpen()) {
        const existing = document.getElementById(PANEL_ID);
        if (existing) existing.remove();
        return;
      }

      let panel = document.getElementById(PANEL_ID);
      if (!panel) panel = createPanel();

      ensurePanelMounted(panel);
      ensurePanelPosition(panel);

      const store = loadStore();
      const pid = panelState.profileId;
      const currentName = panelState.currentName || getCurrentModalName() || "";

if (pid && currentName) {
  const { added } = addAlias(store, pid, currentName);
  panelState.justAdded = added;
}


      const store2 = loadStore();
      const names2 = pid && store2.players?.[pid]?.names ? store2.players[pid].names : [];

      panel.innerHTML = "";

      const header = document.createElement("div");
      header.style.cssText = `
        background: var(--color-bg-secondary, #54596B);
        padding: .35rem .5rem .45rem .5rem;
        box-sizing: border-box;
      `;
      panel.appendChild(header);

      // ? draggable by header
      enableDragging(panel, header);

      const headerRow = document.createElement("div");
      headerRow.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:8px;`;
      header.appendChild(headerRow);

      const left = document.createElement("div");
      left.style.cssText = "display:flex;align-items:center;gap:8px;min-width:0;";
      headerRow.appendChild(left);

      const right = document.createElement("div");
      right.style.cssText = "display:flex;align-items:center;gap:8px;flex:0 0 auto;";
      headerRow.appendChild(right);

      const title = document.createElement("div");
      title.textContent = "PAC Aliases";
      title.style.cssText = `
        font-size: 1.2rem;
        font-weight: 700;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: center;
        flex: 1;
      `;
      left.appendChild(title);

      const resetBtn = headerButton("?", "Reset panel position");
      right.appendChild(wrapHeaderButton(resetBtn));

      const refreshBtn = headerButton("?", "Refresh");
      right.appendChild(wrapHeaderButton(refreshBtn));

      const content = document.createElement("div");
      content.style.cssText = `background: var(--color-bg-primary, #61738A);padding: 10px;box-sizing: border-box;`;
      panel.appendChild(content);

      // Meta row
      const meta = document.createElement("div");
      meta.style.cssText = "display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px;";
      content.appendChild(meta);

      const leftMeta = document.createElement("div");
      leftMeta.style.cssText = "min-width:0;";
      meta.appendChild(leftMeta);

      const shownName = currentName || "(unknown)";
      const nameLine = document.createElement("div");
      nameLine.style.cssText = "display:flex;align-items:center;gap:8px;min-width:0;";
      leftMeta.appendChild(nameLine);

      const nameEl = document.createElement("div");
      nameEl.textContent = shownName;
      nameEl.style.cssText = "font-weight:800;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      nameLine.appendChild(nameEl);

      const newBadge = document.createElement("span");
      newBadge.textContent = "NEW";
      newBadge.style.cssText = `
        display:${panelState.justAdded ? "inline-flex" : "none"};
        align-items:center;justify-content:center;
        padding:2px 6px;border-radius:999px;
        font-weight:800;font-size:11px;
        background: rgba(0,0,0,.35);
        border: 1px solid rgba(255,255,255,.25);
      `;
      nameLine.appendChild(newBadge);

      // ? Top ID is masked until click
      const idEl = document.createElement("div");
      idEl.style.cssText = "font-size:12px;margin-top:2px;";
      if (pid) {
        idEl.appendChild(createRevealIdSpan(pid, "ID: "));
      } else {
        idEl.textContent = "ID: (not captured yet — open profile once)";
        idEl.style.cssText += "font-family:monospace;opacity:.9;";
      }
      leftMeta.appendChild(idEl);

      const metaBtns = document.createElement("div");
      metaBtns.style.cssText = "display:flex;gap:6px;flex:0 0 auto;";
      meta.appendChild(metaBtns);

      // Only one copy button
      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy";
      copyBtn.style.cssText = smallButtonCss();
      metaBtns.appendChild(copyBtn);

      // Aliases
      const aliasBlock = document.createElement("div");
      aliasBlock.style.cssText = `
        background: rgba(0,0,0,.18);
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 10px;
        padding: 8px;
      `;
      content.appendChild(aliasBlock);

      const aliasTitle = document.createElement("div");
      aliasTitle.style.cssText =
        "font-weight:800;margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;";
      aliasTitle.innerHTML = `<span>Also known as</span><span style="opacity:.85;font-size:12px;">${(names2?.length || 0)} / ${MAX_NAMES_PER_PLAYER}</span>`;
      aliasBlock.appendChild(aliasTitle);

      const aliasText = document.createElement("div");
      aliasText.style.cssText = "line-height:1.35;opacity:.98;user-select:text;word-break:break-word;";
      aliasText.innerHTML =
        names2 && names2.length
          ? names2.map((n) => `<span style="font-weight:700;">${escapeHtml(n)}</span>`).join(`<span style="opacity:.8;">, </span>`)
          : `<span style="opacity:.85;">No saved names yet.</span>`;
      aliasBlock.appendChild(aliasText);

      // Actions — split into two rows
      const actionsWrap = document.createElement("div");
      actionsWrap.style.cssText = "display:flex;flex-direction:column;gap:6px;margin-top:10px;";
      content.appendChild(actionsWrap);

      const row1 = document.createElement("div");
      row1.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
      actionsWrap.appendChild(row1);

      const row2 = document.createElement("div");
      row2.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
      actionsWrap.appendChild(row2);

      const exportBtn = document.createElement("button");
      exportBtn.textContent = "Export JSON";
      exportBtn.style.cssText = smallButtonCss();
      row1.appendChild(exportBtn);

      const importBtn = document.createElement("button");
      importBtn.textContent = panelState.importExpanded ? "Close Import" : "Import JSON";
      importBtn.style.cssText = smallButtonCss();
      row1.appendChild(importBtn);

      const clearPlayerBtn = document.createElement("button");
      clearPlayerBtn.textContent = "Clear This Player";
      clearPlayerBtn.style.cssText = smallButtonCss(true);
      row2.appendChild(clearPlayerBtn);

      const clearAllBtn = document.createElement("button");
      clearAllBtn.textContent = "Clear ALL";
      clearAllBtn.style.cssText = smallButtonCss(true);
      row2.appendChild(clearAllBtn);

      // Import area
      if (panelState.importExpanded) {
        const importArea = document.createElement("div");
        importArea.style.cssText = `
          margin-top:10px;padding:8px;border-radius:10px;
          background: rgba(0,0,0,.18);
          border: 1px solid rgba(255,255,255,.18);
        `;
        content.appendChild(importArea);

        const importLabel = document.createElement("div");
        importLabel.textContent = "Paste exported JSON here (it will merge):";
        importLabel.style.cssText = "font-weight:800;margin-bottom:6px;";
        importArea.appendChild(importLabel);

        const ta = document.createElement("textarea");
        ta.placeholder = '{"players":{...},"nameIndex":{...}}';
        ta.style.cssText = `
          width:100%;height:90px;resize:vertical;
          border-radius:8px;border:1px solid rgba(255,255,255,.25);
          outline:none;padding:8px;box-sizing:border-box;font-family:monospace;
        `;
        importArea.appendChild(ta);

        const importActions = document.createElement("div");
        importActions.style.cssText = "display:flex;gap:6px;justify-content:flex-end;margin-top:6px;";
        importArea.appendChild(importActions);

        const doImportBtn = document.createElement("button");
        doImportBtn.textContent = "Merge Import";
        doImportBtn.style.cssText = smallButtonCss();
        importActions.appendChild(doImportBtn);

        const importMsg = document.createElement("div");
        importMsg.style.cssText = "margin-top:6px;opacity:.9;font-size:12px;";
        importArea.appendChild(importMsg);

        doImportBtn.addEventListener("click", () => {
          const raw = (ta.value || "").trim();
          if (!raw) return;
          try {
            const incoming = JSON.parse(raw);
            const merged = mergeStores(loadStore(), incoming);
            saveStore(merged);
            importMsg.textContent = "Imported successfully ?";
            panelState.importExpanded = false;
            scheduleRender({});
          } catch {
            importMsg.textContent = "Import failed: invalid JSON or wrong format.";
          }
        });
      }

      // Search
      const searchWrap = document.createElement("div");
      searchWrap.style.cssText = `margin-top: 10px;padding-top: 10px;border-top: 1px solid rgba(255,255,255,.18);`;
      content.appendChild(searchWrap);

      const searchTitle = document.createElement("div");
      searchTitle.textContent = "Search aliases (global)";
      searchTitle.style.cssText = "font-weight:800;margin-bottom:6px;";
      searchWrap.appendChild(searchTitle);

      const searchInput = document.createElement("input");
      searchInput.id = SEARCH_INPUT_ID;
      searchInput.type = "search";
      searchInput.placeholder = 'Type part of a name, e.g. "weff"';
      searchInput.value = panelState.searchQuery || "";
      searchInput.style.cssText = `
        width:100%;padding:8px 10px;border-radius:10px;
        border:1px solid rgba(255,255,255,0.25);
        outline:none;box-sizing:border-box;
      `;
      searchWrap.appendChild(searchInput);

      const searchResults = document.createElement("div");
      searchResults.id = SEARCH_RESULTS_ID;
      searchResults.style.cssText = `
        margin-top:8px;padding:8px;border-radius:10px;
        background: rgba(0,0,0,.18);
        border: 1px solid rgba(255,255,255,.18);
        max-height: 220px;overflow:auto;user-select:text;
      `;
      searchResults.innerHTML = buildSearchHtml(store2, panelState.searchQuery);
      searchWrap.appendChild(searchResults);

      // ? Click-to-reveal for masked search IDs (delegated)
      searchResults.addEventListener("click", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        const el = t.closest(".pac-alias-id");
        if (!el) return;

        e.stopPropagation();

        const real = el.getAttribute("data-id") || "";
        const txt = el.textContent || "";
        const isMasked = txt.includes("(click)");

        if (isMasked) {
          el.textContent = real;
          setTimeout(() => {
            el.textContent = `${maskId(real)} (click)`;
          }, 6000);
        } else {
          el.textContent = `${maskId(real)} (click)`;
        }
      });

      // Events
      resetBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        resetPanelPos(panel);
        // optional: also save the default immediately so it “sticks”
        const left = -PANEL_OUTSIDE_OFFSET_PX;
        const top = -72;
        savePanelPos(left, top);
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
      });

      refreshBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        markModalNameSnapshot();
        panelState.currentName = getCurrentModalName();
        panelState.justAdded = false;
        scheduleRender({});
      });

      copyBtn.addEventListener("click", async () => {
        const storeNow = loadStore();
        const list = Array.isArray(storeNow.players?.[pid]?.names) ? storeNow.players[pid].names : [];
        await safeCopy(list.join("\n"));
        flashButton(copyBtn);
      });

      exportBtn.addEventListener("click", async () => {
        const dump = JSON.stringify(loadStore(), null, 2);
        await safeCopy(dump);
        flashButton(exportBtn);
      });

      importBtn.addEventListener("click", () => {
        panelState.importExpanded = !panelState.importExpanded;
        scheduleRender({});
      });

      clearPlayerBtn.addEventListener("click", () => {
        if (!pid) return;
        const storeNow = loadStore();
        delete storeNow.players[pid];
        rebuildIndex(storeNow);
        saveStore(storeNow);
        panelState.justAdded = false;
        scheduleRender({});
      });

      clearAllBtn.addEventListener("click", () => {
        localStorage.removeItem(STORAGE_KEY);
        panelState.justAdded = false;
        scheduleRender({});
      });

      searchInput.addEventListener("input", () => {
        panelState.searchQuery = searchInput.value || "";
        const storeNow = loadStore();
        const resultsEl = document.getElementById(SEARCH_RESULTS_ID);
        if (resultsEl) resultsEl.innerHTML = buildSearchHtml(storeNow, panelState.searchQuery);
      });
    } finally {
      isRendering = false;
    }
  }

  // ---------- Hook fetch / XHR ----------
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = args?.[0];
    const id = extractIdFromGameHistoryUrl(url);

    markModalNameSnapshot();
    const nameAtRequest = pickBestNameForRequest();

    const res = await originalFetch.apply(this, args);

    if (id && isProfileModalOpen()) {
      const nameNow = getCurrentModalName() || "";
      if (nameAtRequest && nameNow && nameNow !== nameAtRequest) return res;
      scheduleRender({ profileId: id, currentName: nameNow || nameAtRequest, justAdded: false });
    }

    return res;
  };

  const XHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      markModalNameSnapshot();
      const id = extractIdFromGameHistoryUrl(url);
      const nameAtRequest = pickBestNameForRequest();

      if (id) {
        this.addEventListener("load", () => {
          if (id && isProfileModalOpen()) {
            const nameNow = getCurrentModalName() || "";
            if (nameAtRequest && nameNow && nameNow !== nameAtRequest) return;
            scheduleRender({ profileId: id, currentName: nameNow || nameAtRequest, justAdded: false });
          }
        });
      }
    } catch {}
    return XHROpen.call(this, method, url, ...rest);
  };

  // ---------- Modal watcher (SAFE: only watch the open profile modal, not the whole body) ----------
  let moTimer = null;
  let activeTarget = null;

  const mo = new MutationObserver((mutations) => {
    // Ignore mutations from our own panel subtree
    for (const m of mutations) {
      const t = m.target;
      if (t && t.nodeType === 1) {
        const el = t;
        if (el.id === PANEL_ID || el.closest?.(`#${PANEL_ID}`)) return;
      }
      for (const n of m.addedNodes || []) {
        if (n?.nodeType === 1) {
          const el = n;
          if (el.id === PANEL_ID || el.querySelector?.(`#${PANEL_ID}`)) return;
        }
      }
    }

    if (moTimer) clearTimeout(moTimer);
    moTimer = setTimeout(() => {
      moTimer = null;

      if (isProfileModalOpen()) {
        markModalNameSnapshot();
        ensureParentsAllowOverflow();

        const nameNow = getCurrentModalName() || "";
        if (nameNow && panelState.currentName && nameNow !== panelState.currentName) {
          scheduleRender({ currentName: nameNow, profileId: "", justAdded: false });
        } else {
          scheduleRender({ currentName: nameNow || panelState.currentName });
        }
      } else {
        const existing = document.getElementById(PANEL_ID);
        if (existing) existing.remove();
        detachObserver();
      }
    }, 80);
  });

  function attachObserver() {
    // Observe the profile modal container if present; otherwise observe the open dialog (smaller than body)
    const target =
      document.querySelector(".profile-modal") ||
      document.querySelector("dialog[open] .modal-body") ||
      document.querySelector("dialog[open]") ||
      null;

    if (!target || target === activeTarget) return;

    detachObserver();
    activeTarget = target;
    mo.observe(activeTarget, { childList: true, subtree: true });
  }

  function detachObserver() {
    try {
      mo.disconnect();
    } catch {}
    activeTarget = null;
  }

  // Lightweight observer just to detect modal open/close and re-attach to the correct node
  const rootMo = new MutationObserver(() => {
    if (isProfileModalOpen()) attachObserver();
    else detachObserver();
  });
  rootMo.observe(document.documentElement, { childList: true, subtree: true });

  // Initial attach if already open
  if (isProfileModalOpen()) {
    attachObserver();
    markModalNameSnapshot();
    ensureParentsAllowOverflow();
    scheduleRender({ profileId: "", currentName: getCurrentModalName() });
  }
})();
