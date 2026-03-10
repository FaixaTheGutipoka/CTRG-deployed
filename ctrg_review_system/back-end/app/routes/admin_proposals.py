# back-end/app/routes/admin_proposals.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional, List
import os
from datetime import datetime, timezone
from app.database import get_db
from app.models.models import Proposal, User, Notification, GrantCycle, Assignment, Reviewer, Review
from app.schemas.schemas import ProposalOut
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/admin/proposals", tags=["Admin - Proposals"])


def get_admin_user(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == int(current_user["sub"])).first()
    if not user or user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def notify(db: Session, user_id: int, proposal_id: int, message: str):
    db.add(Notification(user_id=user_id, proposal_id=proposal_id, message=message))


def notify_assigned_reviewers(db: Session, proposal: Proposal, message: str):
    assignments = db.query(Assignment).filter(Assignment.proposal_id == proposal.id).all()
    for a in assignments:
        reviewer = db.query(Reviewer).filter(Reviewer.id == a.reviewer_id).first()
        if reviewer:
            notify(db, reviewer.user_id, proposal.id, message)


def get_active_cycle(db: Session) -> Optional[GrantCycle]:
    return db.query(GrantCycle).filter(GrantCycle.is_active == True).first()  # noqa


def now_utc():
    return datetime.now(timezone.utc)


def _make_tz(dt: Optional[datetime]) -> Optional[datetime]:
    if dt and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ── GET /admin/proposals ──────────────────────────────────────────────────────
