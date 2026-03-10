#"back-end/app/schemas/schemas.py"

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# Auth 

class LoginSchema(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# Proposal

class ProposalCreate(BaseModel):
    title: str
    research_area: Optional[str] = None
    keywords: Optional[str] = None
    grant_cycle: Optional[str] = "CTRG 2025-2026"
    pi_name: Optional[str] = None
    pi_department: Optional[str] = None
    pi_email: Optional[str] = None
    co_investigators: Optional[str] = None
    budget_summary: Optional[str] = None
    timeline: Optional[str] = None
    ethics_confirmed: Optional[bool] = False
    status: Optional[str] = "draft"   # "draft" or "submitted"


class ProposalOut(BaseModel):
    id: int
    title: str
    research_area: Optional[str]
    keywords: Optional[str]
    grant_cycle: Optional[str]
    pi_name: Optional[str]
    pi_department: Optional[str]
    pi_email: Optional[str]
    co_investigators: Optional[str]
    budget_summary: Optional[str]
    timeline: Optional[str]
    ethics_confirmed: Optional[bool]
    proposal_file_path: Optional[str]
    supplementary_file_path: Optional[str]
    revised_file_path: Optional[str]
    status: str
    stage: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    submitted_at: Optional[datetime]

    class Config:
        from_attributes = True


class ProposalStatsOut(BaseModel):
    total: int
    draft: int
    submitted: int
    under_review: int
    revision_requested: int
    revision_submitted: int
    approved: int
    rejected: int


class RevisionSubmit(BaseModel):
    revision_justification: Optional[str] = None


# Notifications

class NotificationOut(BaseModel):
    id: int
    proposal_id: Optional[int]
    message: str
    is_read: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# Grant Cycle

class GrantCycleCreate(BaseModel):
    title: str
    budget: Optional[float] = None
    description: Optional[str] = None
    submission_open: Optional[datetime] = None
    submission_close: Optional[datetime] = None
    stage1_start: Optional[datetime] = None
    stage1_end: Optional[datetime] = None
    stage2_start: Optional[datetime] = None
    stage2_end: Optional[datetime] = None


class GrantCycleOut(BaseModel):
    id: int
    title: str
    budget: Optional[float]
    description: Optional[str]
    submission_open: Optional[datetime]
    submission_close: Optional[datetime]
    stage1_start: Optional[datetime]
    stage1_end: Optional[datetime]
    stage2_start: Optional[datetime]
    stage2_end: Optional[datetime]
    is_active: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# Reviewer

class ReviewerCreate(BaseModel):
    full_name: str
    email: str
    password: str
    expertise: Optional[str] = None
    department: Optional[str] = None
    grant_cycle_id: Optional[int] = None


class ReviewerOut(BaseModel):
    id: int
    user_id: int
    expertise: Optional[str]
    department: Optional[str]
    is_active: bool
    grant_cycle_id: Optional[int]
    created_at: Optional[datetime]
    full_name: Optional[str] = None
    email: Optional[str] = None
    assigned_count: Optional[int] = 0

    class Config:
        from_attributes = True


# Assignment

class AssignmentCreate(BaseModel):
    proposal_id: int
    reviewer_ids: list[int]   # list of reviewer IDs (max 4)
    stage: Optional[str] = "Stage 1"


class AssignmentOut(BaseModel):
    id: int
    reviewer_id: int
    proposal_id: int
    stage: Optional[str]
    assigned_at: Optional[datetime]

    class Config:
        from_attributes = True