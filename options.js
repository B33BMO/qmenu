// Options page script for Q-Menu

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

const rulesArea = document.getElementById('rules');
const saveBtn = document.getElementById('save');
const rebuildBtn = document.getElementById('rebuild');
const resetBtn = document.getElementById('reset');
const statusDiv = document.getElementById('status');

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

function showStatus(message, isError = false) {
  statusDiv.textContent = message;
  statusDiv.className = 'status ' + (isError ? 'error' : 'success');
  statusDiv.style.display = 'block';
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

// Load rules on page load
browser.storage.local.get([STORAGE_RULES]).then(result => {
  rulesArea.value = result[STORAGE_RULES] || DEFAULT_RULES;
});

// Save rules
saveBtn.addEventListener('click', async () => {
  const rulesText = rulesArea.value;
  const commands = parseRulesToMap(rulesText);

  await browser.storage.local.set({
    [STORAGE_RULES]: rulesText,
    [STORAGE_CMDS]: commands
  });

  showStatus(`Saved ${Object.keys(commands).length} commands successfully!`);
});

// Rebuild commands from current rules
rebuildBtn.addEventListener('click', async () => {
  const rulesText = rulesArea.value;
  const commands = parseRulesToMap(rulesText);

  await browser.storage.local.set({
    [STORAGE_CMDS]: commands
  });

  showStatus(`Rebuilt ${Object.keys(commands).length} commands!`);
});

// Reset to defaults
resetBtn.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to reset to default rules? This cannot be undone.')) {
    return;
  }

  rulesArea.value = DEFAULT_RULES;
  const commands = parseRulesToMap(DEFAULT_RULES);

  await browser.storage.local.set({
    [STORAGE_RULES]: DEFAULT_RULES,
    [STORAGE_CMDS]: commands
  });

  showStatus('Reset to defaults successfully!');
});