# Issue #8: active_cycle_only filters to current cycle; history endpoint for past
@router.get("")
def get_all_proposals(
    status: Optional[str] = None,
    active_cycle_only: Optional[bool] = True,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(Proposal)
    if active_cycle_only:
        cycle = get_active_cycle(db)
        if cycle:
            query = query.filter(Proposal.grant_cycle_id == cycle.id)
        else:
            return []  # no active cycle → nothing to show
    if status:
        statuses = [s.strip() for s in status.split(",")]
        query = query.filter(Proposal.status.in_(statuses))
    proposals = query.order_by(Proposal.created_at.desc()).all()

    result = []
    for p in proposals:
        assignments = db.query(Assignment).filter(Assignment.proposal_id == p.id).all()
        a_ids = [a.id for a in assignments]
        reviews_submitted = db.query(Review).filter(
            Review.assignment_id.in_(a_ids), Review.status == "submitted"
        ).count() if a_ids else 0

        # Collect review scores summary for display
        review_scores = []
        for a in assignments:
            r = db.query(Review).filter(Review.assignment_id == a.id).first()
            if r and r.status == "submitted":
                review_scores.append({
                    "reviewer_id": a.reviewer_id,
                    "stage": a.stage,
                    "total_score": r.total_score,
                    "recommendation": r.recommendation,
                })

        result.append({
            "id": p.id, "title": p.title, "status": p.status, "stage": p.stage,
            "pi_name": p.pi_name, "pi_department": p.pi_department,
            "grant_cycle": p.grant_cycle, "submitted_at": p.submitted_at,
            "created_at": p.created_at, "revision_count": p.revision_count or 0,
            "reviewer_count": len(assignments), "reviews_submitted": reviews_submitted,
            "research_area": p.research_area, "keywords": p.keywords,
            "review_scores": review_scores,
        })
    return result


# ── GET /admin/proposals/past ─────────────────────────────────────────────────
# Issue #8: past submissions (all non-active-cycle proposals)
@router.get("/past")
def get_past_proposals(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    cycle = get_active_cycle(db)
    query = db.query(Proposal)
    if cycle:
        query = query.filter(Proposal.grant_cycle_id != cycle.id)
    proposals = query.order_by(Proposal.submitted_at.desc()).all()
    return [
        {
            "id": p.id, "title": p.title, "status": p.status, "stage": p.stage,
            "pi_name": p.pi_name, "pi_department": p.pi_department,
            "grant_cycle": p.grant_cycle, "submitted_at": p.submitted_at,
            "created_at": p.created_at,
        }
        for p in proposals
    ]


# ── GET /admin/proposals/stats ────────────────────────────────────────────────
@router.get("/stats")
def get_all_stats(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    cycle = get_active_cycle(db)
    proposals = (
        db.query(Proposal).filter(Proposal.grant_cycle_id == cycle.id).all()
        if cycle else db.query(Proposal).all()
    )
    total_reviews = 0
    if cycle:
        all_assignments = db.query(Assignment).join(Proposal).filter(
            Proposal.grant_cycle_id == cycle.id
        ).all()
        a_ids = [a.id for a in all_assignments]
        total_reviews = db.query(Review).filter(
            Review.assignment_id.in_(a_ids), Review.status == "submitted"
        ).count() if a_ids else 0

    return {
        "total": len(proposals),
        "draft": sum(1 for p in proposals if p.status == "draft"),
        "submitted": sum(1 for p in proposals if p.status == "submitted"),
        "under_review": sum(1 for p in proposals if p.status == "under_review"),
        "revision_requested": sum(1 for p in proposals if p.status == "revision_requested"),
        "revision_submitted": sum(1 for p in proposals if p.status == "revision_submitted"),
        "approved": sum(1 for p in proposals if p.status == "approved"),
        "rejected": sum(1 for p in proposals if p.status == "rejected"),
        "total_reviews_submitted": total_reviews,
        "active_cycle": cycle.title if cycle else None,
    }


# ── GET /admin/proposals/{id} ─────────────────────────────────────────────────
@router.get("/{proposal_id}")
def get_proposal(proposal_id: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")

    assignments = (
        db.query(Assignment)
        .options(joinedload(Assignment.reviewer).joinedload(Reviewer.user))
        .filter(Assignment.proposal_id == p.id).all()
    )

    reviewers_data = []
    stage1_reviews_summary = []
    stage2_reviews_summary = []

    for a in assignments:
        review = db.query(Review).filter(Review.assignment_id == a.id).first()
        entry = {
            "assignment_id": a.id,
            "reviewer_id": a.reviewer_id,
            "full_name": a.reviewer.user.full_name if a.reviewer and a.reviewer.user else "—",
            "email": a.reviewer.user.email if a.reviewer and a.reviewer.user else "—",
            "stage": a.stage,
            "review_status": review.status if review else "not_started",
            "total_score": review.total_score if review else None,
            "recommendation": review.recommendation if review else None,
            "comments": review.comments if review else None,
            "submitted_at": review.submitted_at if review else None,
            # Stage 1 scores
            "score_originality": review.score_originality if review else None,
            "score_clarity": review.score_clarity if review else None,
            "score_literature": review.score_literature if review else None,
            "score_methodology": review.score_methodology if review else None,
            "score_impact": review.score_impact if review else None,
            "score_publication": review.score_publication if review else None,
            "score_budget": review.score_budget if review else None,
            "score_timeline": review.score_timeline if review else None,
            # Stage 2 specific
            "concerns_addressed": review.concerns_addressed if review else None,
            "revised_score": review.revised_score if review else None,
        }
        reviewers_data.append(entry)
        if a.stage == "Stage 1":
            stage1_reviews_summary.append(entry)
        elif a.stage == "Stage 2":
            stage2_reviews_summary.append(entry)

    return {
        "id": p.id, "title": p.title, "status": p.status, "stage": p.stage,
        "pi_name": p.pi_name, "pi_department": p.pi_department, "pi_email": p.pi_email,
        "grant_cycle": p.grant_cycle, "research_area": p.research_area,
        "keywords": p.keywords, "co_investigators": p.co_investigators,
        "budget_summary": p.budget_summary, "timeline": p.timeline,
        "ethics_confirmed": p.ethics_confirmed,
        "proposal_file_path": p.proposal_file_path,
        "supplementary_file_path": p.supplementary_file_path,
        "revised_file_path": p.revised_file_path,
        "submitted_at": p.submitted_at, "created_at": p.created_at,
        "revision_count": p.revision_count or 0,
        "reviewers": reviewers_data,
        "stage1_reviews": stage1_reviews_summary,
        "stage2_reviews": stage2_reviews_summary,
    }


# ── POST /admin/proposals/push-stage1 ────────────────────────────────────────
# Issue #10: Cannot push before submission deadline
@router.post("/push-stage1")
def push_all_to_stage1(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    cycle = get_active_cycle(db)
    if not cycle:
        raise HTTPException(status_code=400, detail="No active grant cycle.")
    now = now_utc()
    close = _make_tz(cycle.submission_close)
    if close and now < close:
        raise HTTPException(
            status_code=400,
            detail=f"Submission deadline has not passed yet ({close.strftime('%d %b %Y %H:%M')} UTC)."
        )
    proposals = db.query(Proposal).filter(
        Proposal.grant_cycle_id == cycle.id,
        Proposal.status == "submitted",
    ).all()
    if not proposals:
        raise HTTPException(status_code=404, detail="No submitted proposals found for the active cycle.")
    pushed = 0
    for p in proposals:
        p.status = "under_review"
        p.stage = "Stage 1"
        notify(db, p.pi_id, p.id, f"Your proposal \"{p.title}\" has been moved to Stage 1 review.")
        notify_assigned_reviewers(db, p, f"Proposal \"{p.title}\" is now open for Stage 1 review.")
        pushed += 1
    db.commit()
    return {"message": f"{pushed} proposal(s) pushed to Stage 1 review.", "pushed": pushed}


# ── POST /admin/proposals/push-stage2 ────────────────────────────────────────
# Issue #7 & #10: Cannot push before Stage 1 deadline
@router.post("/push-stage2")
def push_all_to_stage2(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    cycle = get_active_cycle(db)
    if not cycle:
        raise HTTPException(status_code=400, detail="No active grant cycle.")
    now = now_utc()
    s1_end = _make_tz(cycle.stage1_end)
    if s1_end and now < s1_end:
        raise HTTPException(
            status_code=400,
            detail=f"Stage 1 deadline has not passed yet ({s1_end.strftime('%d %b %Y %H:%M')} UTC)."
        )
    proposals = db.query(Proposal).filter(
        Proposal.grant_cycle_id == cycle.id,
        Proposal.status.in_(["under_review", "revision_submitted"]),
        Proposal.stage == "Stage 1",
    ).all()
    if not proposals:
        raise HTTPException(status_code=404, detail="No Stage 1 proposals ready to push.")
    pushed = 0
    for p in proposals:
        p.stage = "Stage 2"
        p.status = "under_review"
        notify(db, p.pi_id, p.id, f"Your proposal \"{p.title}\" has advanced to Stage 2 review.")
        notify_assigned_reviewers(db, p, f"Proposal \"{p.title}\" is now open for Stage 2 review.")
        pushed += 1
    db.commit()
    return {"message": f"{pushed} proposal(s) pushed to Stage 2 review.", "pushed": pushed}


# ── POST /admin/proposals/{id}/push-stage1 ───────────────────────────────────
@router.post("/{proposal_id}/push-stage1")
def push_single_stage1(proposal_id: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    cycle = get_active_cycle(db)
    if not cycle:
        raise HTTPException(status_code=400, detail="No active grant cycle.")
    now = now_utc()
    close = _make_tz(cycle.submission_close)
    if close and now < close:
        raise HTTPException(status_code=400, detail="Submission deadline has not passed yet.")
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    p.status = "under_review"
    p.stage = "Stage 1"
    notify(db, p.pi_id, p.id, f"Your proposal \"{p.title}\" has been moved to Stage 1 review.")
    notify_assigned_reviewers(db, p, f"Proposal \"{p.title}\" is now open for Stage 1 review.")
    db.commit()
    return {"message": "Proposal pushed to Stage 1."}


# ── POST /admin/proposals/{id}/push-stage2 ───────────────────────────────────
@router.post("/{proposal_id}/push-stage2")
def push_single_stage2(proposal_id: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    cycle = get_active_cycle(db)
    if not cycle:
        raise HTTPException(status_code=400, detail="No active grant cycle.")
    now = now_utc()
    s1_end = _make_tz(cycle.stage1_end)
    if s1_end and now < s1_end:
        raise HTTPException(status_code=400, detail="Stage 1 deadline has not passed yet.")
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    p.stage = "Stage 2"
    p.status = "under_review"
    notify(db, p.pi_id, p.id, f"Your proposal \"{p.title}\" has advanced to Stage 2 review.")
    notify_assigned_reviewers(db, p, f"Proposal \"{p.title}\" is now open for Stage 2 review.")
    db.commit()
    return {"message": "Proposal pushed to Stage 2."}


# ── POST /admin/proposals/{id}/approve ───────────────────────────────────────
@router.post("/{proposal_id}/approve")
def approve_proposal(proposal_id: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    p.status = "approved"
    notify(db, p.pi_id, p.id, f"🎉 Congratulations! Your proposal \"{p.title}\" has been approved for funding.")
    notify_assigned_reviewers(db, p, f"Proposal \"{p.title}\" has been approved.")
    db.commit()
    return {"message": "Proposal approved."}


# ── POST /admin/proposals/{id}/reject ────────────────────────────────────────
@router.post("/{proposal_id}/reject")
def reject_proposal(proposal_id: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    p.status = "rejected"
    notify(db, p.pi_id, p.id, f"Your proposal \"{p.title}\" was not selected for funding at this stage.")
    notify_assigned_reviewers(db, p, f"Proposal \"{p.title}\" has been rejected.")
    db.commit()
    return {"message": "Proposal rejected."}


# ── POST /admin/proposals/approve-all ────────────────────────────────────────
@router.post("/approve-all")
def approve_all(admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    cycle = get_active_cycle(db)
    proposals = db.query(Proposal).filter(
        Proposal.grant_cycle_id == cycle.id if cycle else True,
        Proposal.stage == "Stage 2",
        Proposal.status == "under_review",
    ).all()
    count = 0
    for p in proposals:
        p.status = "approved"
        notify(db, p.pi_id, p.id, f"🎉 Congratulations! Your proposal \"{p.title}\" has been approved for funding.")
        notify_assigned_reviewers(db, p, f"Proposal \"{p.title}\" has been approved.")
        count += 1
    db.commit()
    return {"message": f"{count} proposal(s) approved.", "approved": count}


# ── POST /admin/proposals/{id}/request-revision ──────────────────────────────
# Issue #6: Max 3 revisions; notifies PI AND assigned reviewers who must re-review
@router.post("/{proposal_id}/request-revision")
def request_revision(proposal_id: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    revision_count = p.revision_count or 0
    if revision_count >= 3:
        raise HTTPException(
            status_code=400,
            detail="Maximum 3 revision requests already reached for this proposal."
        )
    p.status = "revision_requested"
    p.revision_count = revision_count + 1

    # Notify PI
    notify(
        db, p.pi_id, p.id,
        f"Revision requested for your proposal \"{p.title}\" "
        f"(Request {p.revision_count}/3). Please submit your revision."
    )
    # Issue #6: Notify assigned reviewers — they will need to re-review
    assignments = db.query(Assignment).filter(Assignment.proposal_id == p.id).all()
    for a in assignments:
        reviewer = db.query(Reviewer).filter(Reviewer.id == a.reviewer_id).first()
        if reviewer:
            db.add(Notification(
                user_id=reviewer.user_id,
                proposal_id=p.id,
                message=(
                    f"Revision #{p.revision_count}/3 requested for \"{p.title}\". "
                    f"You will need to review the revised submission."
                ),
            ))
    db.commit()
    return {
        "message": f"Revision request #{p.revision_count} sent.",
        "revision_count": p.revision_count,
    }


# ── PATCH /admin/proposals/{id}/status ───────────────────────────────────────
class StatusUpdate(BaseModel):
    status: str
    stage: Optional[str] = None
    message: Optional[str] = None


@router.patch("/{proposal_id}/status")
def update_status(
    proposal_id: int,
    body: StatusUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    valid = {"under_review", "revision_requested", "approved", "rejected", "submitted"}
    if body.status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status.")
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    p.status = body.status
    if body.stage:
        p.stage = body.stage
    msgs = {
        "under_review": f"Your proposal \"{p.title}\" is now under review.",
        "revision_requested": f"Revision requested for \"{p.title}\".",
        "approved": f"🎉 Your proposal \"{p.title}\" has been approved!",
        "rejected": f"Your proposal \"{p.title}\" was not selected.",
        "submitted": f"Your proposal \"{p.title}\" status updated.",
    }
    notify(db, p.pi_id, p.id, body.message or msgs[body.status])
    db.commit()
    return {"message": "Status updated.", "status": p.status}


# ── PATCH /admin/proposals/{id}/stage ────────────────────────────────────────
class StageUpdate(BaseModel):
    stage: str


@router.patch("/{proposal_id}/stage")
def update_stage(
    proposal_id: int,
    body: StageUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    p.stage = body.stage
    db.commit()
    return {"message": "Stage updated.", "stage": p.stage}


# ── GET /admin/proposals/{id}/file ────────────────────────────────────────────
@router.get("/{proposal_id}/file")
def download_file(proposal_id: int, admin: User = Depends(get_admin_user), db: Session = Depends(get_db)):
    p = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if not p.proposal_file_path or not os.path.exists(p.proposal_file_path):
        raise HTTPException(status_code=404, detail="No file uploaded")
    return FileResponse(path=p.proposal_file_path, media_type="application/pdf",
                        filename=f"CTRG-{proposal_id}-proposal.pdf")