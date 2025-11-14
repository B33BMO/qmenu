# Q-Menu Quick Launcher - 
![icon](https://github.com/user-attachments/assets/a830389e-085c-451c-b2c8-eb26652a5f5e)<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="10" height="10" rx="20" fill="#1a1a1a"/>
  <text x="50" y="70" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="#5b9cff" text-anchor="middle">Q</text>
</svg>


A Firefox extension for fast command-based navigation. Type commands like "router cap" or "pm1 cap" and jump to your frequently-used URLs instantly.

## Features

- **Quick Access**: Press `Ctrl+Q` anywhere to open the launcher
- **Command-Based**: Type simple commands instead of remembering full URLs
- **Modern UI**: Clean, flat dark design optimized for performance
- **Customizable**: Edit rules directly or import from JSON
- **Fast Matching**: Progressive prefix matching for quick navigation
- **Multi-Token Support**: Commands like "router val norfolk" work seamlessly

## Installation

### From Source (Development)

1. Clone or download this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Navigate to the extension directory and select `manifest.json`

### Permanent Installation

1. Package the extension:
   ```bash
   zip -r qmenu.zip manifest.json *.js *.html *.png
   ```
2. Go to `about:addons` in Firefox
3. Click the gear icon → "Install Add-on From File"
4. Select the `qmenu.zip` file

## Usage

### Basic Usage

1. Press `Ctrl+Q` to open the launcher
2. Type a command (e.g., "github", "gmail", "youtube")
3. Press `Enter` to open in a new tab
4. Press `Shift+Enter` to open in the same tab

### Managing Rules

#### Easy Way (For Everyone)

1. Press `Ctrl+Q` to open the launcher
2. Click "Edit Rules"
3. Choose the **"Add Rule"** tab
4. Fill in:
   - **What do you want to type?** (e.g., "github", "gmail")
   - **Where should it go?** (e.g., https://github.com)
5. Click "Add Rule"

That's it! No need to understand the text format.

#### Manage Existing Rules

1. Press `Ctrl+Q` → "Edit Rules"
2. Go to **"Manage Rules"** tab
3. See all your rules with Delete buttons
4. Click Delete to remove any rule

#### Advanced Way (For Power Users)

Rules follow this simple format:
```
command = https://url.here
```

Examples:
```
github  = https://github.com
gmail   = https://mail.google.com
youtube = https://youtube.com
netflix = https://netflix.com
```

Lines starting with `#` are comments.

**To edit manually:**
1. Press `Ctrl+Q` → "Edit Rules"
2. Go to **"Advanced"** tab
3. Edit the text directly
4. Click "Save Rules"

### Importing from JSON

If you have a structured JSON file with customer/service data:

1. Open the launcher (`Ctrl+Q`)
2. Click "Import JSON"
3. Paste your JSON
4. Click "Parse & Append → Save" (to add to existing rules)
   or "Parse & Replace → Save" (to replace all rules)

## Features

### Progressive Prefix Matching

The launcher is smart about matching commands:
- `router` matches the first command starting with "router"
- `router cap` matches "router cap" exactly
- `router val norfolk` matches multi-token commands

### Keyboard Shortcuts

- `Ctrl+Q` - Open launcher
- `Enter` - Open URL in new tab
- `Shift+Enter` - Open URL in same tab
- `Escape` - Close launcher

## Migrating from Tampermonkey

If you were using the Tampermonkey version:

1. Open the old script and copy your rules
2. Install this extension
3. Press `Ctrl+Q` → "Edit Rules"
4. Paste your rules and save

Your existing rules will work without modification!

## Development

The extension consists of:

- `manifest.json` - Extension configuration
- `background.js` - Background script for extension lifecycle
- `content.js` - Main launcher logic and UI
- `options.html/js` - Settings page
- `popup.html/js` - Toolbar popup

## Icons

Note: This extension currently uses placeholder icons. To customize:

1. Create `icon48.png` (48x48) and `icon96.png` (96x96)
2. Replace the placeholder files in the extension directory

## Support

For issues or feature requests, visit: https://bmo.guru/

## License

Created by BMO - https://bmo.guru/
