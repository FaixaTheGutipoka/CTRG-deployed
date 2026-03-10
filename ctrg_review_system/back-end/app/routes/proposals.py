# back-end/app/routes/proposals.py
import io
import os
import re
import uuid
import shutil
import zipfile
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Proposal, ProposalFile, User, GrantCycle, Reviewer
from app.schemas.schemas import ProposalCreate, ProposalOut, ProposalStatsOut
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/proposals", tags=["Proposals"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

NSU_EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+\-]+@northsouth\.edu$", re.IGNORECASE)


def safe_filename(proposal_id: int, pi_id: int, prefix: str,
                  original_name: str, cycle_title: Optional[str] = None) -> str:
    ext = os.path.splitext(original_name)[-1].lower() or ".bin"
    unique_id = uuid.uuid4().hex[:8]
    cycle_slug = re.sub(r"[^a-zA-Z0-9]+", "_", cycle_title).strip("_") if cycle_title else "nocycle"
    return f"{cycle_slug}_{prefix}_{proposal_id}_{pi_id}_{unique_id}{ext}"


def delete_old_file(path: Optional[str]) -> None:
    if path and os.path.exists(path):
        os.remove(path)


# Issue #1: Every DB user is a PI — no role="pi" check needed
def get_pi_user(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Any authenticated DB user can submit proposals (everyone is a PI)."""
    if current_user.get("role") == "it":
        raise HTTPException(status_code=403, detail="IT accounts cannot submit proposals")
    user = db.query(User).filter(User.id == int(current_user["sub"])).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")
    return user


def get_active_cycle(db: Session) -> Optional[GrantCycle]:
    return db.query(GrantCycle).filter(GrantCycle.is_active == True).first()  # noqa


def validate_pi_email(email: str, pi_user: User, db: Session):
    if not NSU_EMAIL_PATTERN.match(email):
        raise HTTPException(
            status_code=400,
            detail="Only @northsouth.edu email addresses are allowed for PI submissions."
        )


# ── POST /proposals ───────────────────────────────────────────────────────────
@router.post("", response_model=ProposalOut)
def create_proposal(
    body: ProposalCreate,
    pi: User = Depends(get_pi_user),
    db: Session = Depends(get_db),
):
    cycle = get_active_cycle(db)

    if body.status == "submitted":
        email_to_check = body.pi_email or pi.email
        validate_pi_email(email_to_check, pi, db)
        if cycle:
            now = datetime.utcnow()
            if cycle.submission_close and now > cycle.submission_close.replace(tzinfo=None):
                raise HTTPException(
                    status_code=400,
                    detail=f"Submission closed on {cycle.submission_close.strftime('%d %b %Y')}."
                )
            if cycle.submission_open and now < cycle.submission_open.replace(tzinfo=None):
                raise HTTPException(
                    status_code=400,
                    detail=f"Submissions open on {cycle.submission_open.strftime('%d %b %Y')}."
                )

    # Issue #9: Auto-populate PI details from DB if not provided
    proposal = Proposal(
        pi_id=pi.id,
        title=body.title,
        research_area=body.research_area,
        keywords=body.keywords,
        grant_cycle=cycle.title if cycle else body.grant_cycle,
        grant_cycle_id=cycle.id if cycle else None,
        pi_name=body.pi_name or pi.full_name,
        pi_department=body.pi_department or pi.department,
        pi_email=body.pi_email or pi.email,
        co_investigators=body.co_investigators,
        budget_summary=body.budget_summary,
        timeline=body.timeline,
        ethics_confirmed=body.ethics_confirmed,
        status=body.status,
        submitted_at=datetime.now(timezone.utc) if body.status == "submitted" else None,
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


# ── POST /proposals/{id}/upload ───────────────────────────────────────────────
# Issue #14: Accept multiple supplementary files of any type
@router.post("/{proposal_id}/upload", response_model=ProposalOut)
def upload_proposal_files(
    proposal_id: int,
    proposal_file: Optional[UploadFile] = File(None),
    supplementary_files: List[UploadFile] = File(default=[]),
    # Keep legacy single-file param for backward compat
    supplementary_file: Optional[UploadFile] = File(None),
    pi: User = Depends(get_pi_user),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(
        Proposal.id == proposal_id,
        Proposal.pi_id == pi.id,
    ).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    cycle_title = proposal.grant_cycle

    # Upload main proposal file
    if proposal_file and proposal_file.filename:
        delete_old_file(proposal.proposal_file_path)
        filename = safe_filename(proposal_id, pi.id, "proposal", proposal_file.filename, cycle_title)
        path = os.path.join(UPLOAD_DIR, filename)
        with open(path, "wb") as f:
            shutil.copyfileobj(proposal_file.file, f)
        proposal.proposal_file_path = path

    # Upload multiple supplementary files (new multi-file approach)
    all_supp_files = list(supplementary_files or [])
    if supplementary_file and supplementary_file.filename:
        all_supp_files.append(supplementary_file)

    for supp in all_supp_files:
        if not supp or not supp.filename:
            continue
        filename = safe_filename(proposal_id, pi.id, "supp", supp.filename, cycle_title)
        path = os.path.join(UPLOAD_DIR, filename)
        # Read file content to get size
        content = supp.file.read()
        with open(path, "wb") as f:
            f.write(content)
        pf = ProposalFile(
            proposal_id=proposal_id,
            file_path=path,
            original_filename=supp.filename,
            file_size=len(content),
            mime_type=supp.content_type,
        )
        db.add(pf)
        # Also set the legacy field to the first supplementary file for backward compat
        if not proposal.supplementary_file_path:
            proposal.supplementary_file_path = path

    db.commit()
    db.refresh(proposal)
    return proposal


# ── GET /proposals/my ─────────────────────────────────────────────────────────
# Issue #8: Only return proposals in the active cycle (past cycle ones go to history)
@router.get("/my", response_model=list[ProposalOut])
def get_my_proposals(
    pi: User = Depends(get_pi_user),
    db: Session = Depends(get_db),
    history: bool = False,
):
    """
    history=False (default): only active cycle proposals
    history=True: all past proposals (for Previous Submissions page)
    """
    active_cycle = get_active_cycle(db)
    query = db.query(Proposal).filter(Proposal.pi_id == pi.id)

    if history:
        # Past submissions: exclude active cycle
        if active_cycle:
            query = query.filter(Proposal.grant_cycle_id != active_cycle.id)
    else:
        # Current view: active cycle only
        if active_cycle:
            query = query.filter(Proposal.grant_cycle_id == active_cycle.id)
        # If no active cycle, show nothing in main view
        else:
            return []

    return query.order_by(Proposal.created_at.desc()).all()


# ── GET /proposals/my/stats ───────────────────────────────────────────────────
@router.get("/my/stats", response_model=ProposalStatsOut)
def get_my_stats(pi: User = Depends(get_pi_user), db: Session = Depends(get_db)):
    active_cycle = get_active_cycle(db)
    query = db.query(Proposal).filter(Proposal.pi_id == pi.id)
    if active_cycle:
        query = query.filter(Proposal.grant_cycle_id == active_cycle.id)
    proposals = query.all()
    return ProposalStatsOut(
        total=len(proposals),
        draft=sum(1 for p in proposals if p.status == "draft"),
        submitted=sum(1 for p in proposals if p.status == "submitted"),
        under_review=sum(1 for p in proposals if p.status == "under_review"),
        revision_requested=sum(1 for p in proposals if p.status == "revision_requested"),
        revision_submitted=sum(1 for p in proposals if p.status == "revision_submitted"),
        approved=sum(1 for p in proposals if p.status == "approved"),
        rejected=sum(1 for p in proposals if p.status == "rejected"),
    )


# ── GET /proposals/{id} ───────────────────────────────────────────────────────
@router.get("/{proposal_id}", response_model=ProposalOut)
def get_proposal(
    proposal_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    role = current_user.get("role", "").lower()
    # Non-admin/reviewer users can only view their own proposals
    if role not in ("admin", "reviewer", "it"):
        if proposal.pi_id != int(current_user["sub"]):
            raise HTTPException(status_code=403, detail="Access denied")
    return proposal


# ── GET /proposals/{id}/files ─────────────────────────────────────────────────
# Issue #14: list all supplementary files for a proposal
@router.get("/{proposal_id}/files")
def list_proposal_files(
    proposal_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    role = current_user.get("role", "").lower()
    if role not in ("admin", "reviewer", "it"):
        if proposal.pi_id != int(current_user["sub"]):
            raise HTTPException(status_code=403, detail="Access denied")
    files = db.query(ProposalFile).filter(ProposalFile.proposal_id == proposal_id).all()
    return [
        {
            "id": f.id,
            "original_filename": f.original_filename,
            "file_size": f.file_size,
            "mime_type": f.mime_type,
            "uploaded_at": f.uploaded_at,
        }
        for f in files
    ]


# ── GET /proposals/{id}/files/download-zip ────────────────────────────────────
# Issue #14: download all files (proposal + supplementary) as a ZIP
@router.get("/{proposal_id}/files/download-zip")
def download_all_files_zip(
    proposal_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    role = current_user.get("role", "").lower()
    if role not in ("admin", "reviewer", "it"):
        if proposal.pi_id != int(current_user["sub"]):
            raise HTTPException(status_code=403, detail="Access denied")

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add main proposal file
        if proposal.proposal_file_path and os.path.exists(proposal.proposal_file_path):
            arcname = f"proposal_{os.path.basename(proposal.proposal_file_path)}"
            zf.write(proposal.proposal_file_path, arcname)

        # Add revised file if exists
        if proposal.revised_file_path and os.path.exists(proposal.revised_file_path):
            arcname = f"revised_{os.path.basename(proposal.revised_file_path)}"
            zf.write(proposal.revised_file_path, arcname)

        # Add all supplementary files from ProposalFile table
        supp_files = db.query(ProposalFile).filter(ProposalFile.proposal_id == proposal_id).all()
        for pf in supp_files:
            if os.path.exists(pf.file_path):
                zf.write(pf.file_path, f"supplementary/{pf.original_filename}")

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=CTRG-{proposal_id}-files.zip"},
    )


# ── GET /proposals/{id}/files/{file_id}/download ─────────────────────────────
@router.get("/{proposal_id}/files/{file_id}/download")
def download_single_supp_file(
    proposal_id: int,
    file_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    role = current_user.get("role", "").lower()
    if role not in ("admin", "reviewer", "it"):
        if proposal.pi_id != int(current_user["sub"]):
            raise HTTPException(status_code=403, detail="Access denied")
    pf = db.query(ProposalFile).filter(
        ProposalFile.id == file_id, ProposalFile.proposal_id == proposal_id
    ).first()
    if not pf or not os.path.exists(pf.file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=pf.file_path,
        media_type="application/octet-stream",
        filename=pf.original_filename,
    )


# ── PUT /proposals/{id} ───────────────────────────────────────────────────────
@router.put("/{proposal_id}", response_model=ProposalOut)
def update_proposal(
    proposal_id: int,
    body: ProposalCreate,
    pi: User = Depends(get_pi_user),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(
        Proposal.id == proposal_id, Proposal.pi_id == pi.id
    ).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status == "submitted":
        raise HTTPException(status_code=400, detail="Cannot edit a submitted proposal")

    if body.status == "submitted":
        email_to_check = body.pi_email or pi.email
        validate_pi_email(email_to_check, pi, db)
        cycle = get_active_cycle(db)
        if cycle:
            now = datetime.utcnow()
            if cycle.submission_close and now > cycle.submission_close.replace(tzinfo=None):
                raise HTTPException(
                    status_code=400,
                    detail=f"Submission closed on {cycle.submission_close.strftime('%d %b %Y')}."
                )
            if cycle.submission_open and now < cycle.submission_open.replace(tzinfo=None):
                raise HTTPException(
                    status_code=400,
                    detail=f"Submissions open on {cycle.submission_open.strftime('%d %b %Y')}."
                )
        proposal.grant_cycle_id = cycle.id if cycle else proposal.grant_cycle_id
        proposal.grant_cycle = cycle.title if cycle else proposal.grant_cycle

    for field, value in body.model_dump(exclude_unset=True).items():
        if field not in ("grant_cycle", "grant_cycle_id"):
            setattr(proposal, field, value)

    if body.status == "submitted" and proposal.submitted_at is None:
        proposal.submitted_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(proposal)
    return proposal


# ── POST /proposals/{id}/revision ─────────────────────────────────────────────
@router.post("/{proposal_id}/revision", response_model=ProposalOut)
def submit_revision(
    proposal_id: int,
    revision_justification: str = Form(...),
    revised_file: Optional[UploadFile] = File(None),
    pi: User = Depends(get_pi_user),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(
        Proposal.id == proposal_id, Proposal.pi_id == pi.id
    ).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status != "revision_requested":
        raise HTTPException(status_code=400, detail="Revision not requested for this proposal")

    if revised_file and revised_file.filename:
        delete_old_file(proposal.revised_file_path)
        filename = safe_filename(proposal_id, pi.id, "revised",
                                  revised_file.filename, proposal.grant_cycle)
        path = os.path.join(UPLOAD_DIR, filename)
        with open(path, "wb") as f:
            shutil.copyfileobj(revised_file.file, f)
        proposal.revised_file_path = path

    proposal.status = "revision_submitted"
    proposal.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(proposal)
    return proposal


# ── GET /proposals/{id}/download/{file_type} ──────────────────────────────────
@router.get("/{proposal_id}/download/{file_type}")
def download_file(
    proposal_id: int,
    file_type: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    role = current_user.get("role", "").lower()
    if role not in ("admin", "reviewer", "it"):
        if proposal.pi_id != int(current_user["sub"]):
            raise HTTPException(status_code=403, detail="Access denied")

    path_map = {
        "proposal": proposal.proposal_file_path,
        "supplementary": proposal.supplementary_file_path,
        "revised": proposal.revised_file_path,
    }
    if file_type not in path_map:
        raise HTTPException(status_code=400, detail="Invalid file type")
    file_path = path_map[file_type]
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=file_path, media_type="application/octet-stream",
                        filename=os.path.basename(file_path))