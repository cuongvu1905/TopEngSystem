const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error(JSON.stringify({ success: false, error: "Missing SQL query argument" }, null, 2));
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
      user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
      password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : process.env.MYSQL_PASSWORD,
      database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'topsystemdb',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : (process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306)
    });

    const [rows] = await connection.query(query);
    console.log(JSON.stringify({ success: true, results: rows }, (key, value) => {
      return typeof value === 'bigint' ? value.toString() : value;
    }, 2));
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

main();
