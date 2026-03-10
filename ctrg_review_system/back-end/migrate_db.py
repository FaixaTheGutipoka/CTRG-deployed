import sqlite3
import os

# ── Locate the database ───────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "ctrg.db")

if not os.path.exists(DB_PATH):
    print(f"ERROR: Database not found at {DB_PATH}")
    print("Make sure you run this script from the back-end folder.")
    exit(1)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# ── Helper: add a column only if it doesn't already exist ────────────────────
def add_column_if_missing(table: str, column: str, col_type: str, default=None):
    cur.execute(f"PRAGMA table_info({table})")
    existing = [row[1] for row in cur.fetchall()]
    if column in existing:
        print(f"  [SKIP] {table}.{column} already exists")
        return
    if default is not None:
        sql = f"ALTER TABLE {table} ADD COLUMN {column} {col_type} DEFAULT {default}"
    else:
        sql = f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
    cur.execute(sql)
    print(f"  [ADD]  {table}.{column}  ({col_type})")

# ── Helper: create a table only if it doesn't already exist ──────────────────
def create_table_if_missing(name: str, ddl: str):
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,))
    if cur.fetchone():
        print(f"  [SKIP] table '{name}' already exists")
        return
    cur.execute(ddl)
    print(f"  [CREATE] table '{name}'")

print("\n=== CTRG Database Migration ===\n")

# ── 1. users table — new columns ─────────────────────────────────────────────
print("→ users table")
add_column_if_missing("users", "department",  "VARCHAR")
add_column_if_missing("users", "expertise",   "VARCHAR")
add_column_if_missing("users", "is_demo",     "BOOLEAN", default=0)

# ── 2. proposals table — new columns (revision_count might be missing too) ───
print("→ proposals table")
add_column_if_missing("proposals", "revision_count", "INTEGER", default=0)

# ── 3. proposal_files table — brand new ──────────────────────────────────────
print("→ proposal_files table")
create_table_if_missing("proposal_files", """
    CREATE TABLE proposal_files (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        proposal_id      INTEGER NOT NULL REFERENCES proposals(id),
        file_path        VARCHAR NOT NULL,
        original_filename VARCHAR NOT NULL,
        file_size        INTEGER,
        mime_type        VARCHAR,
        uploaded_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )
""")

# ── 4. Commit ─────────────────────────────────────────────────────────────────
conn.commit()
conn.close()

print("\n✅  Migration complete. Your existing data is untouched.\n")