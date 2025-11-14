// ==UserScript==
// @name         QuickHost Launcher - Q-Menu
// @namespace    https://bmo.guru/
// @version      2.1
// @description  Ctrl+Q → type "command [code] [extra]" → jump. Import JSON auto-builds and saves. Frosted glass UI.
// @author       BMO/B33BMO/Brandon Bischoff
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const HOTKEY = { ctrl: true, alt: false, shift: false, key: 'q' };
  const STORAGE_RULES = '__qh_rules_v2';
  const STORAGE_CMDS  = '__qh_cmds_v2';

  const DEFAULT_RULES = `# One rule per line: left side is the command, right side is the URL.
# Examples:
# google = https://google.com/
# router    = https://192.168.1.1
# reddit      = https://reddit.com
# apple = https://apple.com

`;

  // -------- storage helpers --------
  const get = async (k, d) => {
    try { return (typeof GM_getValue === 'function' ? await GM_getValue(k) : JSON.parse(localStorage.getItem(k))) ?? d; }
    catch { return d; }
  };
  const set = async (k, v) => {
    try { if (typeof GM_setValue === 'function') return GM_setValue(k, v); localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { console.warn('storage set failed', e); }
  };

  // -------- rules -> commands map --------
  function parseRulesToMap(rulesText) {
    const map = {};
    (rulesText || '').split(/\r?\n/).forEach(line => {
      const raw = line.trim();
      if (!raw || raw.startsWith('#')) return;
      const m = raw.match(/^(.+?)\s*=\s*(\S.+)$/);
      if (!m) return;
      const lhs = m[1].trim().replace(/\s+/g, ' ').toLowerCase();
      const url = m[2].trim();
      map[lhs] = url;
    });
    return map;
  }

  // -------- JSON importer  --------
  function importCustomerJsonToRules(obj) {
    const rules = [];
    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^\w]+/g, ' ').trim().replace(/\s+/g, ' ');
    const token = s => norm(s).replace(/\s+/g, '_'); // service token like "router", "router_ptc", "pm1", etc.

    try {
      if (obj?.groups && typeof obj.groups === 'object') {
        for (const letter of Object.keys(obj.groups)) {
          for (const customer of obj.groups[letter] || []) {
            const code = norm(customer.code).replace(/\s+/g, '');
            for (const svc of (customer.services || [])) {
              const t = token(svc.name);
              if (!t || !svc.url) continue;
              // Primary: "svc code = url"
              rules.push(`${t} ${code} = ${svc.url}`);

              // Common short aliases
              const shortMap = {
                prometheus: 'prom',
                grafana: 'graf',
                smokeping: 'smoke',
                'offsite_nas': 'offsite',
                'nas1': 'nas1',
                'pm1': 'pm1',
                'pm2': 'pm2',
                'pm3': 'pm3',
                'gitlab': 'gitlab',
                'router': 'router',
                'admin': 'admin',
                'pbx': 'pbx'
              };
              const short = shortMap[t];
              if (short && short !== t) {
                rules.push(`${short} ${code} = ${svc.url}`);
              }

              // If service name is like "Router Norfolk", also create "router code norfolk"
              const parts = norm(svc.name).split(' ').filter(Boolean);
              if (parts.length > 1) {
                const base = parts[0];               // e.g., "router"
                const extra = parts.slice(1).join('_'); // "norfolk"
                rules.push(`${base} ${code} ${extra} = ${svc.url}`);
              }
            }
          }
        }
      }
    } catch (e) {
      alert('Error importing groups/services: ' + e.message);
    }

    try {
      if (Array.isArray(obj?.sections)) {
        for (const sec of obj.sections) {
          for (const link of (sec.links || [])) {
            if (!link.url) continue;
            const nameTok = token(link.name);
            if (nameTok) rules.push(`${nameTok} = ${link.url}`);
          }
        }
      }
    } catch (e) {
      alert('Error importing sections/links: ' + e.message);
    }

    // de-dupe by LHS (last wins)
    const lastWins = {};
    for (const r of rules) {
      const [lhs] = r.split('=');
      lastWins[lhs.trim().toLowerCase()] = r.trim();
    }
    return Object.values(lastWins).sort((a, b) => a.localeCompare(b)).join('\n');
  }

  // -------- UI (frosted glass) --------
  function buildModal() {
    if (document.getElementById('qh2-modal')) return document.getElementById('qh2-modal');
    const style = document.createElement('style');
    style.textContent = `
      #qh2-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999999}
      #qh2-ov{position:absolute;inset:0;background:rgba(0,0,0,.2);backdrop-filter:blur(6px)}
      #qh2-card{
        position:relative;width:min(760px,94%);
        color:#eaf2ff;border-radius:16px;
        padding:16px;box-sizing:border-box;
        background:rgba(17,25,40,.55);
        border:1px solid rgba(255,255,255,.18);
        box-shadow:0 8px 40px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08);
        backdrop-filter:saturate(180%) blur(14px);
        -webkit-backdrop-filter:saturate(180%) blur(14px);
        font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial;
      }
      #qh2-title{font-weight:700;font-size:14px;letter-spacing:.02em;opacity:.9;margin-bottom:6px}
      #qh2-in{
        width:100%;padding:12px 14px;font-size:16px;border-radius:12px;outline:none;box-sizing:border-box;
        border:1px solid rgba(255,255,255,.22);
        background:linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.06));
        color:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.18);
      }
      #qh2-in::placeholder{color:rgba(234,242,255,.65)}
      #qh2-hint{margin-top:6px;font-size:12px;color:#bcd4ff;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      #qh2-count{padding:2px 8px;border-radius:9999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);font-size:11px}
      #qh2-row{margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .qh2-btn{
        padding:8px 12px;border-radius:12px;cursor:pointer;font-size:13px;color:#eaf2ff;
        background:linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,.06));
        border:1px solid rgba(255,255,255,.24);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.2), 0 1px 2px rgba(0,0,0,.25);
      }
      .qh2-btn:hover{filter:brightness(1.06)}
      .qh2-right{margin-left:auto;display:flex;gap:8px}
      #qh2-panels{margin-top:12px}
      .qh2-tabs{display:flex;gap:6px;margin-bottom:6px}
      .qh2-tab{
        padding:6px 10px;border-radius:9999px;cursor:pointer;font-size:12px;
        background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22)
      }
      .qh2-tab.qh2-active{background:rgba(88,151,255,.22);border-color:rgba(88,151,255,.35)}
      .qh2-panel{display:none}
      .qh2-panel.active{display:block}
      textarea.qh2-text{
        width:100%;height:260px;border-radius:12px;padding:10px;box-sizing:border-box;
        background:rgba(255,255,255,.08);color:inherit;border:1px solid rgba(255,255,255,.22);
        font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;font-size:12px;line-height:1.45
      }
      #qh2-suggest{
        margin-top:10px;max-height:220px;overflow:auto;border-radius:12px;padding:8px;
        background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);font-size:13px
      }
      .qh2-item{padding:8px;border-bottom:1px dashed rgba(255,255,255,.15);cursor:pointer}
      .qh2-item:last-child{border-bottom:none}
      .qh2-item:hover{background:rgba(255,255,255,.08)}
      .qh2-key{color:#d9e8ff;font-weight:700}
      .qh2-url{color:#c4dcff;word-break:break-all;opacity:.9}
    `;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'qh2-modal';
    el.innerHTML = `
      <div id="qh2-ov"></div>
      <div id="qh2-card" role="dialog" aria-modal="true" aria-label="Quick Launcher">
        <div id="qh2-title">QuickHost Launcher</div>
        <input id="qh2-in" placeholder="type: 'router cap', 'pm1 cap', 'router val norfolk', 'zulip'…  Enter=open (Shift+Enter same tab)" autocomplete="off" />
        <div id="qh2-hint">
          <span>Ctrl+Q to open</span>
          <span id="qh2-count"></span>
          <span>Import JSON auto-saves & rebuilds</span>
        </div>
        <div id="qh2-row">
          <button class="qh2-btn" id="qh2-open">Open</button>
          <button class="qh2-btn" id="qh2-open-same">Open (same tab)</button>
          <div class="qh2-right">
            <button class="qh2-btn" id="qh2-edit">Edit rules</button>
            <button class="qh2-btn" id="qh2-import">Import JSON</button>
            <button class="qh2-btn" id="qh2-close">Close</button>
          </div>
        </div>

        <div id="qh2-panels" style="display:none">
          <div class="qh2-tabs">
            <div class="qh2-tab qh2-active" data-tab="rules">Rules</div>
            <div class="qh2-tab" data-tab="json">JSON Import</div>
          </div>
          <div class="qh2-panel active" data-panel="rules">
            <textarea id="qh2-rules" class="qh2-text" spellcheck="false"></textarea>
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="qh2-btn" id="qh2-save">Save Rules</button>
              <button class="qh2-btn" id="qh2-rebuild">Rebuild Commands</button>
              <button class="qh2-btn" id="qh2-defaults">Reset to Defaults</button>
            </div>
            <div id="qh2-suggest"></div>
          </div>
          <div class="qh2-panel" data-panel="json">
            <textarea id="qh2-json" class="qh2-text" placeholder="Paste your JSON with groups/sections here…" spellcheck="false"></textarea>
            <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="qh2-btn" id="qh2-parse">Parse & Append → Save</button>
              <button class="qh2-btn" id="qh2-replace">Parse & Replace → Save</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  // -------- modal controller --------
  async function openModal() {
    const modal = buildModal();
    const ov = modal.querySelector('#qh2-ov');
    const inp = modal.querySelector('#qh2-in');
    const close = modal.querySelector('#qh2-close');
    const openBtn = modal.querySelector('#qh2-open');
    const openSameBtn = modal.querySelector('#qh2-open-same');
    const editBtn = modal.querySelector('#qh2-edit');
    const importBtn = modal.querySelector('#qh2-import');
    const panels = modal.querySelector('#qh2-panels');
    const tabs = modal.querySelectorAll('.qh2-tab');
    const rulesArea = modal.querySelector('#qh2-rules');
    const jsonArea = modal.querySelector('#qh2-json');
    const saveBtn = modal.querySelector('#qh2-save');
    const defaultsBtn = modal.querySelector('#qh2-defaults');
    const rebuildBtn = modal.querySelector('#qh2-rebuild');
    const parseBtn = modal.querySelector('#qh2-parse');
    const replaceBtn = modal.querySelector('#qh2-replace');
    const suggest = modal.querySelector('#qh2-suggest');
    const countBadge = modal.querySelector('#qh2-count');

    let rulesText = await get(STORAGE_RULES, DEFAULT_RULES);
    let commands = await get(STORAGE_CMDS, parseRulesToMap(rulesText));

    const show = () => { modal.style.display = 'flex'; inp.value = ''; setTimeout(() => inp.focus(), 30); refreshSuggest(''); refreshCount(); };
    const hide = () => { modal.style.display = 'none'; document.activeElement?.blur(); };

    function refreshCount() {
      const n = Object.keys(commands).length;
      countBadge.textContent = `Total commands: ${n}`;
    }

    function switchTab(name) {
      tabs.forEach(t => t.classList.toggle('qh2-active', t.dataset.tab === name));
      modal.querySelectorAll('.qh2-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
    }

    function refreshSuggest(prefix) {
      const p = prefix.trim().toLowerCase();
      const items = [];
      let shown = 0;
      for (const [k, u] of Object.entries(commands)) {
        if (!p || k.includes(p)) {
          items.push(`<div class="qh2-item" data-key="${k}"><div class="qh2-key">${k}</div><div class="qh2-url">${u}</div></div>`);
          if (++shown >= 400) break; // still chill, but show a lot
        }
      }
      suggest.innerHTML = items.join('') || '<div class="qh2-item">No matches. Try typing "router", "pm1", etc.</div>';
      suggest.querySelectorAll('.qh2-item').forEach(it => it.addEventListener('click', () => { inp.value = it.dataset.key; }));
    }

    function resolve(input) {
      const q = input.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!q) return null;
      if (commands[q]) return commands[q];

      // Try progressive prefix matching for multi-token commands, including 3+ tokens (e.g., "router val norfolk")
      const keys = Object.keys(commands);
      // exact startsWith
      let found = keys.find(k => k.startsWith(q));
      if (found) return commands[found];

      // if user typed only first token, show first match
      const first = q.split(' ')[0];
      found = keys.find(k => k.startsWith(first + ' '));
      if (found) return commands[found];

      return null;
    }

    async function saveRules(newText) {
      rulesText = newText;
      await set(STORAGE_RULES, rulesText);
      commands = parseRulesToMap(rulesText);
      await set(STORAGE_CMDS, commands);
      refreshSuggest(inp.value);
      refreshCount();
    }

    function openUrl(sameTab) {
      const url = resolve(inp.value);
      if (!url) { alert(`No command for "${inp.value}". Open Edit → add a line or use Import.`); return; }
      hide();
      sameTab ? (window.location.href = url) : window.open(url, '_blank');
    }

    // wires
    ov.onclick = close.onclick = hide;
    openBtn.onclick = () => openUrl(false);
    openSameBtn.onclick = () => openUrl(true);
    inp.onkeydown = (e) => {
      if (e.key === 'Escape') return hide();
      if (e.key === 'Enter') { e.preventDefault(); openUrl(e.shiftKey); }
    };
    inp.oninput = () => refreshSuggest(inp.value);

    editBtn.onclick = async () => {
      panels.style.display = panels.style.display === 'none' ? 'block' : 'none';
      switchTab('rules');
      rulesArea.value = rulesText;
      refreshSuggest('');
    };
    importBtn.onclick = () => {
      panels.style.display = 'block';
      switchTab('json');
      jsonArea.value = '';
    };
    tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

    saveBtn.onclick = async () => {
      await saveRules(rulesArea.value);
      alert('Rules saved & commands rebuilt.');
    };
    defaultsBtn.onclick = async () => {
      if (!confirm('Reset rules to defaults?')) return;
      await saveRules(DEFAULT_RULES);
      rulesArea.value = DEFAULT_RULES;
      alert('Defaults loaded.');
    };
    rebuildBtn.onclick = async () => {
      commands = parseRulesToMap(rulesArea.value);
      await set(STORAGE_CMDS, commands);
      refreshSuggest('');
      refreshCount();
      alert('Commands rebuilt from current rules.');
    };

    // Import: now auto-saves + rebuilds immediately
    async function parseJsonAndPersist(append) {
      try {
        const obj = JSON.parse(jsonArea.value);
        const newRules = importCustomerJsonToRules(obj);
        const merged = append
          ? (rulesText.trim() ? (rulesText.trim() + '\n' + newRules) : newRules)
          : newRules;
        await saveRules(merged);          // <- persist rules + compiled commands
        rulesArea.value = merged;
        alert(`Imported ${Object.keys(commands).length} commands. You're good to go.`);
        switchTab('rules');
        refreshSuggest('');
      } catch (e) {
        alert('JSON parse error: ' + e.message);
      }
    }
    parseBtn.onclick = () => parseJsonAndPersist(true);
    replaceBtn.onclick = () => parseJsonAndPersist(false);

    show();
  }

  // -------- hotkey --------
  function matchHotkey(ev, hk) {
    if (hk.ctrl !== undefined && hk.ctrl !== ev.ctrlKey) return false;
    if (hk.alt !== undefined && hk.alt !== ev.altKey) return false;
    if (hk.shift !== undefined && hk.shift !== ev.shiftKey) return false;
    return (hk.key || '').toLowerCase() === ev.key.toLowerCase();
  }

  (async function main() {
    if (!await get(STORAGE_RULES, null)) await set(STORAGE_RULES, DEFAULT_RULES);
    if (!await get(STORAGE_CMDS, null)) await set(STORAGE_CMDS, parseRulesToMap(await get(STORAGE_RULES, DEFAULT_RULES)));

    try {
      if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('QuickHost: Open', () => openModal());
        GM_registerMenuCommand('QuickHost: Edit/Import', () => openModal());
      }
    } catch {}

    window.addEventListener('keydown', (ev) => {
      if (!matchHotkey(ev, HOTKEY)) return;
      const t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      ev.preventDefault();
      openModal();
    }, true);

    console.log('QuickHost Command-Only (Glass) ready — Ctrl+Q to open.');
  })();
})();
s