# back-end/app/routes/reviewers.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.models import Reviewer, User, Proposal, Assignment, GrantCycle, Notification
from app.schemas.schemas import ReviewerCreate, AssignmentCreate
from app.auth.hashing import hash_password
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/admin/reviewers", tags=["Admin - Reviewers"])

# Issue #2: Exclude ONLY these 3 demo seed accounts (admin is NOT excluded)
DEMO_EMAILS = {"pi@email.com", "reviewer@email.com", "user@email.com"}


def get_admin(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["sub"])).first()
    if not user or user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def get_active_cycle(db: Session) -> Optional[GrantCycle]:
    return db.query(GrantCycle).filter(GrantCycle.is_active == True).first()  # noqa


def build_reviewer_out(r: Reviewer) -> dict:
    return {
        "id": r.id,
        "user_id": r.user_id,
        "full_name": r.user.full_name if r.user else "Unknown",
        "email": r.user.email if r.user else "Unknown",
        "expertise": r.expertise,
        "department": r.department,
        "is_active": r.is_active,
        "grant_cycle_id": r.grant_cycle_id,
        "created_at": r.created_at,
        "assigned_count": len(r.assignments) if r.assignments else 0,
    }


# ── GET /admin/reviewers — active reviewers only ──────────────────────────────
@router.get("")
def list_reviewers(admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    reviewers = (
        db.query(Reviewer)
        .options(joinedload(Reviewer.user), joinedload(Reviewer.assignments))
        .filter(Reviewer.is_active == True)  # noqa
        .all()
    )
    return [build_reviewer_out(r) for r in reviewers]


# ── GET /admin/reviewers/users ────────────────────────────────────────────────
# Issue #2: Show all users EXCEPT the 3 demo accounts; admin IS shown
@router.get("/users")
def list_all_users(admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    users = (
        db.query(User)
        .options(joinedload(User.reviewer_profile))
        .all()
    )
    result = []
    for u in users:
        # Exclude ONLY the 3 hardcoded demo seed accounts
        if u.email in DEMO_EMAILS:
            continue
        rp = u.reviewer_profile
        result.append({
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "is_reviewer": rp is not None and rp.is_active,
            "department": rp.department if rp else u.department,
            "expertise": rp.expertise if rp else u.expertise,
        })
    return result


# ── GET /admin/reviewers/{id}/overview ───────────────────────────────────────
@router.get("/{reviewer_id}/overview")
def reviewer_overview(reviewer_id: int, admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    reviewer = (
        db.query(Reviewer)
        .options(
            joinedload(Reviewer.user),
            joinedload(Reviewer.assignments).joinedload(Assignment.proposal),
        )
        .filter(Reviewer.id == reviewer_id)
        .first()
    )
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    assignments = []
    for a in reviewer.assignments:
        p = a.proposal
        cycle_title = None
        if p and p.grant_cycle_id:
            cycle = db.query(GrantCycle).filter(GrantCycle.id == p.grant_cycle_id).first()
            cycle_title = cycle.title if cycle else None
        assignments.append({
            "assignment_id": a.id,
            "proposal_id": p.id if p else None,
            "proposal_title": p.title if p else "—",
            "proposal_status": p.status if p else "—",
            "stage": a.stage,
            "grant_cycle": cycle_title or (p.grant_cycle if p else "—"),
            "assigned_at": a.assigned_at,
        })
    return {
        "id": reviewer.id,
        "full_name": reviewer.user.full_name if reviewer.user else "Unknown",
        "email": reviewer.user.email if reviewer.user else "Unknown",
        "department": reviewer.department,
        "expertise": reviewer.expertise,
        "is_active": reviewer.is_active,
        "total_assigned": len(assignments),
        "assignments": assignments,
    }


# ── POST /admin/reviewers/add-user ────────────────────────────────────────────
# Issue #11: Admin manually adds a user — they become a user (and automatically a PI)
class AddUserRequest(BaseModel):
    full_name: str
    email: str
    password: str
    department: Optional[str] = None
    expertise: Optional[str] = None


@router.post("/add-user")
def add_user(body: AddUserRequest, admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    """
    Issue #11: Create a plain user account.
    - They are automatically a PI (no extra step needed since all users are PIs)
    - Admin can later promote them to reviewer via assign-role
    - They can be added at any time, not just during active cycle
    """
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")
    new_user = User(
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
        role="user",          # base role; is_pi=True implicitly (Issue #1)
        department=body.department,
        expertise=body.expertise,
        is_active=True,
        is_demo=False,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {
        "message": f"User {new_user.full_name} created successfully. They can log in and submit proposals immediately.",
        "id": new_user.id,
        "full_name": new_user.full_name,
        "email": new_user.email,
        "role": new_user.role,
        "is_pi": True,
    }


# ── POST /admin/reviewers ─────────────────────────────────────────────────────
# Issue #11: Can only assign reviewer role after a cycle is activated
@router.post("")
def add_reviewer(body: ReviewerCreate, admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    # Issue #11: Require active cycle to assign reviewer role
    active_cycle = get_active_cycle(db)
    if not active_cycle:
        raise HTTPException(
            status_code=400,
            detail="No active grant cycle. Please activate a grant cycle before adding reviewers."
        )
    cycle_id = body.grant_cycle_id or active_cycle.id
    existing_user = db.query(User).filter(User.email == body.email).first()
    if existing_user:
        if existing_user.reviewer_profile:
            if existing_user.reviewer_profile.is_active:
                raise HTTPException(status_code=400, detail="This user is already an active reviewer")
            existing_user.role = "reviewer"
            existing_user.reviewer_profile.is_active = True
            existing_user.reviewer_profile.expertise = body.expertise
            existing_user.reviewer_profile.department = body.department
            existing_user.reviewer_profile.grant_cycle_id = cycle_id
            db.commit()
            db.refresh(existing_user.reviewer_profile)
            reviewer = (
                db.query(Reviewer)
                .options(joinedload(Reviewer.user), joinedload(Reviewer.assignments))
                .filter(Reviewer.id == existing_user.reviewer_profile.id)
                .first()
            )
        else:
            existing_user.role = "reviewer"
            reviewer = Reviewer(
                user_id=existing_user.id,
                expertise=body.expertise,
                department=body.department,
                grant_cycle_id=cycle_id,
                is_active=True,
            )
            db.add(reviewer)
            db.commit()
            db.refresh(reviewer)
            reviewer = (
                db.query(Reviewer)
                .options(joinedload(Reviewer.user), joinedload(Reviewer.assignments))
                .filter(Reviewer.id == reviewer.id)
                .first()
            )
    else:
        new_user = User(
            full_name=body.full_name,
            email=body.email,
            password_hash=hash_password(body.password),
            role="reviewer",
            is_active=True,
        )
        db.add(new_user)
        db.flush()
        reviewer = Reviewer(
            user_id=new_user.id,
            expertise=body.expertise,
            department=body.department,
            grant_cycle_id=cycle_id,
            is_active=True,
        )
        db.add(reviewer)
        db.commit()
        db.refresh(reviewer)
        reviewer = (
            db.query(Reviewer)
            .options(joinedload(Reviewer.user), joinedload(Reviewer.assignments))
            .filter(Reviewer.id == reviewer.id)
            .first()
        )
    return build_reviewer_out(reviewer)


# ── POST /admin/reviewers/assign-role ─────────────────────────────────────────
# Issue #11: Can only assign reviewer role if active cycle exists
class AssignRoleRequest(BaseModel):
    user_id: int
    expertise: Optional[str] = None
    department: Optional[str] = None


@router.post("/assign-role")
def assign_role_to_user(body: AssignRoleRequest, admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    active_cycle = get_active_cycle(db)
    if not active_cycle:
        raise HTTPException(
            status_code=400,
            detail="No active grant cycle. Activate a grant cycle before assigning reviewers."
        )
    user = (
        db.query(User)
        .options(joinedload(User.reviewer_profile))
        .filter(User.id == body.user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role.lower() == "admin":
        raise HTTPException(status_code=400, detail="Cannot change admin role")

    cycle_id = active_cycle.id
    if user.reviewer_profile:
        user.role = "reviewer"
        user.reviewer_profile.is_active = True
        user.reviewer_profile.expertise = body.expertise or user.reviewer_profile.expertise
        user.reviewer_profile.department = body.department or user.reviewer_profile.department
        if cycle_id:
            user.reviewer_profile.grant_cycle_id = cycle_id
        db.commit()
        return {"message": f"{user.full_name} restored as reviewer."}

    user.role = "reviewer"
    reviewer = Reviewer(
        user_id=user.id,
        expertise=body.expertise,
        department=body.department,
        grant_cycle_id=cycle_id,
        is_active=True,
    )
    db.add(reviewer)
    db.commit()
    return {"message": f"{user.full_name} assigned as reviewer."}


# ── POST /admin/reviewers/assign ──────────────────────────────────────────────
@router.post("/assign")
def assign_reviewers(body: AssignmentCreate, admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    active_cycle = get_active_cycle(db)
    if not active_cycle:
        raise HTTPException(status_code=400, detail="No active grant cycle.")
    if len(body.reviewer_ids) > 4:
        raise HTTPException(status_code=400, detail="Maximum 4 reviewers can be assigned")
    if len(body.reviewer_ids) == 0:
        raise HTTPException(status_code=400, detail="At least 1 reviewer required")
    proposal = db.query(Proposal).filter(Proposal.id == body.proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    created, skipped = [], []
    for r_id in body.reviewer_ids:
        reviewer = (
            db.query(Reviewer)
            .options(joinedload(Reviewer.user))
            .filter(Reviewer.id == r_id)
            .first()
        )
        if not reviewer:
            raise HTTPException(status_code=404, detail=f"Reviewer ID {r_id} not found")
        existing = db.query(Assignment).filter(
            Assignment.reviewer_id == r_id,
            Assignment.proposal_id == body.proposal_id,
        ).first()
        if existing:
            skipped.append(reviewer.user.full_name if reviewer.user else str(r_id))
            continue
        assignment = Assignment(
            reviewer_id=r_id,
            proposal_id=body.proposal_id,
            grant_cycle_id=proposal.grant_cycle_id,
            stage=body.stage,
        )
        db.add(assignment)
        db.add(Notification(
            user_id=reviewer.user_id,
            proposal_id=proposal.id,
            message=f"You have been assigned to review: \"{proposal.title}\" ({body.stage})",
        ))
        created.append(r_id)

    if body.stage and (created or skipped):
        proposal.stage = body.stage
    db.commit()

    msg = f"Assigned {len(created)} reviewer(s) to CTRG-{proposal.id}."
    if skipped:
        msg += f" Already assigned (skipped): {', '.join(skipped)}."
    return {"message": msg, "assigned": len(created), "skipped": len(skipped)}


# ── PATCH /admin/reviewers/{id}/deactivate ───────────────────────────────────
@router.patch("/{reviewer_id}/deactivate")
def deactivate_reviewer(reviewer_id: int, admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    reviewer = db.query(Reviewer).filter(Reviewer.id == reviewer_id).first()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    reviewer.is_active = False
    if reviewer.user:
        reviewer.user.role = "user"
    db.commit()
    return {"message": "Reviewer deactivated"}


# ── PATCH /admin/reviewers/{id}/activate ─────────────────────────────────────
@router.patch("/{reviewer_id}/activate")
def activate_reviewer(reviewer_id: int, admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    reviewer = db.query(Reviewer).filter(Reviewer.id == reviewer_id).first()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
    reviewer.is_active = True
    if reviewer.user:
        reviewer.user.role = "reviewer"
    db.commit()
    return {"message": "Reviewer activated"}


# ── GET /admin/reviewers/assignments/{proposal_id} ────────────────────────────
@router.get("/assignments/{proposal_id}")
def get_assignments(proposal_id: int, admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    assignments = (
        db.query(Assignment)
        .options(joinedload(Assignment.reviewer).joinedload(Reviewer.user))
        .filter(Assignment.proposal_id == proposal_id)
        .all()
    )
    return [
        {
            "assignment_id": a.id,
            "reviewer_id": a.reviewer_id,
            "full_name": a.reviewer.user.full_name if a.reviewer and a.reviewer.user else None,
            "email": a.reviewer.user.email if a.reviewer and a.reviewer.user else None,
            "department": a.reviewer.department if a.reviewer else None,
            "expertise": a.reviewer.expertise if a.reviewer else None,
            "stage": a.stage,
            "assigned_at": a.assigned_at,
        }
        for a in assignments
    ]


# ── DELETE /admin/reviewers/assignments/{assignment_id} ──────────────────────
@router.delete("/assignments/{assignment_id}")
def remove_assignment(assignment_id: int, admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(assignment)
    db.commit()
    return {"message": "Assignment removed"}