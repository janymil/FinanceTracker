
import { storage } from './server/storage.js';
import { db } from './server/db.js';
import { users } from './shared/schema.js';

async function checkUsers() {
  try {
    console.log('Checking users in local database...\n');
    
    // Get all users from database
    const allUsers = await db.select().from(users);
    
    console.log(`Total users found: ${allUsers.length}\n`);
    
    if (allUsers.length === 0) {
      console.log('No users found in the database.');
      return;
    }
    
    // Display user information
    console.log('Users in database:');
    console.log('==================');
    
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. User ID: ${user.id}`);
      console.log(`   Email: ${user.email || 'N/A'}`);
      console.log(`   Name: ${user.firstName || 'N/A'} ${user.lastName || 'N/A'}`);
      console.log(`   Plan: ${user.plan}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Updated: ${user.updatedAt}`);
      console.log('   ---');
    });
    
    // Show plan distribution
    const planCounts = allUsers.reduce((acc, user) => {
      acc[user.plan] = (acc[user.plan] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\nPlan distribution:');
    Object.entries(planCounts).forEach(([plan, count]) => {
      console.log(`   ${plan}: ${count} users`);
    });
    
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    process.exit(0);
  }
}

checkUsers();
