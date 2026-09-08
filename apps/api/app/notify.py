"""Push notifications via Firebase Cloud Messaging.

Initialised lazily on first use so the rest of the API starts normally when
the service account file is absent (CI, unit tests, fresh dev checkouts).

Usage anywhere in the backend:

    from . import notify
    notify.send(db, user_id="user-abc123", title="Appointment", body="...")
"""

import logging
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from . import models
from .config import settings

log = logging.getLogger(__name__)

_app = None          # firebase_admin.App, once initialised
_initialized = False # True once we've tried (even if it failed)


def _get_app():
    """Return the Firebase Admin app, initialising it on the first call."""
    global _app, _initialized
    if _initialized:
        return _app

    _initialized = True
    sa_path = Path(__file__).resolve().parent.parent / settings.firebase_service_account

    if not sa_path.exists():
        log.warning(
            "Firebase service account not found at %s — push notifications disabled.",
            sa_path,
        )
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials
        cred = credentials.Certificate(str(sa_path))
        _app = firebase_admin.initialize_app(cred)
        log.info("Firebase Admin initialised from %s", sa_path)
    except Exception:
        log.exception("Failed to initialise Firebase Admin — push notifications disabled.")
        _app = None

    return _app


def send(
    db: Session,
    *,
    user_id: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> int:
    """Send a push notification to every registered device for `user_id`.

    Returns the number of messages successfully sent.  Never raises — a failed
    push must not roll back the database transaction that triggered it.
    """
    app = _get_app()
    if app is None:
        return 0

    tokens = (
        db.query(models.FcmToken)
        .filter(models.FcmToken.user_id == user_id)
        .all()
    )
    if not tokens:
        return 0

    try:
        from firebase_admin import exceptions as fb_exceptions, messaging
    except ImportError:
        log.warning("firebase_admin not installed — push notifications disabled.")
        return 0

    sent = 0
    stale: list[str] = []

    # Deliberately a data-only message — no top-level `notification` field.
    # When one is present, the browser auto-displays it using Firebase's own
    # internal handling and never invokes our onBackgroundMessage handler at
    # all, which means the notification actually shown was never the one we
    # attached click-routing `data` to — the click then has nothing to route
    # on. Putting title/body inside `data` instead guarantees our handler
    # (web/public/firebase-messaging-sw.js) always runs and always has it.
    for record in tokens:
        payload = {"title": title, "body": body, **{k: str(v) for k, v in (data or {}).items()}}
        msg = messaging.Message(
            data=payload,
            token=record.token,
        )
        try:
            messaging.send(msg, app=app)
            sent += 1
        except (messaging.UnregisteredError, fb_exceptions.InvalidArgumentError):
            # Token has been unregistered or is malformed — remove it so we
            # stop trying to deliver to a device that has revoked permission.
            # (These arrive as typed exceptions, not as a particular string in
            # str(exc) — a prior version of this check matched on message
            # text like "registration-token-not-registered", which never
            # actually appears in firebase_admin's human-readable messages
            # ("Device unregistered.", "The registration token is not a valid
            # FCM registration token"), so no token was ever pruned.)
            stale.append(record.id)
        except Exception as exc:
            log.warning("FCM send failed for token %s: %s", record.id, exc)

    if stale:
        db.query(models.FcmToken).filter(models.FcmToken.id.in_(stale)).delete()
        db.commit()
        log.info("Removed %d stale FCM token(s) for user %s", len(stale), user_id)

    return sent


def notify_patient(
    db: Session,
    tenant_id: str,
    patient_id: str,
    *,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> int:
    """Push to the user account behind a patient record, scoped to the tenant."""
    patient = (
        db.query(models.Patient)
        .filter(models.Patient.id == patient_id, models.Patient.hospital_id == tenant_id)
        .first()
    )
    if patient is None:
        return 0
    return send(db, user_id=patient.user_id, title=title, body=body, data=data)


def notify_doctor(
    db: Session,
    tenant_id: str,
    doctor_id: str,
    *,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> int:
    """Push to the user account behind a doctor record, scoped to the tenant."""
    doctor = (
        db.query(models.Doctor)
        .filter(models.Doctor.id == doctor_id, models.Doctor.hospital_id == tenant_id)
        .first()
    )
    if doctor is None:
        return 0
    return send(db, user_id=doctor.user_id, title=title, body=body, data=data)


def notify_role(
    db: Session,
    tenant_id: str,
    role_code: str,
    *,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> int:
    """Push to every user holding `role_code` at this hospital.

    For events with no single owning patient or doctor — a stock threshold, a
    new item landing in a shared queue — where whoever holds the relevant role
    at this hospital should hear about it, not one specific record's people.
    """
    users = (
        db.query(models.User)
        .filter(models.User.hospital_id == tenant_id, models.User.role == role_code)
        .all()
    )
    return sum(send(db, user_id=u.id, title=title, body=body, data=data) for u in users)
