const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const host = 'localhost';
const port = 3306;
const user = 'root';
const password = '';

async function run() {
  console.log('Connecting to MySQL server...');
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  });
  console.log('Connected successfully!');

  const schemaPath = path.join(__dirname, 'Top_Sys.sql');
  console.log(`Reading schema from: ${schemaPath}`);
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Creating database and executing schema...');
  try {
    await connection.query(schemaSql);
    console.log('Schema imported successfully!');
  } catch (err) {
    console.error('Error during schema execution:');
    console.error('Message:', err.message);
    console.error('Code:', err.code);
    console.error('SQL State:', err.sqlState);
    throw new Error('Schema import failed');
  }

  const dataPath = path.join(__dirname, 'insertdemodata.sql');
  console.log(`Reading demo data from: ${dataPath}`);
  const dataSql = fs.readFileSync(dataPath, 'utf8');

  console.log('Inserting demo data (statement by statement)...');
  // Split statements by semicolon followed by newline or space
  const statements = dataSql
    .split(/;\s*[\r\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let successCount = 0;
  let skipCount = 0;

  for (let statement of statements) {
    // Append semicolon back if it's missing (except for comments or set commands)
    if (!statement.endsWith(';') && !statement.startsWith('--')) {
      statement += ';';
    }
    
    try {
      await connection.query(statement);
      successCount++;
    } catch (err) {
      const isTruncate = statement.toUpperCase().startsWith('TRUNCATE TABLE');
      if (err.code === 'ER_NO_SUCH_TABLE' && isTruncate) {
        console.warn(`[Warning] Skipping truncate for non-existent table: ${statement.split(';')[0]}`);
        skipCount++;
      } else {
        console.error('Error executing statement:', statement);
        console.error('Message:', err.message);
        console.error('Code:', err.code);
        throw err;
      }
    }
  }

  console.log(`Demo data insertion complete: ${successCount} queries succeeded, ${skipCount} skipped.`);
  await connection.end();
  console.log('Database import completed successfully!');
}

run().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
