from sqlalchemy.orm import Session

from .config import settings
from .models import User
from .security import hash_password


def seed_admin_user(db: Session) -> None:
    existing = db.query(User).filter(User.username == settings.admin_username).first()
    if existing:
        return

    db.add(
        User(
            username=settings.admin_username,
            password_hash=hash_password(settings.admin_password),
            auth_provider="local",
        )
    )
    db.commit()
