#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixConstantNullish(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix patterns that cause "Unexpected constant nullishness" errors
    const patterns = [
      // typeof checks: typeof x === 'undefined' ?? y -> typeof x === 'undefined' || y  
      { from: /typeof\s+\w+\s*[!=]==?\s*['"]undefined['"]\s*\?\?\s*/g, to: match => match.replace('??', '||') },
      
      // Boolean literals: true ?? x -> true || x, false ?? x -> false || x
      { from: /\btrue\s*\?\?\s*/g, to: 'true || ' },
      { from: /\bfalse\s*\?\?\s*/g, to: 'false || ' },
      
      // Number literals: 0 ?? x -> 0 || x, 1 ?? x -> 1 || x 
      { from: /\b\d+\s*\?\?\s*/g, to: match => match.replace('??', '||') },
      
      // String literals: '' ?? x -> '' || x
      { from: /['""][^'"]*['"]\s*\?\?\s*/g, to: match => match.replace('??', '||') },
      
      // Environment checks: env.SOMETHING ?? x -> env.SOMETHING || x
      { from: /env\.\w+\s*\?\?\s*/g, to: match => match.replace('??', '||') },
      
      // Specific patterns that are clearly boolean or constant
      { from: /fontsLoaded\s*\?\?\s*/g, to: 'fontsLoaded || ' },
      { from: /\.length\s*\?\?\s*/g, to: match => match.replace('??', '||') },
      { from: /\.size\s*\?\?\s*/g, to: match => match.replace('??', '||') },
    ];
    
    patterns.forEach(pattern => {
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
      console.log(`Fixed constant nullish patterns in: ${filePath}`);
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
      fixConstantNullish(fullPath);
    }
  });
}

// Start from src directory
const srcDir = path.join(__dirname, 'src');
if (fs.existsSync(srcDir)) {
  console.log('Fixing constant nullish patterns...');
  processDirectory(srcDir);
  console.log('Constant nullish fixes completed!');
} else {
  console.error('src directory not found');
}