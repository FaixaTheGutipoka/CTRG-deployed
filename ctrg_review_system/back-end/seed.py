"""
Run once to seed the database with demo users.
    python seed.py

IT account is hardcoded in auth.py (it@northsouth.edu / IT@ctrg2025)
Admin/Chairman is assigned via the IT panel — not seeded here.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, Base, SessionLocal
from app.models.models import User, Reviewer
from app.auth.hashing import hash_password

Base.metadata.create_all(bind=engine)

DEMO_USERS = [
    {"full_name": "Demo Admin (Chairman)", "email": "admin@email.edu", "password": "12345678", "role": "admin"},
    {"full_name": "Demo Reviewer",         "email": "reviewer@email.edu", "password": "12345678", "role": "reviewer"},
    {"full_name": "Demo PI",               "email": "pi@email.edu",       "password": "12345678", "role": "PI"},
    {"full_name": "Demo User",             "email": "user@email.edu",     "password": "12345678", "role": "user"},
]

db = SessionLocal()
for u in DEMO_USERS:
    existing = db.query(User).filter(User.email == u["email"]).first()
    if existing:
        print(f"  Skipping (already exists): {u['email']}")
        continue
    user = User(
        full_name=u["full_name"],
        email=u["email"],
        password_hash=hash_password(u["password"]),
        role=u["role"],
        is_active=True,
    )
    db.add(user)
    print(f"  Created: {u['email']}  role={u['role']}")

db.commit()
db.close()
print("\nDone! Demo users ready.")
print("\nIT Login: it@northsouth.edu / IT12345678  (use IT panel to assign Chairman)")