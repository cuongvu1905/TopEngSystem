const mysql = require('mysql2/promise');

const host = 'localhost';
const port = 3306;
const user = 'root';
const password = '';
const database = 'topsystemdb';

async function main() {
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database
  });
  console.log('Connected to MySQL');

  const [cols] = await conn.query('SHOW COLUMNS FROM Project');
  const existingCols = cols.map(c => c.Field);
  console.log('Current Project columns:', existingCols);

  if (!existingCols.includes('status')) {
    await conn.query("ALTER TABLE `Project` ADD COLUMN `status` VARCHAR(50) DEFAULT 'Thực thi'");
    console.log('Added status column');
  }

  if (!existingCols.includes('start_date')) {
    await conn.query("ALTER TABLE `Project` ADD COLUMN `start_date` VARCHAR(50) DEFAULT '2026-06-01'");
    console.log('Added start_date column');
  }

  if (!existingCols.includes('end_date')) {
    await conn.query("ALTER TABLE `Project` ADD COLUMN `end_date` VARCHAR(50) DEFAULT '2026-12-31'");
    console.log('Added end_date column');
  }

  if (!existingCols.includes('visibility')) {
    await conn.query("ALTER TABLE `Project` ADD COLUMN `visibility` VARCHAR(10) DEFAULT 'Private'");
    console.log('Added visibility column');
  }

  const [afterCols] = await conn.query('SHOW COLUMNS FROM Project');
  console.log('Updated Project columns:', afterCols.map(c => c.Field));

  await conn.end();
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
