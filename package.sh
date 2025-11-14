#!/bin/bash

# Q-Menu Extension Packager

echo ""
echo "📦 Q-Menu Extension Packager"
echo ""

# Check if icons exist
if [ ! -f "icon48.png" ] || [ ! -f "icon96.png" ]; then
    echo "❌ Error: Icon files not found!"
    echo ""
    echo "Please generate icons first:"
    echo "  1. Open generate-icons.html in a browser, or"
    echo "  2. Run: node create-icons.js"
    echo ""
    exit 1
fi

# Create the package
echo "Creating qmenu.xpi..."
zip -r qmenu.xpi \
    manifest.json \
    background.js \
    content.js \
    options.html \
    options.js \
    popup.html \
    popup.js \
    icon48.png \
    icon96.png \
    -x "*.DS_Store" "*.git*" "*.md" "q-menu.js" "generate-icons.html" "create-icons.js" "package.sh" "*.svg" "node_modules/*" "package.json" "package-lock.json"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Package created successfully!"
    echo ""
    echo "📄 File: qmenu.xpi"
    echo "📊 Size: $(du -h qmenu.xpi | cut -f1)"
    echo ""
    echo "To install:"
    echo "  1. Open Firefox"
    echo "  2. Go to about:addons"
    echo "  3. Click the gear icon"
    echo "  4. Select 'Install Add-on From File'"
    echo "  5. Choose qmenu.xpi"
    echo ""
else
    echo "❌ Error creating package"
    exit 1
fi
