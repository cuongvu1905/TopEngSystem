// Unified Database Adapter selection (MySQL Adapter vs MockDB)
import { MockDB } from './mockDB';
import { MySQLAdapter } from './mysqlClient';

let db = MySQLAdapter; // Default to MySQLAdapter for real data

if (typeof window !== "undefined") {
  const dbType = localStorage.getItem("ems_db_type");
  if (dbType === "mock") {
    db = MockDB;
    console.log("EMS Database: Running in MockDB Local Mode");
  } else {
    db = MySQLAdapter;
    console.log("EMS Database: Running in MySQL Backend Mode");
  }
}

export { db };
export default db;
export { MockDB, MySQLAdapter };
