import Database from 'better-sqlite3';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export type Value = string | number | bigint | Buffer | null;
export class Store {
  db: Database.Database;
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o750 });
    this.db = new Database(join(directory, 'runotter.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,applied_at INTEGER NOT NULL)',
    );
    for (const file of readdirSync('sql/migrations')
      .filter((n) => /^\d+_.*\.sql$/.test(n))
      .sort()) {
      if (!this.get('SELECT version FROM schema_migrations WHERE version=?', file))
        this.db.transaction(() => {
          this.db.exec(readFileSync(join('sql/migrations', file), 'utf8'));
          this.run('INSERT INTO schema_migrations VALUES(?,?)', file, Date.now());
        })();
    }
  }
  tables(names: string[]) {
    for (const statement of readFileSync('sql/schema.sql', 'utf8').split(';')) {
      const table = statement.match(/CREATE (?:VIRTUAL )?TABLE IF NOT EXISTS (\w+)/i)?.[1];
      const index = statement.match(/CREATE INDEX IF NOT EXISTS \w+\s+ON\s+(\w+)/i)?.[1];
      if ((table && names.includes(table)) || (index && names.includes(index)))
        this.db.exec(statement + ';');
    }
  }
  get<T>(sql: string, ...values: Value[]): T | undefined {
    return this.db.prepare(sql).get(...values) as T | undefined;
  }
  all<T>(sql: string, ...values: Value[]): T[] {
    return this.db.prepare(sql).all(...values) as T[];
  }
  run(sql: string, ...values: Value[]) {
    return this.db.prepare(sql).run(...values);
  }
  close() {
    this.db.close();
  }
}
