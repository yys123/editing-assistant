#!/usr/bin/env python3
"""Admin script for managing registration codes.

Usage:
  python manage_codes.py generate [N]   # generate N codes (default 10)
  python manage_codes.py list           # list all codes and their status
  python manage_codes.py delete <code>  # remove an unused code
"""

import sys
import uuid
import db


def cmd_generate(n: int = 10):
    db.init_db()
    codes = [uuid.uuid4().hex[:12].upper() for _ in range(n)]
    for code in codes:
        db.add_registration_code(code)
    print(f"Generated {n} registration code(s):\n")
    for code in codes:
        print(f"  {code}")


def cmd_list():
    db.init_db()
    rows = db.list_registration_codes()
    if not rows:
        print("No registration codes found.")
        return
    print(f"{'Code':<14}  {'Status':<8}  {'Used by':<34}  Created at")
    print("-" * 80)
    for r in rows:
        status = "used" if r["used_at"] else "unused"
        used_by = r["used_by"] or "-"
        print(f"{r['code']:<14}  {status:<8}  {used_by:<34}  {r['created_at'][:19]}")


def cmd_delete(code: str):
    db.init_db()
    rows = db.list_registration_codes()
    match = next((r for r in rows if r["code"] == code.upper()), None)
    if not match:
        print(f"Code '{code}' not found.")
        return
    if match["used_at"]:
        print(f"Code '{code}' has already been used and cannot be deleted.")
        return
    import sqlite3
    from pathlib import Path
    db_path = Path(__file__).parent / "data" / "sessions.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute("DELETE FROM registration_codes WHERE code = ?", (code.upper(),))
    conn.commit()
    conn.close()
    print(f"Deleted code '{code}'.")


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)
    cmd = args[0]
    if cmd == "generate":
        n = int(args[1]) if len(args) > 1 else 10
        cmd_generate(n)
    elif cmd == "list":
        cmd_list()
    elif cmd == "delete" and len(args) > 1:
        cmd_delete(args[1])
    else:
        print(__doc__)
        sys.exit(1)
