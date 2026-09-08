"""What a consultation costs — the one place that answers it.

The price of a visit used to live on the doctor, which made every new hire a
pricing decision and let a doctor edit their own rate from their profile. It now
lives on the hospital's fee schedule, keyed by the *kind* of visit: New Patient,
Follow-up, Emergency, plus whatever else a hospital adds.

The trust model is unchanged and is the whole point of this module: a client
names a `visit_type`, never an amount. Every caller that needs a number asks
`fee_for()`, so there is one answer to "what does this cost" and no endpoint can
be talked into a cheaper one by its request body.
"""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from . import models
from .tenancy import scoped
from .utils import new_id, now_iso

# What a hospital starts with. Amounts are 0 on purpose: a price is a business
# decision, and inventing one would have hospitals silently billing a number
# nobody chose. The booking flow refuses a visit type priced at 0 rather than
# taking money at a made-up rate.
DEFAULT_VISIT_TYPES = [
    ("new", "New Patient", 0),
    ("follow_up", "Follow-up", 1),
    ("emergency", "Emergency", 2),
]


def slugify_visit_type(label: str) -> str:
    """A stable key from a human label: "New Patient" -> "new_patient"."""
    slug = "".join(ch.lower() if ch.isalnum() else "_" for ch in label.strip())
    while "__" in slug:
        slug = slug.replace("__", "_")
    return slug.strip("_") or "visit"


def seed_default_fees(db: Session, hospital_id: str) -> list[models.ConsultationFee]:
    """Give a new hospital the standard three visit types, unpriced.

    Idempotent: only inserts the types that are missing, so it is safe to call
    on an existing tenant.
    """
    existing = {
        row.visit_type
        for row in scoped(db, models.ConsultationFee, hospital_id).all()
    }
    created: list[models.ConsultationFee] = []
    for visit_type, label, sort_order in DEFAULT_VISIT_TYPES:
        if visit_type in existing:
            continue
        row = models.ConsultationFee(
            id=new_id("fee"),
            hospital_id=hospital_id,
            visit_type=visit_type,
            label=label,
            amount=0,
            active=True,
            sort_order=sort_order,
            created_at=now_iso(),
        )
        db.add(row)
        created.append(row)
    return created


def find_fee(
    db: Session, tenant_id: str, visit_type: str
) -> models.ConsultationFee | None:
    return (
        scoped(db, models.ConsultationFee, tenant_id)
        .filter(models.ConsultationFee.visit_type == visit_type)
        .first()
    )


def fee_for(db: Session, tenant_id: str, visit_type: str) -> float:
    """The amount to charge for `visit_type`, or a 422 explaining why not.

    Raises rather than returning 0 so a hospital that has not set its prices
    gets told to set them, instead of quietly booking free consultations.
    """
    fee = find_fee(db, tenant_id, visit_type)
    if fee is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"No consultation fee is configured for '{visit_type}'.",
        )
    if not fee.active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"'{fee.label}' is no longer offered by this hospital.",
        )
    if (fee.amount or 0) <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"'{fee.label}' has no fee set. Please contact the hospital.",
        )
    return float(fee.amount)


def label_map(db: Session, tenant_id: str) -> dict[str, str]:
    """visit_type -> label, for reports that show what a visit was billed as."""
    return {
        row.visit_type: row.label
        for row in scoped(db, models.ConsultationFee, tenant_id).all()
    }


# ---------------------------------------------------------------------------
# Paying at the desk
# ---------------------------------------------------------------------------

# What the front desk can take in person. `razorpay` is deliberately absent:
# online is not a mode of this flow but a different one entirely
# (/payments/initiate -> checkout -> /payments/verify), and it writes its own
# completed payment row once the gateway signature has been checked.
COUNTER_PAYMENT_MODES = ("cash", "card", "upi")


def bill_at_counter(
    db: Session,
    *,
    tenant_id: str,
    appointment: models.Appointment,
    payment_mode: str | None,
) -> models.Payment | None:
    """Raise the pending consultation bill for a booking paid in person.

    Written by the server rather than by a second call from the browser for two
    reasons. The amount is ours — the client names a visit type, never a price.
    And whoever books is not necessarily allowed to raise bills: a doctor
    scheduling a follow-up and a patient booking their own slot both hold
    `appointments.create` and no `payments.create`, so a client-side POST
    /payments left them with an appointment and a 403 where the bill should be.

    Returns None — a booking, no bill — when the visit type carries no price.
    A hospital that has not set its fees yet can still take bookings, and a
    zero-rupee invoice would be a statement about money that nobody made.
    """
    if payment_mode not in COUNTER_PAYMENT_MODES:
        return None

    fee = find_fee(db, tenant_id, appointment.visit_type)
    if fee is None or not fee.active or (fee.amount or 0) <= 0:
        return None

    payment = models.Payment(
        id=new_id("pay"),
        hospital_id=tenant_id,
        appointment_id=appointment.id,
        patient_id=appointment.patient_id,
        amount=float(fee.amount),
        payment_type="consultation",
        # Pending, not completed: the money has not been handed over yet. The
        # desk marks it paid from the Payments screen once it has.
        status="pending",
        payment_method=payment_mode,
        created_at=now_iso(),
    )
    db.add(payment)
    return payment
