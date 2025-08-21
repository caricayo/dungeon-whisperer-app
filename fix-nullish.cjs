#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixNullishCoalescing(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Replace common patterns with nullish coalescing
    // Be careful not to replace logical OR when it's actually needed for boolean logic
    const patterns = [
      // Basic cases: value || 'default' -> value ?? 'default'
      { from: /\|\|\s*'([^']*)'(?![&|])/g, to: '?? \'$1\'' },
      { from: /\|\|\s*"([^"]*)"(?![&|])/g, to: '?? "$1"' },
      { from: /\|\|\s*`([^`]*)`(?![&|])/g, to: '?? `$1`' },
      
      // Variable || variable patterns  
      { from: /(\w+)\s*\|\|\s*(\w+)(?![&|])/g, to: '$1 ?? $2' },
      
      // Property access patterns
      { from: /(\w+\?\.\w+)\s*\|\|\s*'([^']*)'(?![&|])/g, to: '$1 ?? \'$2\'' },
      { from: /(\w+\?\.\w+)\s*\|\|\s*"([^"]*)"(?![&|])/g, to: '$1 ?? "$2"' },
      { from: /(\w+\?\.\w+)\s*\|\|\s*(\w+)(?![&|])/g, to: '$1 ?? $2' },
      
      // Function call results
      { from: /(\w+\([^)]*\))\s*\|\|\s*'([^']*)'(?![&|])/g, to: '$1 ?? \'$2\'' },
      { from: /(\w+\([^)]*\))\s*\|\|\s*"([^"]*)"(?![&|])/g, to: '$1 ?? "$2"' },
      
      // Array/object access
      { from: /(\w+\[.*?\])\s*\|\|\s*'([^']*)'(?![&|])/g, to: '$1 ?? \'$2\'' },
      { from: /(\w+\[.*?\])\s*\|\|\s*"([^"]*)"(?![&|])/g, to: '$1 ?? "$2"' },
      
      // Assignment patterns: value = value || default
      { from: /=\s*(\w+)\s*\|\|\s*(\w+)(?![&|])/g, to: '= $1 ?? $2' },
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
      console.log(`Fixed nullish coalescing in: ${filePath}`);
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
      fixNullishCoalescing(fullPath);
    }
  });
}

// Start from src directory
const srcDir = path.join(__dirname, 'src');
if (fs.existsSync(srcDir)) {
  console.log('Starting nullish coalescing fixes...');
  processDirectory(srcDir);
  console.log('Nullish coalescing fixes completed!');
} else {
  console.error('src directory not found');
}