// Q-Menu Content Script
// Handles Ctrl+Q hotkey and launcher UI

(() => {
  'use strict';

  const HOTKEY = { ctrl: true, alt: false, shift: false, key: 'q' };
  const STORAGE_RULES = 'qmenu_rules';
  const STORAGE_CMDS = 'qmenu_cmds';

  const DEFAULT_RULES = `# One rule per line: left side is the command, right side is the URL.
# Examples:
# github     = https://github.com
# gmail      = https://mail.google.com
# drive      = https://drive.google.com

github  = https://github.com
gmail   = https://mail.google.com
youtube = https://youtube.com
reddit  = https://reddit.com
`;

  // HTML escape helper for security
  const escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // Storage helpers using browser.storage.local
  const get = async (key, defaultValue) => {
    try {
      const result = await browser.storage.local.get(key);
      return result[key] ?? defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const set = async (key, value) => {
    try {
      await browser.storage.local.set({ [key]: value });
    } catch (e) {
      console.warn('Storage set failed:', e);
    }
  };

  // Parse rules text into command map
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

  // JSON importer
  function importCustomerJsonToRules(obj) {
    const rules = [];
    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^\w]+/g, ' ').trim().replace(/\s+/g, ' ');
    const token = s => norm(s).replace(/\s+/g, '_');

    try {
      if (obj?.groups && typeof obj.groups === 'object') {
        for (const letter of Object.keys(obj.groups)) {
          for (const customer of obj.groups[letter] || []) {
            const code = norm(customer.code).replace(/\s+/g, '');
            for (const svc of (customer.services || [])) {
              const t = token(svc.name);
              if (!t || !svc.url) continue;
              rules.push(`${t} ${code} = ${svc.url}`);

              const shortMap = {
                prometheus: 'prom', grafana: 'graf', smokeping: 'smoke',
                'offsite_nas': 'offsite', 'nas1': 'nas1', 'pm1': 'pm1',
                'pm2': 'pm2', 'pm3': 'pm3', 'gitlab': 'gitlab',
                'router': 'router', 'admin': 'admin', 'pbx': 'pbx'
              };
              const short = shortMap[t];
              if (short && short !== t) {
                rules.push(`${short} ${code} = ${svc.url}`);
              }

              const parts = norm(svc.name).split(' ').filter(Boolean);
              if (parts.length > 1) {
                const base = parts[0];
                const extra = parts.slice(1).join('_');
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

    const lastWins = {};
    for (const r of rules) {
      const [lhs] = r.split('=');
      lastWins[lhs.trim().toLowerCase()] = r.trim();
    }
    return Object.values(lastWins).sort((a, b) => a.localeCompare(b)).join('\n');
  }

  // Build modal with flat/dark UI (no glass effects)
  function buildModal() {
    if (document.getElementById('qmenu-modal')) return document.getElementById('qmenu-modal');

    const style = document.createElement('style');
    style.textContent = `
      #qmenu-modal {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      }
      #qmenu-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
      }
      #qmenu-card {
        position: relative;
        width: min(760px, 94%);
        max-height: 90vh;
        overflow-y: auto;
        background: #1a1a1a;
        border-radius: 8px;
        padding: 24px;
        box-sizing: border-box;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
        color: #e0e0e0;
      }
      #qmenu-card::-webkit-scrollbar {
        width: 10px;
      }
      #qmenu-card::-webkit-scrollbar-track {
        background: #0a0a0a;
        border-radius: 4px;
      }
      #qmenu-card::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 4px;
      }
      #qmenu-card::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      #qmenu-card {
        scrollbar-width: thin;
        scrollbar-color: #444 #0a0a0a;
      }
      #qmenu-title {
        font-weight: 600;
        font-size: 18px;
        margin-bottom: 16px;
        color: #ffffff;
      }
      #qmenu-input {
        width: 100%;
        padding: 12px 14px;
        font-size: 16px;
        border-radius: 6px;
        outline: none;
        box-sizing: border-box;
        border: 2px solid #333;
        background: #2a2a2a;
        color: #e0e0e0;
        transition: border-color 0.2s;
      }
      #qmenu-input:focus {
        border-color: #5b9cff;
      }
      #qmenu-input::placeholder {
        color: #888;
      }
      #qmenu-hint {
        margin-top: 8px;
        font-size: 12px;
        color: #999;
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      #qmenu-count {
        padding: 3px 10px;
        border-radius: 12px;
        background: #2a2a2a;
        border: 1px solid #333;
        font-size: 11px;
        color: #aaa;
      }
      #qmenu-buttons {
        margin-top: 16px;
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      .qmenu-btn {
        padding: 10px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        color: #e0e0e0;
        background: #2a2a2a;
        border: 1px solid #444;
        transition: all 0.2s;
      }
      .qmenu-btn:hover {
        background: #333;
        border-color: #555;
      }
      .qmenu-btn-primary {
        background: #5b9cff;
        border-color: #5b9cff;
        color: #fff;
      }
      .qmenu-btn-primary:hover {
        background: #4a8ae8;
        border-color: #4a8ae8;
      }
      .qmenu-right {
        margin-left: auto;
        display: flex;
        gap: 8px;
      }
      #qmenu-panels {
        margin-top: 16px;
      }
      .qmenu-tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 12px;
        border-bottom: 1px solid #333;
      }
      .qmenu-tab {
        padding: 8px 16px;
        cursor: pointer;
        font-size: 13px;
        color: #999;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }
      .qmenu-tab:hover {
        color: #e0e0e0;
      }
      .qmenu-tab.active {
        color: #5b9cff;
        border-bottom-color: #5b9cff;
      }
      .qmenu-panel {
        display: none;
      }
      .qmenu-panel.active {
        display: block;
      }
      textarea.qmenu-textarea {
        width: 100%;
        height: min(280px, 35vh);
        border-radius: 6px;
        padding: 12px;
        box-sizing: border-box;
        background: #2a2a2a;
        color: #e0e0e0;
        border: 1px solid #333;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
        font-size: 13px;
        line-height: 1.5;
        resize: vertical;
        overflow-y: auto;
      }
      textarea.qmenu-textarea:focus {
        outline: none;
        border-color: #5b9cff;
      }
      textarea.qmenu-textarea::-webkit-scrollbar {
        width: 10px;
      }
      textarea.qmenu-textarea::-webkit-scrollbar-track {
        background: #1a1a1a;
        border-radius: 4px;
      }
      textarea.qmenu-textarea::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 4px;
      }
      textarea.qmenu-textarea::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      #qmenu-suggest {
        margin-top: 12px;
        max-height: min(280px, 30vh);
        overflow-y: scroll !important;
        overflow-x: hidden;
        border-radius: 6px;
        padding: 8px;
        background: #2a2a2a;
        border: 1px solid #333;
        position: relative;
      }
      #qmenu-suggest::-webkit-scrollbar {
        width: 10px;
      }
      #qmenu-suggest::-webkit-scrollbar-track {
        background: #1a1a1a;
        border-radius: 4px;
      }
      #qmenu-suggest::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 4px;
      }
      #qmenu-suggest::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      /* Firefox scrollbar */
      #qmenu-suggest {
        scrollbar-width: thin;
        scrollbar-color: #444 #1a1a1a;
      }
      .qmenu-item {
        padding: 10px;
        border-bottom: 1px solid #333;
        cursor: pointer;
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .qmenu-item:last-child {
        border-bottom: none;
      }
      .qmenu-item:hover {
        background: #333;
      }
      .qmenu-item[data-key] {
        display: block;
      }
      .qmenu-key {
        color: #5b9cff;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .qmenu-url {
        color: #999;
        font-size: 12px;
        word-break: break-all;
      }
      .qmenu-new-rule {
        background: #2a2a2a;
        border: 1px solid #333;
        border-radius: 6px;
        padding: 16px;
        margin-top: 12px;
      }
      .qmenu-new-rule h4 {
        margin: 0 0 12px 0;
        color: #fff;
        font-size: 14px;
      }
      .qmenu-form-group {
        margin-bottom: 12px;
      }
      .qmenu-form-group label {
        display: block;
        margin-bottom: 6px;
        color: #aaa;
        font-size: 12px;
        font-weight: 500;
      }
      .qmenu-form-group input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 6px;
        border: 1px solid #333;
        background: #1a1a1a;
        color: #e0e0e0;
        font-size: 13px;
        box-sizing: border-box;
      }
      .qmenu-form-group input:focus {
        outline: none;
        border-color: #5b9cff;
      }
      .qmenu-form-group input::placeholder {
        color: #666;
      }
      .qmenu-form-buttons {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      .qmenu-delete-btn {
        background: #d93025;
        border-color: #d93025;
        color: #fff;
        margin-left: 4px;
        padding: 6px 10px;
        font-size: 11px;
      }
      .qmenu-delete-btn:hover {
        background: #c7291f;
        border-color: #c7291f;
      }
      #qmenu-rules-list {
        max-height: min(400px, 40vh);
        overflow-y: scroll !important;
        overflow-x: hidden;
        border-radius: 6px;
        background: #2a2a2a;
        border: 1px solid #333;
        position: relative;
      }
      #qmenu-rules-list::-webkit-scrollbar {
        width: 10px;
      }
      #qmenu-rules-list::-webkit-scrollbar-track {
        background: #1a1a1a;
        border-radius: 4px;
      }
      #qmenu-rules-list::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 4px;
      }
      #qmenu-rules-list::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      /* Firefox scrollbar */
      #qmenu-rules-list {
        scrollbar-width: thin;
        scrollbar-color: #444 #1a1a1a;
      }
      .qmenu-rule-item {
        padding: 12px;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      .qmenu-rule-item:last-child {
        border-bottom: none;
      }
      .qmenu-rule-item:hover {
        background: #333;
      }
      .qmenu-rule-info {
        flex: 1;
        min-width: 0;
      }
      .qmenu-rule-cmd {
        color: #5b9cff;
        font-weight: 600;
        font-size: 13px;
        margin-bottom: 4px;
      }
      .qmenu-rule-link {
        color: #999;
        font-size: 12px;
        word-break: break-all;
      }
      .qmenu-empty-state {
        padding: 40px 20px;
        text-align: center;
        color: #666;
      }
      /* Responsive adjustments for small screens */
      @media (max-height: 800px) {
        #qmenu-card {
          padding: 16px;
        }
        #qmenu-title {
          font-size: 16px;
          margin-bottom: 12px;
        }
        #qmenu-input {
          padding: 10px 12px;
          font-size: 14px;
        }
        #qmenu-hint {
          font-size: 11px;
        }
        .qmenu-btn {
          padding: 8px 12px;
          font-size: 12px;
        }
        .qmenu-new-rule {
          padding: 12px;
        }
        .qmenu-new-rule h4 {
          font-size: 13px;
          margin-bottom: 10px;
        }
        .qmenu-form-group {
          margin-bottom: 10px;
        }
        .qmenu-form-group label {
          font-size: 11px;
          margin-bottom: 4px;
        }
        .qmenu-form-group input {
          padding: 8px 10px;
          font-size: 12px;
        }
        textarea.qmenu-textarea {
          height: min(200px, 30vh);
          font-size: 12px;
        }
        #qmenu-suggest {
          max-height: min(180px, 25vh);
        }
        #qmenu-rules-list {
          max-height: min(300px, 35vh);
        }
      }
    `;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'qmenu-modal';
    el.innerHTML = `
      <div id="qmenu-overlay"></div>
      <div id="qmenu-card" role="dialog" aria-modal="true" aria-label="Q-Menu Launcher">
        <div id="qmenu-title">Q-Menu Quick Launcher</div>
        <input id="qmenu-input" placeholder="Type command: 'github', 'gmail', 'youtube'... Enter to open (Shift+Enter same tab)" autocomplete="off" />
        <div id="qmenu-hint">
          <span>Press Ctrl+Q to open</span>
          <span id="qmenu-count"></span>
        </div>
        <div id="qmenu-buttons">
          <button class="qmenu-btn qmenu-btn-primary" id="qmenu-open">Open</button>
          <button class="qmenu-btn" id="qmenu-open-same">Open (same tab)</button>
          <div class="qmenu-right">
            <button class="qmenu-btn" id="qmenu-edit">Edit Rules</button>
            <button class="qmenu-btn" id="qmenu-import">Import JSON</button>
            <button class="qmenu-btn" id="qmenu-close">Close</button>
          </div>
        </div>

        <div id="qmenu-panels" style="display:none">
          <div class="qmenu-tabs">
            <div class="qmenu-tab active" data-tab="simple">Add Rule</div>
            <div class="qmenu-tab" data-tab="manage">Manage Rules</div>
            <div class="qmenu-tab" data-tab="advanced">Advanced</div>
            <div class="qmenu-tab" data-tab="json">Import JSON</div>
          </div>

          <div class="qmenu-panel active" data-panel="simple">
            <div class="qmenu-new-rule">
              <h4>Add a New Rule</h4>
              <div class="qmenu-form-group">
                <label>What do you want to type?</label>
                <input type="text" id="qmenu-new-command" placeholder="e.g., 'github', 'router cap', 'zulip'" />
              </div>
              <div class="qmenu-form-group">
                <label>Where should it go?</label>
                <input type="url" id="qmenu-new-url" placeholder="e.g., https://github.com" />
              </div>
              <div class="qmenu-form-buttons">
                <button class="qmenu-btn qmenu-btn-primary" id="qmenu-add-rule">Add Rule</button>
                <button class="qmenu-btn" id="qmenu-clear-form">Clear</button>
              </div>
            </div>
            <div id="qmenu-suggest"></div>
          </div>

          <div class="qmenu-panel" data-panel="manage">
            <div id="qmenu-rules-list"></div>
          </div>

          <div class="qmenu-panel" data-panel="advanced">
            <textarea id="qmenu-rules" class="qmenu-textarea" spellcheck="false"></textarea>
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="qmenu-btn qmenu-btn-primary" id="qmenu-save">Save Rules</button>
              <button class="qmenu-btn" id="qmenu-rebuild">Rebuild Commands</button>
              <button class="qmenu-btn" id="qmenu-defaults">Reset to Defaults</button>
            </div>
          </div>

          <div class="qmenu-panel" data-panel="json">
            <textarea id="qmenu-json" class="qmenu-textarea" placeholder="Paste your JSON with groups/sections here..." spellcheck="false"></textarea>
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="qmenu-btn qmenu-btn-primary" id="qmenu-parse">Parse & Append → Save</button>
              <button class="qmenu-btn" id="qmenu-replace">Parse & Replace → Save</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  // Modal controller
  async function openModal() {
    const modal = buildModal();
    const overlay = modal.querySelector('#qmenu-overlay');
    const inp = modal.querySelector('#qmenu-input');
    const closeBtn = modal.querySelector('#qmenu-close');
    const openBtn = modal.querySelector('#qmenu-open');
    const openSameBtn = modal.querySelector('#qmenu-open-same');
    const editBtn = modal.querySelector('#qmenu-edit');
    const importBtn = modal.querySelector('#qmenu-import');
    const panels = modal.querySelector('#qmenu-panels');
    const tabs = modal.querySelectorAll('.qmenu-tab');
    const rulesArea = modal.querySelector('#qmenu-rules');
    const jsonArea = modal.querySelector('#qmenu-json');
    const saveBtn = modal.querySelector('#qmenu-save');
    const defaultsBtn = modal.querySelector('#qmenu-defaults');
    const rebuildBtn = modal.querySelector('#qmenu-rebuild');
    const parseBtn = modal.querySelector('#qmenu-parse');
    const replaceBtn = modal.querySelector('#qmenu-replace');
    const suggest = modal.querySelector('#qmenu-suggest');
    const countBadge = modal.querySelector('#qmenu-count');
    const newCommandInput = modal.querySelector('#qmenu-new-command');
    const newUrlInput = modal.querySelector('#qmenu-new-url');
    const addRuleBtn = modal.querySelector('#qmenu-add-rule');
    const clearFormBtn = modal.querySelector('#qmenu-clear-form');
    const rulesList = modal.querySelector('#qmenu-rules-list');

    let rulesText = await get(STORAGE_RULES, DEFAULT_RULES);
    let commands = await get(STORAGE_CMDS, parseRulesToMap(rulesText));

    const show = () => {
      modal.style.display = 'flex';
      inp.value = '';
      setTimeout(() => inp.focus(), 30);
      refreshSuggest('');
      refreshCount();
    };
    const hide = () => {
      modal.style.display = 'none';
      document.activeElement?.blur();
    };

    function refreshCount() {
      const n = Object.keys(commands).length;
      countBadge.textContent = `${n} commands`;
    }

    function switchTab(name) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
      modal.querySelectorAll('.qmenu-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
      if (name === 'manage') {
        refreshRulesList();
      }
    }

    function refreshSuggest(prefix) {
      const p = prefix.trim().toLowerCase();
      const items = [];
      let shown = 0;
      for (const [k, u] of Object.entries(commands)) {
        if (!p || k.includes(p)) {
          items.push(`<div class="qmenu-item" data-key="${escapeHtml(k)}"><div class="qmenu-key">${escapeHtml(k)}</div><div class="qmenu-url">${escapeHtml(u)}</div></div>`);
          if (++shown >= 400) break;
        }
      }
      suggest.innerHTML = items.join('') || '<div class="qmenu-item">No matches. Try typing &quot;github&quot;, &quot;gmail&quot;, etc.</div>';
      suggest.querySelectorAll('.qmenu-item').forEach(it => it.addEventListener('click', () => {
        inp.value = it.dataset.key;
        inp.focus();
      }));
    }

    function resolve(input) {
      const q = input.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!q) return null;
      if (commands[q]) return commands[q];

      const keys = Object.keys(commands);
      let found = keys.find(k => k.startsWith(q));
      if (found) return commands[found];

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

    function refreshRulesList() {
      const lines = rulesText.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed && !trimmed.startsWith('#');
      });

      if (lines.length === 0) {
        rulesList.innerHTML = '<div class="qmenu-empty-state">No rules yet. Go to "Add Rule" to create your first one!</div>';
        return;
      }

      const items = lines.map(line => {
        const match = line.match(/^(.+?)\s*=\s*(\S.+)$/);
        if (!match) return '';
        const cmd = match[1].trim();
        const url = match[2].trim();
        return `
          <div class="qmenu-rule-item">
            <div class="qmenu-rule-info">
              <div class="qmenu-rule-cmd">${escapeHtml(cmd)}</div>
              <div class="qmenu-rule-link">${escapeHtml(url)}</div>
            </div>
            <button class="qmenu-btn qmenu-delete-btn" data-command="${escapeHtml(cmd)}">Delete</button>
          </div>
        `;
      }).filter(Boolean).join('');

      rulesList.innerHTML = items;

      // Add delete handlers
      rulesList.querySelectorAll('.qmenu-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const cmd = btn.dataset.command;
          if (!confirm(`Delete rule "${cmd}"?`)) return;

          const newRulesText = rulesText.split('\n')
            .filter(line => {
              const match = line.match(/^(.+?)\s*=\s*(\S.+)$/);
              return !match || match[1].trim() !== cmd;
            })
            .join('\n');

          await saveRules(newRulesText);
          rulesArea.value = newRulesText;
          refreshRulesList();
        });
      });
    }

    function openUrl(sameTab) {
      const url = resolve(inp.value);
      if (!url) {
        alert(`No command for "${inp.value}". Open Edit → add a line or use Import.`);
        return;
      }
      hide();
      sameTab ? (window.location.href = url) : window.open(url, '_blank');
    }

    // Event handlers
    overlay.onclick = closeBtn.onclick = hide;
    openBtn.onclick = () => openUrl(false);
    openSameBtn.onclick = () => openUrl(true);
    inp.onkeydown = (e) => {
      if (e.key === 'Escape') return hide();
      if (e.key === 'Enter') {
        e.preventDefault();
        openUrl(e.shiftKey);
      }
    };
    inp.oninput = () => refreshSuggest(inp.value);

    editBtn.onclick = async () => {
      panels.style.display = panels.style.display === 'none' ? 'block' : 'none';
      switchTab('simple');
      rulesArea.value = rulesText;
      refreshSuggest('');
    };
    importBtn.onclick = () => {
      panels.style.display = 'block';
      switchTab('json');
      jsonArea.value = '';
    };
    tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

    // New rule form handlers
    clearFormBtn.onclick = () => {
      newCommandInput.value = '';
      newUrlInput.value = '';
      newCommandInput.focus();
    };

    addRuleBtn.onclick = async () => {
      const cmd = newCommandInput.value.trim().toLowerCase();
      const url = newUrlInput.value.trim();

      if (!cmd) {
        alert('Please enter a command (what you want to type)');
        newCommandInput.focus();
        return;
      }

      if (!url) {
        alert('Please enter a URL (where it should go)');
        newUrlInput.focus();
        return;
      }

      // Simple URL validation
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (!confirm('URL should start with http:// or https://. Add https:// automatically?')) {
          newUrlInput.focus();
          return;
        }
        newUrlInput.value = 'https://' + url;
        return;
      }

      // Check if command already exists
      const existingLines = rulesText.split('\n');
      const cmdExists = existingLines.some(line => {
        const match = line.match(/^(.+?)\s*=\s*(\S.+)$/);
        return match && match[1].trim().toLowerCase() === cmd;
      });

      if (cmdExists) {
        if (!confirm(`A rule for "${cmd}" already exists. Replace it?`)) {
          return;
        }
        // Remove existing rule
        const filtered = existingLines.filter(line => {
          const match = line.match(/^(.+?)\s*=\s*(\S.+)$/);
          return !match || match[1].trim().toLowerCase() !== cmd;
        });
        rulesText = filtered.join('\n');
      }

      // Add new rule
      const newRule = `${cmd} = ${url}`;
      const newRulesText = rulesText.trim() + '\n' + newRule;
      await saveRules(newRulesText);
      rulesArea.value = newRulesText;

      // Clear form and show success
      newCommandInput.value = '';
      newUrlInput.value = '';
      newCommandInput.focus();

      alert(`✓ Rule added! Type "${cmd}" and press Enter to use it.`);
      refreshSuggest('');
    };

    // Allow Enter key to submit in new rule form
    newCommandInput.onkeydown = newUrlInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addRuleBtn.click();
      }
    };

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

    async function parseJsonAndPersist(append) {
      try {
        const obj = JSON.parse(jsonArea.value);
        const newRules = importCustomerJsonToRules(obj);
        const merged = append
          ? (rulesText.trim() ? (rulesText.trim() + '\n' + newRules) : newRules)
          : newRules;
        await saveRules(merged);
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

  // Hotkey matcher
  function matchHotkey(ev, hk) {
    if (hk.ctrl !== undefined && hk.ctrl !== ev.ctrlKey) return false;
    if (hk.alt !== undefined && hk.alt !== ev.altKey) return false;
    if (hk.shift !== undefined && hk.shift !== ev.shiftKey) return false;
    return (hk.key || '').toLowerCase() === ev.key.toLowerCase();
  }

  // Initialize
  (async function main() {
    if (!await get(STORAGE_RULES, null)) {
      await set(STORAGE_RULES, DEFAULT_RULES);
    }
    if (!await get(STORAGE_CMDS, null)) {
      await set(STORAGE_CMDS, parseRulesToMap(await get(STORAGE_RULES, DEFAULT_RULES)));
    }

    window.addEventListener('keydown', (ev) => {
      if (!matchHotkey(ev, HOTKEY)) return;
      const t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      ev.preventDefault();
      openModal();
    }, true);

    // Listen for messages from background script
    browser.runtime.onMessage.addListener((message) => {
      if (message.action === 'openLauncher') {
        openModal();
      }
    });

    console.log('Q-Menu ready — Ctrl+Q to open.');
  })();
})();
