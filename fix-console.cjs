#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixConsoleUsage(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Replace console.log with console.warn where appropriate
    // Only in non-debug/non-development contexts
    const patterns = [
      // Replace console.log with console.warn for general logging
      { from: /console\.log\(/g, to: 'console.warn(' },
      
      // Keep console.log for debug contexts (these are allowed)
      { from: /console\.warn\('🔊 AUDIO/g, to: "console.log('🔊 AUDIO" },
      { from: /console\.warn\('📦 Loaded/g, to: "console.log('📦 Loaded" },
      { from: /console\.warn\('✅ Fonts/g, to: "console.log('✅ Fonts" },
      { from: /console\.warn\('🚀 Performance/g, to: "console.log('🚀 Performance" },
      { from: /console\.warn\('✅ Resource/g, to: "console.log('✅ Resource" },
      { from: /console\.warn\('🖼️ Preloading/g, to: "console.log('🖼️ Preloading" },
      
      // Keep specific debug patterns as console.log
      { from: /console\.warn\('Custom prompt saved successfully'\)/g, to: "console.log('Custom prompt saved successfully')" },
      { from: /console\.warn\('API key status set to available/g, to: "console.log('API key status set to available" },
      { from: /console\.warn\('Loaded custom prompt/g, to: "console.log('Loaded custom prompt" },
      { from: /console\.warn\('No custom prompt found/g, to: "console.log('No custom prompt found" },
      { from: /console\.warn\('Runway video generation clicked'\)/g, to: "console.log('Runway video generation clicked')" },
      { from: /console\.warn\('Luma video generation clicked'\)/g, to: "console.log('Luma video generation clicked')" },
      { from: /console\.warn\('Runway generation blocked/g, to: "console.log('Runway generation blocked" },
      { from: /console\.warn\('Luma generation blocked/g, to: "console.log('Luma generation blocked" },
      { from: /console\.warn\('Calling luma-video edge function/g, to: "console.log('Calling luma-video edge function" },
      { from: /console\.warn\('Luma video response:/g, to: "console.log('Luma video response:" },
      { from: /console\.warn\('Luma video still processing/g, to: "console.log('Luma video still processing" },
      { from: /console\.warn\('No task ID received from Luma API'\)/g, to: "console.log('No task ID received from Luma API')" },
    ];
    
    patterns.forEach(pattern => {
      const newContent = content.replace(pattern.from, pattern.to);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed console usage in: ${filePath}`);
    }
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

function processDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !['node_modules', '.git', 'dist'].includes(item)) {
      processDirectory(fullPath);
    } else if (stat.isFile() && /\.(ts|tsx|js|jsx)$/.test(item)) {
      fixConsoleUsage(fullPath);
    }
  });
}

// Start from src directory
const srcDir = path.join(__dirname, 'src');
if (fs.existsSync(srcDir)) {
  console.log('Fixing console usage...');
  processDirectory(srcDir);
  console.log('Console usage fixes completed!');
} else {
  console.error('src directory not found');
}