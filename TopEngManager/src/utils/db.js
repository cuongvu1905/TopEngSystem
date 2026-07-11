// Unified Database Adapter selection (MySQL Adapter vs MockDB)
import { MySQLAdapter } from './mysqlClient';

const db = MySQLAdapter; // Run only in MySQL Backend Mode

console.log("EMS Database: Running in MySQL Backend Mode");

export { db };
export default db;
export { MySQLAdapter };
