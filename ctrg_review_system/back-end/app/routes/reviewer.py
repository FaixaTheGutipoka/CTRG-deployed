# back-end/app/routes/reviewer.py
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.models import (
    User, Reviewer, Assignment, Proposal, GrantCycle, Review, Notification
)
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/reviewer", tags=["Reviewer"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_reviewer(user_id: int, db: Session):
    """Return (User, Reviewer) or raise 403."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    reviewer = db.query(Reviewer).filter(Reviewer.user_id == user.id).first()
    if not reviewer:
        raise HTTPException(
            status_code=403,
            detail=f"No reviewer profile found for user id={user_id} email={user.email}. "
                   "Please log out and log back in, or contact the administrator."
        )
    return user, reviewer


def _deadline_for(assignment: Assignment, db: Session) -> Optional[datetime]:
    cycle = None
    if assignment.grant_cycle_id:
        cycle = db.query(GrantCycle).filter(GrantCycle.id == assignment.grant_cycle_id).first()
    if not cycle:
        p = db.query(Proposal).filter(Proposal.id == assignment.proposal_id).first()
        if p and p.grant_cycle_id:
            cycle = db.query(GrantCycle).filter(GrantCycle.id == p.grant_cycle_id).first()
    if not cycle:
        return None
    dl = cycle.stage1_end if assignment.stage == "Stage 1" else cycle.stage2_end
    if dl and dl.tzinfo is None:
        dl = dl.replace(tzinfo=timezone.utc)
    return dl


def _is_past_deadline(deadline: Optional[datetime]) -> bool:
    if deadline is None:
        return False
    return datetime.now(timezone.utc) > deadline


def _auto_finalise_draft(review: Optional[Review], db: Session) -> None:
    """Issue #5: If deadline passed and review is draft, freeze it as submitted."""
    if review and review.status == "draft":
        review.status = "submitted"
        if not review.submitted_at:
            review.submitted_at = datetime.now(timezone.utc)
        db.commit()


# ── GET /reviewer/me ──────────────────────────────────────────────────────────
@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = int(current_user["sub"])
    user, reviewer = _get_reviewer(user_id, db)
    assignments = db.query(Assignment).filter(Assignment.reviewer_id == reviewer.id).all()
    assignment_ids = [a.id for a in assignments]
    reviews = (
        db.query(Review).filter(Review.assignment_id.in_(assignment_ids)).all()
        if assignment_ids else []
    )
    submitted_count = sum(1 for r in reviews if r.status == "submitted")
    stage1_count = sum(1 for a in assignments if a.stage == "Stage 1")
    stage2_count = sum(1 for a in assignments if a.stage == "Stage 2")
    pending_count = max(len(assignments) - submitted_count, 0)
    active_cycle = db.query(GrantCycle).filter(GrantCycle.is_active == True).first()  # noqa
    return {
        "id": reviewer.id,
        "full_name": user.full_name,
        "email": user.email,
        "department": reviewer.department,
        "expertise": reviewer.expertise,
        "total_assigned": len(assignments),
        "pending_reviews": pending_count,
        "submitted_reviews": submitted_count,
        "stage1_count": stage1_count,
        "stage2_count": stage2_count,
        "active_cycle": active_cycle.title if active_cycle else None,
    }


# ── GET /reviewer/assignments ─────────────────────────────────────────────────
# Issue #8: Only active-cycle assignments in main view
@router.get("/assignments")
def get_assignments(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
    history: bool = False,
):
    user_id = int(current_user["sub"])
    user, reviewer = _get_reviewer(user_id, db)
    active_cycle = db.query(GrantCycle).filter(GrantCycle.is_active == True).first()  # noqa

    query = (
        db.query(Assignment)
        .options(joinedload(Assignment.proposal))
        .filter(Assignment.reviewer_id == reviewer.id)
    )
    if history:
        # Past assignments: exclude active cycle
        if active_cycle:
            query = query.filter(Assignment.grant_cycle_id != active_cycle.id)
    else:
        # Current view: only active cycle
        if active_cycle:
            query = query.filter(Assignment.grant_cycle_id == active_cycle.id)
        else:
            return []

    assignments = query.order_by(Assignment.assigned_at.desc()).all()
    result = []
    for a in assignments:
        p = a.proposal
        if not p:
            continue
        review = db.query(Review).filter(Review.assignment_id == a.id).first()
        deadline = _deadline_for(a, db)
        past_deadline = _is_past_deadline(deadline)
        # Issue #5: auto-finalise draft past deadline
        if past_deadline and review and review.status == "draft":
            _auto_finalise_draft(review, db)
        review_status = review.status if review else "not_started"
        result.append({
            "assignment_id": a.id,
            "proposal_id": p.id,
            "title": p.title,
            "pi_name": p.pi_name,
            "pi_department": p.pi_department,
            "grant_cycle": p.grant_cycle,
            "stage": a.stage,
            "proposal_status": p.status,
            "review_status": review_status,
            "review_id": review.id if review else None,
            "assigned_at": a.assigned_at,
            "deadline": deadline,
            "past_deadline": past_deadline,
        })
    return result


