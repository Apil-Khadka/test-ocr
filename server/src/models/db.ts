import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbPath = process.env.DATABASE_URL || path.join(__dirname, '../../database.sqlite');

export const getDb = async () => {
  return open({
    filename: dbPath,
    driver: sqlite3.Database,
  });
};
