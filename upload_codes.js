const fs = require('fs');
const { Pool } = require('pg');

// Read the CSV file
const csvContent = fs.readFileSync('./attached_assets/redemption-codes_1750417063935.csv', 'utf-8');
const codes = csvContent.trim().split('\n').filter(code => code.trim().length > 0);

console.log(`Found ${codes.length} codes to upload`);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function uploadCodes() {
  const client = await pool.connect();
  
  try {
    // Check how many codes are already in database
    const existingResult = await client.query('SELECT COUNT(*) FROM redeem_codes');
    const existingCount = parseInt(existingResult.rows[0].count);
    console.log(`Existing codes in database: ${existingCount}`);
    
    // Skip codes already uploaded (first 100 were uploaded manually)
    const codesToUpload = codes.slice(existingCount);
    console.log(`Uploading ${codesToUpload.length} new codes...`);
    
    if (codesToUpload.length === 0) {
      console.log('All codes already uploaded!');
      return;
    }
    
    // Batch insert remaining codes
    const batchSize = 50;
    let uploadedCount = 0;
    
    for (let i = 0; i < codesToUpload.length; i += batchSize) {
      const batch = codesToUpload.slice(i, i + batchSize);
      
      const values = batch.map((code, index) => `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`).join(', ');
      const params = batch.flatMap(code => [code.trim(), false, new Date()]);
      
      const query = `INSERT INTO redeem_codes (code, redeemed, created_at) VALUES ${values}`;
      
      await client.query(query, params);
      uploadedCount += batch.length;
      console.log(`Uploaded batch: ${uploadedCount}/${codesToUpload.length}`);
    }
    
    console.log(`Successfully uploaded ${uploadedCount} codes!`);
    
    // Verify total count
    const finalResult = await client.query('SELECT COUNT(*) FROM redeem_codes');
    const finalCount = parseInt(finalResult.rows[0].count);
    console.log(`Total codes in database: ${finalCount}`);
    
  } catch (error) {
    console.error('Error uploading codes:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

uploadCodes();