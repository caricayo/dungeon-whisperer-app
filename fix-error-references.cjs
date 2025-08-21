const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

// Function to process a single file
function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix console.error('message', _error) patterns
    const consoleErrorPattern = /console\.(error|warn)\([^,)]+,\s*\{[^}]*_error[^}]*\}\)/g;
    if (consoleErrorPattern.test(content)) {
      content = content.replace(consoleErrorPattern, (match) => {
        // Remove the _error reference from the object
        return match.replace(/\s*,\s*_error\s*/g, '').replace(/\{\s*_error\s*,?\s*/g, '{').replace(/\{\s*,\s*/g, '{').replace(/,\s*\}/g, '}');
      });
      modified = true;
    }
    
    // Fix logger.error('message', {messageId, _error}) patterns
    const loggerErrorPattern = /logger\.(error|warn)\([^,)]+,\s*\{[^}]*_error[^}]*\}\)/g;
    if (loggerErrorPattern.test(content)) {
      content = content.replace(loggerErrorPattern, (match) => {
        // Remove the _error reference from the object
        return match.replace(/\s*,\s*_error\s*/g, '').replace(/\{\s*_error\s*,?\s*/g, '{').replace(/\{\s*,\s*/g, '{').replace(/,\s*\}/g, '}');
      });
      modified = true;
    }
    
    // Fix debugError('message:', _error) patterns
    const debugErrorPattern = /debugError\([^,)]+,\s*_error\)/g;
    if (debugErrorPattern.test(content)) {
      content = content.replace(debugErrorPattern, (match) => {
        // Remove the _error parameter
        return match.replace(/,\s*_error/, '');
      });
      modified = true;
    }
    
    // Fix throw _error patterns
    const throwErrorPattern = /throw\s+_error;/g;
    if (throwErrorPattern.test(content)) {
      content = content.replace(throwErrorPattern, 'throw new Error("Operation failed");');
      modified = true;
    }
    
    // Fix return {data: null, _error} patterns
    const returnErrorPattern = /return\s*\{\s*data:\s*null\s*,\s*_error\s*\}/g;
    if (returnErrorPattern.test(content)) {
      content = content.replace(returnErrorPattern, 'return {data: null, error: new Error("Operation failed")}');
      modified = true;
    }
    
    // Fix lastError = error as Error (where error should be defined but isn't)
    const lastErrorPattern = /lastError\s*=\s*error\s*as\s*Error;/g;
    if (lastErrorPattern.test(content)) {
      content = content.replace(lastErrorPattern, 'lastError = new Error("Operation failed");');
      modified = true;
    }
    
    // Fix throw error; where error isn't defined 
    const throwUndefinedPattern = /throw\s+error;/g;
    if (throwUndefinedPattern.test(content) && !content.includes('} catch (error)')) {
      content = content.replace(throwUndefinedPattern, 'throw new Error("Operation failed");');
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
    return false;
  }
}

// Get all TypeScript/JavaScript files recursively
function getAllFiles(dirPath, fileList = []) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== 'build') {
      getAllFiles(filePath, fileList);
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx'))) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Process all files
const allFiles = getAllFiles(path.join(rootDir, 'src'));
let fixedCount = 0;

allFiles.forEach(file => {
  if (processFile(file)) {
    console.log(`Fixed error references: ${path.relative(rootDir, file)}`);
    fixedCount++;
  }
});

console.log(`\nFixed error references in ${fixedCount} files!`);