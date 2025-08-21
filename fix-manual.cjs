#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Manual fixes for specific constant nullish patterns
const fixes = [
  // Replace specific problematic patterns
  { from: /env\.VITE_APP_ENV\s*===\s*['"]development['"]\s*\?\?\s*/g, to: "env.VITE_APP_ENV === 'development' || " },
  { from: /env\.VITE_APP_ENV\s*===\s*['"]production['"]\s*\?\?\s*/g, to: "env.VITE_APP_ENV === 'production' || " },
  { from: /env\.VITE_APP_ENV\s*!==\s*['"]production['"]\s*\?\?\s*/g, to: "env.VITE_APP_ENV !== 'production' || " },
  
  // Fix environment-related patterns
  { from: /'development'\s*\?\?\s*/g, to: "'development' || " },
  { from: /'production'\s*\?\?\s*/g, to: "'production' || " },
  { from: /'test'\s*\?\?\s*/g, to: "'test' || " },
  
  // Fix specific property access patterns
  { from: /document\.visibilityState\s*===\s*['"]hidden['"]\s*\?\?\s*/g, to: "document.visibilityState === 'hidden' || " },
  { from: /window\.location\.protocol\s*===\s*['"]https:['"]\s*\?\?\s*/g, to: "window.location.protocol === 'https:' || " },
  
  // Script URL test patterns (for security.test.ts)
  { from: /expect\(result\)\.not\.toContain\(['"]javascript:['"]\)\s*\?\?\s*/g, to: "expect(result).not.toContain('javascript:') || " },
];

function applyManualFixes(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    fixes.forEach(fix => {
      const newContent = content.replace(fix.from, fix.to);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Applied manual fixes to: ${filePath}`);
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
      applyManualFixes(fullPath);
    }
  });
}

// Start from src directory
const srcDir = path.join(__dirname, 'src');
if (fs.existsSync(srcDir)) {
  console.log('Applying manual fixes...');
  processDirectory(srcDir);
  console.log('Manual fixes completed!');
} else {
  console.error('src directory not found');
}