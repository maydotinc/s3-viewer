import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db : Database.Database = new Database(path.resolve(__dirname, '../sqlite.db'));

export default db;