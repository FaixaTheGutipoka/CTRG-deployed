# back-end/app/models/models.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    # "admin" | "reviewer" | "user"
    # NOTE: ALL users are also PIs — role just tracks secondary assignment
    role = Column(String, nullable=False, default="user")
    department = Column(String, nullable=True)       # stored at user level too
    expertise = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_demo = Column(Boolean, default=False)          # marks the 3 demo seed accounts
    reset_token = Column(String, nullable=True)
    reset_token_expiry = Column(DateTime, nullable=True)

    proposals = relationship("Proposal", back_populates="pi", foreign_keys="Proposal.pi_id")
    notifications = relationship("Notification", back_populates="user")
    reviewer_profile = relationship("Reviewer", back_populates="user", uselist=False)


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    research_area = Column(String, nullable=True)
    keywords = Column(String, nullable=True)
    grant_cycle_id = Column(Integer, ForeignKey("grant_cycles.id"), nullable=True)
    grant_cycle = Column(String, nullable=True, default="CTRG 2025-2026")
    pi_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pi_name = Column(String, nullable=True)
    pi_department = Column(String, nullable=True)
    pi_email = Column(String, nullable=True)
    co_investigators = Column(Text, nullable=True)
    budget_summary = Column(Text, nullable=True)
    timeline = Column(Text, nullable=True)
    ethics_confirmed = Column(Boolean, default=False)
    proposal_file_path = Column(String, nullable=True)          # main proposal (PDF)
    supplementary_file_path = Column(String, nullable=True)     # legacy single supp file
    revised_file_path = Column(String, nullable=True)
    status = Column(String, nullable=False, default="draft")
    stage = Column(String, nullable=True)
    revision_count = Column(Integer, default=0)                 # max 3 revision requests
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    pi = relationship("User", back_populates="proposals", foreign_keys=[pi_id])
    assignments = relationship("Assignment", back_populates="proposal")
    supplementary_files = relationship("ProposalFile", back_populates="proposal",
                                       cascade="all, delete-orphan")


class ProposalFile(Base):
    """Stores multiple supplementary files per proposal (any file type)."""
    __tablename__ = "proposal_files"

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    file_path = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)           # bytes
    mime_type = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    proposal = relationship("Proposal", back_populates="supplementary_files")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=True)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")
    proposal = relationship("Proposal")


class GrantCycle(Base):
    __tablename__ = "grant_cycles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    budget = Column(Float, nullable=True)
    description = Column(Text, nullable=True)
    submission_open = Column(DateTime(timezone=True), nullable=True)
    submission_close = Column(DateTime(timezone=True), nullable=True)
    stage1_start = Column(DateTime(timezone=True), nullable=True)
    stage1_end = Column(DateTime(timezone=True), nullable=True)
    stage2_start = Column(DateTime(timezone=True), nullable=True)
    stage2_end = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    proposals = relationship("Proposal", backref="cycle", foreign_keys="Proposal.grant_cycle_id")
    reviewers = relationship("Reviewer", back_populates="grant_cycle")


class Reviewer(Base):
    __tablename__ = "reviewers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    grant_cycle_id = Column(Integer, ForeignKey("grant_cycles.id"), nullable=True)
    expertise = Column(String, nullable=True)
    department = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="reviewer_profile")
    grant_cycle = relationship("GrantCycle", back_populates="reviewers")
    assignments = relationship("Assignment", back_populates="reviewer")


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    grant_cycle_id = Column(Integer, ForeignKey("grant_cycles.id"), nullable=True)
    stage = Column(String, nullable=True)               # "Stage 1" | "Stage 2"
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())

    reviewer = relationship("Reviewer", back_populates="assignments")
    proposal = relationship("Proposal", back_populates="assignments")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("reviewers.id"), nullable=False)
    proposal_id = Column(Integer, ForeignKey("proposals.id"), nullable=False)
    stage = Column(String, nullable=False)              # "Stage 1" | "Stage 2"
    status = Column(String, default="draft")            # "draft" | "submitted"

    # Stage 1 scoring (out of 100 total)
    score_originality = Column(Float, nullable=True)    # max 15
    score_clarity = Column(Float, nullable=True)        # max 15
    score_literature = Column(Float, nullable=True)     # max 15
    score_methodology = Column(Float, nullable=True)    # max 15
    score_impact = Column(Float, nullable=True)         # max 15
    score_publication = Column(Float, nullable=True)    # max 10
    score_budget = Column(Float, nullable=True)         # max 10
    score_timeline = Column(Float, nullable=True)       # max  5
    total_score = Column(Float, nullable=True)

    # Stage 2 fields
    concerns_addressed = Column(String, nullable=True)  # "Yes" | "Partially" | "No"
    recommendation = Column(String, nullable=True)      # "Accept" | "Reject"
    revised_score = Column(Float, nullable=True)

    # Shared
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    assignment = relationship("Assignment", backref="review")
    reviewer = relationship("Reviewer", backref="reviews")
    proposal = relationship("Proposal", backref="reviews")