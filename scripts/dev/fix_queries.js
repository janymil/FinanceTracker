// Quick script to find and replace all invalidateQueries patterns
const fs = require('fs');
const path = require('path');

const files = [
  'client/src/pages/transactions.tsx',
  'client/src/pages/expenses.tsx', 
  'client/src/pages/income.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace all invalidateQueries patterns with refetchQueries predicate
    content = content.replace(
      /queryClient\.invalidateQueries\(\{ queryKey: \["transactions"[^\}]*\}\);[\s]*queryClient\.invalidateQueries\(\{ queryKey: \["financial-summary"[^\}]*\}\);/g,
      'queryClient.refetchQueries({ predicate: (query) => query.queryKey[0] === "transactions" || query.queryKey[0] === "financial-summary" });'
    );
    
    // Replace single invalidateQueries calls
    content = content.replace(
      /queryClient\.invalidateQueries\(\{ queryKey: \["transactions"[^\}]*\}\);/g,
      'queryClient.refetchQueries({ predicate: (query) => query.queryKey[0] === "transactions" || query.queryKey[0] === "financial-summary" });'
    );
    
    content = content.replace(
      /queryClient\.invalidateQueries\(\{ queryKey: \["financial-summary"[^\}]*\}\);/g,
      'queryClient.refetchQueries({ predicate: (query) => query.queryKey[0] === "financial-summary" });'
    );
    
    fs.writeFileSync(file, content);
    console.log(`Fixed ${file}`);
  }
});