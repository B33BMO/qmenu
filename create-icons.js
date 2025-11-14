#!/usr/bin/env node

// Simple icon generator for Q-Menu
// Creates PNG icons from SVG using canvas (requires node-canvas)
// If you don't have node-canvas, just use generate-icons.html in a browser

const fs = require('fs');

console.log('\n🎨 Q-Menu Icon Generator\n');
console.log('This script requires node-canvas to be installed.');
console.log('If you don\'t have it, use generate-icons.html in a browser instead.\n');

try {
  const { createCanvas } = require('canvas');

  function createIcon(size, filename) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const radius = size * 0.15;
    const center = size / 2;

    // Background with gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#2a2a2a');
    gradient.addColorStop(1, '#1a1a1a');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius);
    ctx.fill();

    // Letter Q with better styling
    ctx.fillStyle = '#5b9cff';
    ctx.font = `bold ${size * 0.65}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Add subtle shadow for depth
    ctx.shadowColor = 'rgba(91, 156, 255, 0.3)';
    ctx.shadowBlur = size * 0.08;
    ctx.shadowOffsetY = size * 0.02;

    ctx.fillText('Q', center, center - size * 0.02);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Add subtle border for polish
    ctx.strokeStyle = 'rgba(91, 156, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, size - 1, size - 1, radius);
    ctx.stroke();

    // Save to file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filename, buffer);
    console.log(`✅ Created ${filename} (${size}x${size})`);
  }

  createIcon(48, 'icon48.png');
  createIcon(96, 'icon96.png');

  console.log('\n✨ Icons created successfully!\n');
  console.log('You can now load the extension in Firefox.');

} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log('❌ node-canvas is not installed.\n');
    console.log('You have two options:\n');
    console.log('1. Install node-canvas (may require system dependencies):');
    console.log('   npm install canvas\n');
    console.log('2. Use the browser-based generator (easier):');
    console.log('   Open generate-icons.html in your browser and save the images\n');
  } else {
    console.error('Error:', error.message);
  }
  process.exit(1);
}
