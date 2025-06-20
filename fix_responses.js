import fs from 'fs';
import path from 'path';

// Files to fix
const files = [
  'server/routes/budgetRoutes.ts',
  'server/routes/aiRoutes.ts',
  'server/routes/collaborativeGoalRoutes.ts',
  'server/routes/goalRoutes.ts',
  'server/routes/exportRoutes.ts',
  'server/routes/stripeRoutes.ts',
  'server/routes/authRoutes.ts',
  'server/routes/redeemRoutes.ts',
  'server/routes/adminRoutes.ts',
  'server/routes/userRoutes.ts',
  'server/uploadReceipt.ts',
  'server/adminAuth.ts',
  'server/contact.ts'
];

files.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix patterns where res.json/send/status is not returned
    // Pattern 1: res.json(...); followed by } catch
    content = content.replace(/([ \t]*)res\.json\(([^;]+)\);(\s*}\s*catch)/g, '$1return res.json($2);$3');
    
    // Pattern 2: res.status(...).json(...); followed by } catch
    content = content.replace(/([ \t]*)res\.status\(([^)]+)\)\.json\(([^;]+)\);(\s*}\s*catch)/g, '$1return res.status($2).json($3);$4');
    
    // Pattern 3: res.send(...); followed by } catch
    content = content.replace(/([ \t]*)res\.send\(([^;]+)\);(\s*}\s*catch)/g, '$1return res.send($2);$3');
    
    // Pattern 4: res.status(...).send(...); followed by } catch
    content = content.replace(/([ \t]*)res\.status\(([^)]+)\)\.send\(([^;]+)\);(\s*}\s*catch)/g, '$1return res.status($2).send($3);$4');
    
    // Pattern 5: Inside catch blocks
    content = content.replace(/([ \t]*)res\.status\(([^)]+)\)\.json\(([^;]+)\);(\s*}[^c])/g, '$1return res.status($2).json($3);$4');
    content = content.replace(/([ \t]*)res\.json\(([^;]+)\);(\s*}[^c])/g, '$1return res.json($2);$3');
    content = content.replace(/([ \t]*)res\.send\(([^;]+)\);(\s*}[^c])/g, '$1return res.send($2);$3');
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
});

console.log('Response handling fixes completed!');