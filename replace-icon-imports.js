// Script to replace all lucide-react imports with centralized icon registry
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientSrcPath = path.join(__dirname, 'client', 'src');

// Function to recursively find all .tsx and .ts files
function findFiles(dir, extensions = ['.tsx', '.ts']) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      // Skip node_modules and other irrelevant directories
      if (!file.startsWith('.') && file !== 'node_modules') {
        results = results.concat(findFiles(filePath, extensions));
      }
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  });
  
  return results;
}

// Function to replace imports in a file
function replaceImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Skip the icon registry file itself
  if (filePath.includes('icons-registry.tsx')) {
    return false;
  }
  
  // Pattern to match lucide-react import statements
  const importPattern = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["'];?/g;
  
  // Check if file has lucide-react imports
  if (importPattern.test(content)) {
    // Reset regex
    importPattern.lastIndex = 0;
    
    // Replace lucide-react imports with icon registry imports
    content = content.replace(importPattern, (match, icons) => {
      const iconList = icons.split(',').map(icon => icon.trim()).join(', ');
      return `import { ${iconList} } from "@/lib/icons-registry";`;
    });
    
    modified = true;
    console.log(`Updated imports in: ${path.relative(clientSrcPath, filePath)}`);
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  
  return modified;
}

// Main execution
console.log('Starting icon import replacement...');

try {
  const files = findFiles(clientSrcPath);
  let totalModified = 0;
  
  files.forEach(filePath => {
    if (replaceImportsInFile(filePath)) {
      totalModified++;
    }
  });
  
  console.log(`\nCompleted! Modified ${totalModified} files.`);
  console.log('All lucide-react imports have been replaced with centralized icon registry imports.');
  
} catch (error) {
  console.error('Error during replacement:', error);
  process.exit(1);
}