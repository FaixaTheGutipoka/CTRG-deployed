from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.models.models import User, Proposal, Notification, GrantCycle, Reviewer, Assignment, Review  # noqa: F401
from app.routes import auth, proposals, notifications, admin_proposals, grant_cycles, reviewers, reports, reviewer

import os
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-local-dev-key")

app = FastAPI(title="CTRG API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://ctrg-deployed.vercel.app",        # covers all your Vercel previews
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create all tables on startup
Base.metadata.create_all(bind=engine)

# Routers
app.include_router(auth.router)
app.include_router(proposals.router)
app.include_router(notifications.router)
app.include_router(admin_proposals.router)
app.include_router(grant_cycles.router)
app.include_router(reviewers.router)
app.include_router(reports.router)
app.include_router(reviewer.router)


@app.get("/")
def root():
    return {"message": "CTRG API is running"}