import { describe, expect, it } from 'vitest';

import { validateSeedSql, validateStudentSql } from '@/lib/sql-engine';

describe('SQL engine security validation', () => {
  it('blocks student SQL from reading files, environment variables, or external sources', () => {
    expect(validateStudentSql("SELECT getenv('SUPABASE_SERVICE_ROLE_KEY')")).toMatch(/cannot access/i);
    expect(validateStudentSql("SELECT * FROM read_text('/proc/self/environ')")).toMatch(/cannot access/i);
    expect(validateStudentSql("SELECT * FROM read_csv_auto('https://example.com/a.csv')")).toMatch(/cannot access/i);
    expect(validateStudentSql("SELECT * FROM read_json_auto('https://example.com/a.json')")).toMatch(/cannot access/i);
    expect(validateStudentSql("SELECT * FROM parquet_scan('https://example.com/a.parquet')")).toMatch(/cannot access/i);
    expect(validateStudentSql("SELECT * FROM glob('/tmp/*')")).toMatch(/cannot access/i);
  });

  it('blocks imported seed SQL from extension and external-access primitives', () => {
    expect(validateSeedSql("INSTALL httpfs; LOAD httpfs;")).toMatch(/cannot access/i);
    expect(validateSeedSql("CREATE TABLE t AS SELECT * FROM read_csv('https://example.com/a.csv')")).toMatch(/cannot access/i);
    expect(validateSeedSql("CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);")).toBeNull();
  });
});