# ── GET /reviewer/assignments/{proposal_id} ───────────────────────────────────
@router.get("/assignments/{proposal_id}")
def get_assignment_detail(
    proposal_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["sub"])
    user, reviewer = _get_reviewer(user_id, db)
    assignment = (
        db.query(Assignment)
        .options(joinedload(Assignment.proposal))
        .filter(
            Assignment.reviewer_id == reviewer.id,
            Assignment.proposal_id == proposal_id,
        )
        .order_by(Assignment.assigned_at.desc())
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    p = assignment.proposal
    review = db.query(Review).filter(Review.assignment_id == assignment.id).first()

    deadline = _deadline_for(assignment, db)
    past_deadline = _is_past_deadline(deadline)
    if past_deadline and review and review.status == "draft":
        _auto_finalise_draft(review, db)

    # Issue #4: Stage 2 reviewers can see all Stage 1 reviews for this proposal
    stage1_reviews = []
    if assignment.stage == "Stage 2":
        stage1_assignments = db.query(Assignment).filter(
            Assignment.proposal_id == proposal_id,
            Assignment.stage == "Stage 1",
        ).all()
        for a1 in stage1_assignments:
            r1 = db.query(Review).filter(Review.assignment_id == a1.id).first()
            if r1:
                reviewer1 = db.query(Reviewer).options(joinedload(Reviewer.user)).filter(
                    Reviewer.id == a1.reviewer_id
                ).first()
                stage1_reviews.append({
                    "reviewer_name": reviewer1.user.full_name if reviewer1 and reviewer1.user else "Unknown",
                    "status": r1.status,
                    "total_score": r1.total_score,
                    "score_originality": r1.score_originality,
                    "score_clarity": r1.score_clarity,
                    "score_literature": r1.score_literature,
                    "score_methodology": r1.score_methodology,
                    "score_impact": r1.score_impact,
                    "score_publication": r1.score_publication,
                    "score_budget": r1.score_budget,
                    "score_timeline": r1.score_timeline,
                    "comments": r1.comments,
                    "submitted_at": r1.submitted_at,
                })

    return {
        "assignment_id": assignment.id,
        "stage": assignment.stage,
        "deadline": deadline,
        "past_deadline": past_deadline,
        "proposal": {
            "id": p.id,
            "title": p.title,
            "pi_name": p.pi_name,
            "pi_department": p.pi_department,
            "grant_cycle": p.grant_cycle,
            "status": p.status,
            "proposal_file_path": p.proposal_file_path,
            "supplementary_file_path": p.supplementary_file_path,
            "revised_file_path": p.revised_file_path,
            "research_area": p.research_area,
            "keywords": p.keywords,
            "co_investigators": p.co_investigators,
            "budget_summary": p.budget_summary,
            "timeline": p.timeline,
        },
        "review": {
            "id": review.id,
            "status": review.status,
            "score_originality": review.score_originality or 0,
            "score_clarity": review.score_clarity or 0,
            "score_literature": review.score_literature or 0,
            "score_methodology": review.score_methodology or 0,
            "score_impact": review.score_impact or 0,
            "score_publication": review.score_publication or 0,
            "score_budget": review.score_budget or 0,
            "score_timeline": review.score_timeline or 0,
            "total_score": review.total_score or 0,
            "comments": review.comments or "",
            "concerns_addressed": review.concerns_addressed,
            "recommendation": review.recommendation,
            "revised_score": review.revised_score,
            "submitted_at": review.submitted_at,
        } if review else None,
        "stage1_reviews": stage1_reviews,  # Issue #4
    }


# ── POST /reviewer/reviews/stage1 ─────────────────────────────────────────────
class Stage1Body(BaseModel):
    assignment_id: int
    score_originality: float = 0
    score_clarity: float = 0
    score_literature: float = 0
    score_methodology: float = 0
    score_impact: float = 0
    score_publication: float = 0
    score_budget: float = 0
    score_timeline: float = 0
    comments: Optional[str] = ""
    status: str = "draft"


@router.post("/reviews/stage1")
def save_stage1_review(
    body: Stage1Body,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["sub"])
    user, reviewer = _get_reviewer(user_id, db)

    assignment = db.query(Assignment).filter(
        Assignment.id == body.assignment_id,
        Assignment.reviewer_id == reviewer.id,
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.stage != "Stage 1":
        raise HTTPException(status_code=400, detail="This assignment is not Stage 1")

    # Issue #5: Block edits past deadline (draft frozen too, cannot submit)
    deadline = _deadline_for(assignment, db)
    if _is_past_deadline(deadline):
        raise HTTPException(
            status_code=400,
            detail="The Stage 1 review deadline has passed. Editing is no longer allowed."
        )

    existing = db.query(Review).filter(Review.assignment_id == body.assignment_id).first()
    if existing and existing.status == "submitted":
        raise HTTPException(status_code=400, detail="Review already submitted and locked.")

    total = round(
        body.score_originality + body.score_clarity + body.score_literature +
        body.score_methodology + body.score_impact + body.score_publication +
        body.score_budget + body.score_timeline, 2
    )

    if existing:
        existing.score_originality = body.score_originality
        existing.score_clarity = body.score_clarity
        existing.score_literature = body.score_literature
        existing.score_methodology = body.score_methodology
        existing.score_impact = body.score_impact
        existing.score_publication = body.score_publication
        existing.score_budget = body.score_budget
        existing.score_timeline = body.score_timeline
        existing.total_score = total
        existing.comments = body.comments
        existing.status = body.status
        if body.status == "submitted":
            existing.submitted_at = datetime.now(timezone.utc)
        db.commit()
        review = existing
    else:
        review = Review(
            assignment_id=body.assignment_id,
            reviewer_id=reviewer.id,
            proposal_id=assignment.proposal_id,
            stage="Stage 1",
            score_originality=body.score_originality,
            score_clarity=body.score_clarity,
            score_literature=body.score_literature,
            score_methodology=body.score_methodology,
            score_impact=body.score_impact,
            score_publication=body.score_publication,
            score_budget=body.score_budget,
            score_timeline=body.score_timeline,
            total_score=total,
            comments=body.comments,
            status=body.status,
            submitted_at=datetime.now(timezone.utc) if body.status == "submitted" else None,
        )
        db.add(review)
        db.commit()
        db.refresh(review)

    if body.status == "submitted":
        proposal = db.query(Proposal).filter(Proposal.id == assignment.proposal_id).first()
        admin = db.query(User).filter(User.role == "admin").first()
        if admin and proposal:
            db.add(Notification(
                user_id=admin.id,
                proposal_id=proposal.id,
                message=(
                    f"Stage 1 review submitted by {user.full_name} "
                    f"for \"{proposal.title}\" (Score: {total}/100)"
                ),
            ))
            db.commit()

    return {
        "message": "Draft saved." if body.status == "draft" else "Review submitted successfully.",
        "review_id": review.id,
        "total_score": total,
        "status": review.status,
    }


# ── POST /reviewer/reviews/stage2 ─────────────────────────────────────────────
class Stage2Body(BaseModel):
    assignment_id: int
    concerns_addressed: str
    recommendation: str
    revised_score: Optional[float] = None
    comments: str
    status: str = "draft"


@router.post("/reviews/stage2")
def save_stage2_review(
    body: Stage2Body,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["sub"])
    user, reviewer = _get_reviewer(user_id, db)

    assignment = db.query(Assignment).filter(
        Assignment.id == body.assignment_id,
        Assignment.reviewer_id == reviewer.id,
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.stage != "Stage 2":
        raise HTTPException(status_code=400, detail="This assignment is not Stage 2")

    deadline = _deadline_for(assignment, db)
    if _is_past_deadline(deadline):
        raise HTTPException(
            status_code=400,
            detail="The Stage 2 review deadline has passed. Editing is no longer allowed."
        )

    if body.status == "submitted" and not body.comments.strip():
        raise HTTPException(status_code=400, detail="Comments are required before submitting.")

    existing = db.query(Review).filter(Review.assignment_id == body.assignment_id).first()
    if existing and existing.status == "submitted":
        raise HTTPException(status_code=400, detail="Review already submitted and locked.")

    if existing:
        existing.concerns_addressed = body.concerns_addressed
        existing.recommendation = body.recommendation
        existing.revised_score = body.revised_score
        existing.comments = body.comments
        existing.status = body.status
        if body.status == "submitted":
            existing.submitted_at = datetime.now(timezone.utc)
        db.commit()
        review = existing
    else:
        review = Review(
            assignment_id=body.assignment_id,
            reviewer_id=reviewer.id,
            proposal_id=assignment.proposal_id,
            stage="Stage 2",
            concerns_addressed=body.concerns_addressed,
            recommendation=body.recommendation,
            revised_score=body.revised_score,
            comments=body.comments,
            status=body.status,
            submitted_at=datetime.now(timezone.utc) if body.status == "submitted" else None,
        )
        db.add(review)
        db.commit()
        db.refresh(review)

    if body.status == "submitted":
        proposal = db.query(Proposal).filter(Proposal.id == assignment.proposal_id).first()
        admin = db.query(User).filter(User.role == "admin").first()
        if admin and proposal:
            db.add(Notification(
                user_id=admin.id,
                proposal_id=proposal.id,
                message=(
                    f"Stage 2 review submitted by {user.full_name} "
                    f"for \"{proposal.title}\" — Recommendation: {body.recommendation}"
                ),
            ))
            db.commit()

    return {
        "message": "Draft saved." if body.status == "draft" else "Stage 2 review submitted.",
        "review_id": review.id,
        "status": review.status,
    }


# ── POST /reviewer/reviews/revision ───────────────────────────────────────────
# Issue #6: Reviewers submit a revision review when admin requests revision
class RevisionBody(BaseModel):
    assignment_id: int
    comments: str
    recommendation: Optional[str] = None
    status: str = "draft"


@router.post("/reviews/revision")
def save_revision_review(
    body: RevisionBody,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = int(current_user["sub"])
    user, reviewer = _get_reviewer(user_id, db)

    assignment = db.query(Assignment).filter(
        Assignment.id == body.assignment_id,
        Assignment.reviewer_id == reviewer.id,
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    proposal = db.query(Proposal).filter(Proposal.id == assignment.proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status != "revision_submitted":
        raise HTTPException(
            status_code=400,
            detail="PI has not yet submitted the revision."
        )

    if body.status == "submitted" and not body.comments.strip():
        raise HTTPException(status_code=400, detail="Comments are required before submitting.")

    # Find latest review for this assignment (create new revision record)
    existing = db.query(Review).filter(Review.assignment_id == body.assignment_id).first()
    if existing and existing.status == "submitted":
        raise HTTPException(status_code=400, detail="Revision review already submitted and locked.")

    if existing:
        existing.comments = body.comments
        existing.recommendation = body.recommendation or existing.recommendation
        existing.status = body.status
        if body.status == "submitted":
            existing.submitted_at = datetime.now(timezone.utc)
        db.commit()
        review = existing
    else:
        review = Review(
            assignment_id=body.assignment_id,
            reviewer_id=reviewer.id,
            proposal_id=assignment.proposal_id,
            stage=assignment.stage,
            comments=body.comments,
            recommendation=body.recommendation,
            status=body.status,
            submitted_at=datetime.now(timezone.utc) if body.status == "submitted" else None,
        )
        db.add(review)
        db.commit()
        db.refresh(review)

    if body.status == "submitted":
        admin = db.query(User).filter(User.role == "admin").first()
        if admin and proposal:
            db.add(Notification(
                user_id=admin.id,
                proposal_id=proposal.id,
                message=f"Revision review submitted by {user.full_name} for \"{proposal.title}\"",
            ))
            db.commit()

    return {
        "message": "Revision review saved." if body.status == "draft" else "Revision review submitted.",
        "review_id": review.id,
        "status": review.status,
    }