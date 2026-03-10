# back-end/app/routes/auth.py
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.models import User
from app.auth.hashing import hash_password, verify_password
from app.auth.jwt_handler import create_access_token
from app.schemas.schemas import LoginSchema, ForgotPasswordRequest, ResetPasswordRequest
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])

IT_EMAIL = "it@northsouth.edu"
IT_PASSWORD = "IT12345678"  # hardcoded IT credentials

# ── POST /auth/login ──────────────────────────────────────────────────────────
# Issue #1: Everyone is a PI. is_pi=True for all DB users.
@router.post("/login")
def login(request: LoginSchema, db: Session = Depends(get_db)):
    # Special case: IT account (hardcoded, not in DB)
    if request.email.lower() == IT_EMAIL:
        if request.password != IT_PASSWORD:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        token = create_access_token({"sub": "0", "email": IT_EMAIL, "role": "it", "is_pi": False})
        return {"access_token": token, "role": "it", "is_pi": False, "full_name": "IT Administrator"}

    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    # Issue #1: Every DB user is also a PI
    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "is_pi": True,          # <-- universal PI flag
    })
    return {
        "access_token": token,
        "role": user.role,
        "is_pi": True,
        "full_name": user.full_name,
    }


# ── GET /auth/me ──────────────────────────────────────────────────────────────
# Issue #9: frontend needs PI details from DB to pre-fill proposal form
@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.get("role") == "it":
        raise HTTPException(status_code=403, detail="IT account has no profile")
    user = db.query(User).filter(User.id == int(current_user["sub"])).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "is_pi": True,
        "department": user.department,
        "expertise": user.expertise,
    }


# ── POST /auth/forgot-password ────────────────────────────────────────────────
@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    generic_msg = "If an account exists for this email, a password reset link has been sent."
    if not user:
        return {"message": generic_msg, "demo_token": None}
    raw_token = secrets.token_urlsafe(32)
    user.reset_token = raw_token
    user.reset_token_expiry = datetime.now(timezone.utc) + timedelta(minutes=30)
    db.commit()
    return {"message": generic_msg, "demo_token": raw_token}


# ── POST /auth/reset-password ─────────────────────────────────────────────────
@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(data.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    user = db.query(User).filter(User.reset_token == data.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    now = datetime.now(timezone.utc)
    expiry = user.reset_token_expiry
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if now > expiry:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    user.password_hash = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.commit()
    return {"message": "Password reset successful"}


# ── IT: Chairman (Admin) Management ──────────────────────────────────────────
class ChairmanAssignRequest(BaseModel):
    user_id: int


def require_it(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "it":
        raise HTTPException(status_code=403, detail="IT access only")
    return current_user


@router.get("/chairman")
def get_current_chairman(it=Depends(require_it), db: Session = Depends(get_db)):
    chairman = db.query(User).filter(User.role == "admin").first()
    if not chairman:
        return {"chairman": None}
    return {"chairman": {"id": chairman.id, "full_name": chairman.full_name, "email": chairman.email}}


@router.get("/chairman/candidates")
def get_chairman_candidates(it=Depends(require_it), db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role != "admin", User.is_active == True).all()  # noqa
    return [{"id": u.id, "full_name": u.full_name, "email": u.email, "role": u.role} for u in users]


@router.post("/chairman/assign")
def assign_chairman(body: ChairmanAssignRequest, it=Depends(require_it), db: Session = Depends(get_db)):
    existing_admin = db.query(User).filter(User.role == "admin").first()
    if existing_admin:
        raise HTTPException(
            status_code=400,
            detail=f"Chairman already assigned ({existing_admin.full_name}). Dismiss them first."
        )
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = "admin"
    db.commit()
    return {"message": f"{user.full_name} has been assigned as Chairman/Admin."}


@router.post("/chairman/dismiss")
def dismiss_chairman(it=Depends(require_it), db: Session = Depends(get_db)):
    chairman = db.query(User).filter(User.role == "admin").first()
    if not chairman:
        raise HTTPException(status_code=404, detail="No chairman currently assigned.")
    chairman.role = "user"
    db.commit()
    return {"message": f"{chairman.full_name} has been dismissed as Chairman."}