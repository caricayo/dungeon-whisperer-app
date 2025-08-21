#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fixUnusedVars(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Common patterns to fix unused variables
    const patterns = [
      // Unused error variables in catch blocks: catch (error) -> catch (_error)
      { from: /catch\s*\(\s*error\s*\)/g, to: 'catch (_error)' },
      { from: /catch\s*\(\s*err\s*\)/g, to: 'catch (_err)' },
      { from: /catch\s*\(\s*e\s*\)/g, to: 'catch (_e)' },
      
      // Unused function parameters: function(param, unused) -> function(param, _unused)
      { from: /\(\s*([^,)]+),\s*(error|err|unused|index|item|value|key)\s*\)/g, to: '($1, _$2)' },
      
      // Unused destructured variables: {used, unused} -> {used, _unused}
      { from: /{\s*([^,}]+),\s*(error|err|unused|index|item|value|key)\s*}/g, to: '{$1, _$2}' },
      
      // Common specific unused variable names
      { from: /const\s+error\s*=/g, to: 'const _error =' },
      { from: /let\s+error\s*=/g, to: 'let _error =' },
      { from: /const\s+err\s*=/g, to: 'const _err =' },
      { from: /let\s+err\s*=/g, to: 'let _err =' },
      
      // Function parameter patterns
      { from: /\(\s*([^,)]+),\s*error\s*\)\s*=>/g, to: '($1, _error) =>' },
      { from: /\(\s*([^,)]+),\s*err\s*\)\s*=>/g, to: '($1, _err) =>' },
      { from: /\(\s*([^,)]+),\s*index\s*\)\s*=>/g, to: '($1, _index) =>' },
      
      // Array destructuring: [used, unused] -> [used, _unused]  
      { from: /\[\s*([^,\]]+),\s*(error|err|unused|index|item|value|key)\s*\]/g, to: '[$1, _$2]' },
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
      console.log(`Fixed unused variables in: ${filePath}`);
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
      fixUnusedVars(fullPath);
    }
  });
}

// Start from src directory
const srcDir = path.join(__dirname, 'src');
if (fs.existsSync(srcDir)) {
  console.log('Fixing unused variables...');
  processDirectory(srcDir);
  console.log('Unused variable fixes completed!');
} else {
  console.error('src directory not found');
}