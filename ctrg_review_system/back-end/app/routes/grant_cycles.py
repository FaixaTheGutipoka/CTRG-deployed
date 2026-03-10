#"back-end/app/routes/grant_cycles.py"

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.database import get_db
from app.models.models import GrantCycle, User, Reviewer, Assignment
from app.schemas.schemas import GrantCycleCreate, GrantCycleOut
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/admin/grant-cycles", tags=["Admin - Grant Cycles"])

DEMO_EMAILS = {"admin@email.com", "pi@email.com", "reviewer@email.com"}


def get_admin(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["sub"])).first()
    if not user or user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("", response_model=list[GrantCycleOut])
def list_cycles(admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    return db.query(GrantCycle).order_by(GrantCycle.created_at.desc()).all()


@router.get("/active", response_model=GrantCycleOut)
def get_active_cycle(db: Session = Depends(get_db)):
    cycle = db.query(GrantCycle).filter(GrantCycle.is_active == True).first()  # noqa
    if not cycle:
        raise HTTPException(status_code=404, detail="No active grant cycle")
    return cycle


@router.post("", response_model=GrantCycleOut)
def create_cycle(
    body: GrantCycleCreate,
    admin: User = Depends(get_admin),
    db: Session = Depends(get_db),
):
    cycle = GrantCycle(**body.model_dump())
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle


@router.patch("/{cycle_id}/activate", response_model=GrantCycleOut)
def activate_cycle(
    cycle_id: int,
    admin: User = Depends(get_admin),
    db: Session = Depends(get_db),
):
    db.query(GrantCycle).update({"is_active": False})
    cycle = db.query(GrantCycle).filter(GrantCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Grant cycle not found")
    cycle.is_active = True
    db.commit()
    db.refresh(cycle)
    return cycle


@router.patch("/{cycle_id}/deactivate", response_model=GrantCycleOut)
def deactivate_cycle(
    cycle_id: int,
    admin: User = Depends(get_admin),
    db: Session = Depends(get_db),
):
    cycle = db.query(GrantCycle).filter(GrantCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Grant cycle not found")
    cycle.is_active = False
    db.commit()
    db.refresh(cycle)
    return cycle


# ── FIX #2: Reset roles — delete ALL reviewer table entries,
#    set user.role back to "user" for everyone except demo accounts & admins

@router.patch("/{cycle_id}/reset-roles")
def reset_roles(
    cycle_id: int,
    admin: User = Depends(get_admin),
    db: Session = Depends(get_db),
):
    cycle = db.query(GrantCycle).filter(GrantCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Grant cycle not found")

    all_reviewers = db.query(Reviewer).all()
    reset_count = 0

    for r in all_reviewers:
        # Step 1: Delete all assignments linked to this reviewer first
        db.query(Assignment).filter(Assignment.reviewer_id == r.id).delete()

        # Step 2: Reset user role
        user = r.user
        if user and user.email not in DEMO_EMAILS and user.role.lower() != "admin":
            user.role = "user"
            reset_count += 1

        # Step 3: Now safe to delete reviewer row
        db.delete(r)

    db.commit()
    return {"message": f"Reset complete. {reset_count} user(s) returned to 'user' role. Reviewer table cleared."}


@router.get("/{cycle_id}", response_model=GrantCycleOut)
def get_cycle(
    cycle_id: int,
    admin: User = Depends(get_admin),
    db: Session = Depends(get_db),
):
    cycle = db.query(GrantCycle).filter(GrantCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Grant cycle not found")
    return cycle


# ── FIX #3: PATCH /admin/grant-cycles/{id} — edit cycle details ───────────────

from pydantic import BaseModel as PydanticBaseModel
from typing import Optional as Opt

class GrantCycleUpdate(PydanticBaseModel):
    title: Opt[str] = None
    budget: Opt[float] = None
    description: Opt[str] = None
    submission_open: Opt[datetime] = None
    submission_close: Opt[datetime] = None
    stage1_start: Opt[datetime] = None
    stage1_end: Opt[datetime] = None
    stage2_start: Opt[datetime] = None
    stage2_end: Opt[datetime] = None

@router.patch("/{cycle_id}", response_model=GrantCycleOut)
def update_cycle(
    cycle_id: int,
    body: GrantCycleUpdate,
    admin: User = Depends(get_admin),
    db: Session = Depends(get_db),
):
    cycle = db.query(GrantCycle).filter(GrantCycle.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Grant cycle not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(cycle, field, value)
    db.commit()
    db.refresh(cycle)
    return cycle