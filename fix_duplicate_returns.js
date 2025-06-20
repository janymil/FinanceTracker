import fs from 'fs';

// Files that need fixing
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
  'server/adminAuth.ts',
  'server/routes/userRoutes.ts',
  'server/contact.ts',
  'server/uploadReceipt.ts'
];

files.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix duplicate return statements
    content = content.replace(/return return /g, 'return ');
    
    fs.writeFileSync(filePath, content);
    console.log(`Fixed duplicate returns in: ${filePath}`);
  }
});

console.log('Duplicate return fixes completed!');