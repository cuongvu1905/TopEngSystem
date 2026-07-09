import mysql from 'mysql2/promise';

let pool;

export function getPool() {
  if (!pool) {
    // Check if configuration exists in env
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = parseInt(process.env.MYSQL_PORT || '3306');
    const user = process.env.MYSQL_USER || 'root';
    const password = process.env.MYSQL_PASSWORD || '';
    const database = process.env.MYSQL_DATABASE || 'topsystemdb';

    try {
      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });
      console.log(`MySQL Connection Pool initialized successfully to ${host}:${port}/${database}`);
    } catch (e) {
      console.error('Failed to create MySQL Connection Pool:', e);
      throw e;
    }
  }
  return pool;
}

// Helper to execute SQL queries easily
export async function query(sql, params = []) {
  const dbPool = getPool();
  try {
    const [results] = await dbPool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('MySQL Query Execution Error:', error, 'SQL:', sql, 'Params:', params);
    throw error;
  }
}
