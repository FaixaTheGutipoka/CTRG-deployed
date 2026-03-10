#"back-end/app/routes/notifications.py"

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Notification, User
from app.schemas.schemas import NotificationOut
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def get_current_user_obj(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(User).filter(User.id == int(current_user["sub"])).first()


# ── GET /notifications ────────────────────────────────────────────────────────
# Get all notifications for the logged-in user

@router.get("", response_model=list[NotificationOut])
def get_notifications(
    user: User = Depends(get_current_user_obj),
    db: Session = Depends(get_db),
):
    return (
        db.query(Notification)
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .all()
    )


# ── GET /notifications/unread-count ──────────────────────────────────────────

@router.get("/unread-count")
def get_unread_count(
    user: User = Depends(get_current_user_obj),
    db: Session = Depends(get_db),
):
    count = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False,  # noqa: E712
    ).count()
    return {"unread": count}


# ── PATCH /notifications/{id}/read ────────────────────────────────────────────
# Mark a single notification as read

@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: int,
    user: User = Depends(get_current_user_obj),
    db: Session = Depends(get_db),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user.id,
    ).first()

    if not notification:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


# ── PATCH /notifications/read-all ─────────────────────────────────────────────
# Mark all notifications as read

@router.patch("/read-all")
def mark_all_read(
    user: User = Depends(get_current_user_obj),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}