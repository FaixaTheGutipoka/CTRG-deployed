#"back-end/app/routes/reports.py"

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Proposal, GrantCycle, User, Assignment
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/admin/reports", tags=["Admin - Reports"])


def get_admin(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["sub"])).first()
    if not user or user.role.lower() != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# GET /admin/reports
# Returns a summary report for each grant cycle

@router.get("")
def get_reports(admin: User = Depends(get_admin), db: Session = Depends(get_db)):
    cycles = db.query(GrantCycle).order_by(GrantCycle.created_at.desc()).all()
    reports = []

    for cycle in cycles:
        proposals = db.query(Proposal).filter(Proposal.grant_cycle_id == cycle.id).all()
        total = len(proposals)
        approved = sum(1 for p in proposals if p.status == "approved")
        rejected = sum(1 for p in proposals if p.status == "rejected")
        under_review = sum(1 for p in proposals if p.status == "under_review")
        submitted = sum(1 for p in proposals if p.status == "submitted")

        reports.append({
            "cycle_id": cycle.id,
            "cycle_title": cycle.title,
            "is_active": cycle.is_active,
            "total_proposals": total,
            "submitted": submitted,
            "under_review": under_review,
            "approved": approved,
            "rejected": rejected,
            "submission_open": cycle.submission_open,
            "submission_close": cycle.submission_close,
        })

    return reports


# GET /admin/reports/{cycle_id}
# Detailed report for one cycle — list of proposals with status

@router.get("/{cycle_id}")
def get_cycle_report(
    cycle_id: int,
    admin: User = Depends(get_admin),
    db: Session = Depends(get_db),
):
    cycle = db.query(GrantCycle).filter(GrantCycle.id == cycle_id).first()
    if not cycle:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Grant cycle not found")

    proposals = db.query(Proposal).filter(Proposal.grant_cycle_id == cycle_id).all()

    proposal_data = []
    for p in proposals:
        assignments = db.query(Assignment).filter(Assignment.proposal_id == p.id).all()
        proposal_data.append({
            "id": p.id,
            "title": p.title,
            "pi_name": p.pi_name,
            "pi_department": p.pi_department,
            "status": p.status,
            "stage": p.stage,
            "submitted_at": p.submitted_at,
            "reviewers_assigned": len(assignments),
        })

    return {
        "cycle": {
            "id": cycle.id,
            "title": cycle.title,
            "is_active": cycle.is_active,
            "budget": cycle.budget,
            "submission_open": cycle.submission_open,
            "submission_close": cycle.submission_close,
        },
        "summary": {
            "total": len(proposals),
            "submitted": sum(1 for p in proposals if p.status == "submitted"),
            "under_review": sum(1 for p in proposals if p.status == "under_review"),
            "approved": sum(1 for p in proposals if p.status == "approved"),
            "rejected": sum(1 for p in proposals if p.status == "rejected"),
        },
        "proposals": proposal_data,
    }