#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Remove all console.log statements from TypeScript/JavaScript files
 */
function removeConsoleLogs(content) {
  // Patterns to match different types of console statements
  const patterns = [
    // Standard console.log() statements
    /^\s*console\.(log|warn|error|info|debug)\s*\([^;]*\);\s*$/gm,
    
    // Multi-line console statements
    /^\s*console\.(log|warn|error|info|debug)\s*\(\s*[\s\S]*?\);\s*$/gm,
    
    // Console statements without semicolon
    /^\s*console\.(log|warn|error|info|debug)\s*\([^)]*\)\s*$/gm,
    
    // Console statements in the middle of lines (less common, but handle them)
    /console\.(log|warn|error|info|debug)\s*\([^)]*\);\s*/g,
    
    // Commented out console statements (also remove them)
    /^\s*\/\/\s*console\.(log|warn|error|info|debug)\s*\([^;]*\);\s*$/gm,
  ];

  let updatedContent = content;
  
  // Apply each pattern to remove console statements
  patterns.forEach(pattern => {
    updatedContent = updatedContent.replace(pattern, '');
  });

  // Clean up extra blank lines that might be left behind
  updatedContent = updatedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return updatedContent;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const originalLines = content.split('\n').length;
    
    const updatedContent = removeConsoleLogs(content);
    const updatedLines = updatedContent.split('\n').length;
    
    // Only write if content changed
    if (content !== updatedContent) {
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      const removedLines = originalLines - updatedLines;
      console.log(`✅ ${filePath} - Removed ${removedLines} line(s)`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Find all TypeScript and JavaScript files in src directory
 */
function findSourceFiles(dir) {
  const files = [];
  
  function scanDirectory(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        // Skip node_modules and other build directories
        if (!['node_modules', 'dist', 'build', '.git'].includes(item)) {
          scanDirectory(fullPath);
        }
      } else if (stats.isFile()) {
        // Check for TypeScript and JavaScript files
        const ext = path.extname(item);
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scanDirectory(dir);
  return files;
}

/**
 * Main execution
 */
function main() {
  const srcDir = path.join(__dirname, 'src');
  
  if (!fs.existsSync(srcDir)) {
    console.error('❌ src directory not found');
    process.exit(1);
  }
  
  console.log('🔍 Finding source files...');
  const sourceFiles = findSourceFiles(srcDir);
  
  console.log(`📝 Found ${sourceFiles.length} source files`);
  console.log('🧹 Removing console logs...\n');
  
  let processedCount = 0;
  let modifiedCount = 0;
  
  for (const file of sourceFiles) {
    const wasModified = processFile(file);
    processedCount++;
    if (wasModified) {
      modifiedCount++;
    }
  }
  
  console.log(`\n🎉 Completed! Processed ${processedCount} files, modified ${modifiedCount} files`);
}

// Run the script
main();
