#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixBadNullishCoalescing(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix specific problematic patterns introduced by the previous script
    const badPatterns = [
      // Boolean negation incorrectly converted: !value ?? something -> !value || something
      { from: /!\w+\s*\?\?\s*/g, to: (match) => match.replace('??', '||') },
      
      // Boolean conditions in if statements: if (!value ?? condition) -> if (!value || condition)
      { from: /if\s*\(\s*!\w+\s*\?\?\s*/g, to: (match) => match.replace('??', '||') },
      
      // Boolean expressions: value ?? value.length -> value || value.length
      { from: /(\w+)\s*\?\?\s*\1\.length/g, to: '$1 || $1.length' },
      
      // Array/object length checks: !arr?.length ?? something -> !arr?.length || something
      { from: /!\w+\?\.\w+\s*\?\?\s*/g, to: (match) => match.replace('??', '||') },
      
      // typeof checks that were incorrectly converted
      { from: /typeof\s+\w+\s*===\s*['"]undefined['"]\s*\?\?\s*/g, to: (match) => match.replace('??', '||') },
      
      // Conditional expressions in function arguments
      { from: /if\s*\(\s*(\w+\?\.\w+)\s*\?\?\s*(\w+)/g, to: 'if ($1 || $2' },
    ];
    
    badPatterns.forEach(pattern => {
      if (typeof pattern.to === 'function') {
        const newContent = content.replace(pattern.from, pattern.to);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      } else {
        const newContent = content.replace(pattern.from, pattern.to);
        if (newContent !== content) {
          content = newContent;
          modified = true;
        }
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed bad nullish coalescing in: ${filePath}`);
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
      fixBadNullishCoalescing(fullPath);
    }
  });
}

// Start from src directory
const srcDir = path.join(__dirname, 'src');
if (fs.existsSync(srcDir)) {
  console.log('Fixing bad nullish coalescing patterns...');
  processDirectory(srcDir);
  console.log('Bad nullish coalescing fixes completed!');
} else {
  console.error('src directory not found');
}