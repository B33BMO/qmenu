// Background script for Q-Menu extension
// Handles extension lifecycle and browser action clicks

console.log('Q-Menu background script loaded');

// Listen for action click (toolbar icon) - Manifest V3
browser.action.onClicked.addListener(() => {
  // Send message to active tab to open the launcher
  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs[0]) {
      browser.tabs.sendMessage(tabs[0].id, { action: 'openLauncher' })
        .catch(err => console.log('Could not communicate with page:', err));
    }
  });
});

// Initialize default storage if needed
browser.runtime.onInstalled.addListener(() => {
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

  browser.storage.local.get(['qmenu_rules', 'qmenu_cmds']).then(result => {
    if (!result.qmenu_rules) {
      browser.storage.local.set({ qmenu_rules: DEFAULT_RULES });
    }
  });
});
