"""The hospital's consultation price list.

Reading is deliberately wide (`fees.read`): everyone who books or bills needs to
know what a visit costs, patients included — a price the patient cannot see is a
price they cannot consent to. Writing is `fees.manage`, which is the hospital
admin's, not the platform's: what to charge is the hospital's business decision,
unlike `departments.manage` or `hospital.settings.manage`, which reach
provisioning.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, pricing, schemas
from ..authz import require_permission
from ..database import get_db
from ..tenancy import get_tenant_id, scoped
from ..utils import new_id, now_iso

router = APIRouter(prefix="/consultation-fees", tags=["consultation-fees"])


@router.get("", response_model=list[schemas.ConsultationFeeOut])
def list_consultation_fees(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    _: str = Depends(require_permission("fees.read")),
    tenant_id: str = Depends(get_tenant_id),
):
    """The price list. Inactive rows are hidden unless asked for, so a booking
    screen shows only what is currently offered while the management screen can
    still see what was retired."""
    query = scoped(db, models.ConsultationFee, tenant_id)
    if not include_inactive:
        query = query.filter(models.ConsultationFee.active.is_(True))
    return query.order_by(
        models.ConsultationFee.sort_order, models.ConsultationFee.label
    ).all()


@router.post("", response_model=schemas.ConsultationFeeOut, status_code=status.HTTP_201_CREATED)
def create_consultation_fee(
    body: schemas.ConsultationFeeCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_permission("fees.manage")),
    tenant_id: str = Depends(get_tenant_id),
):
    label = body.label.strip()
    if not label:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Label is required")
    if (body.amount or 0) < 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Amount cannot be negative")

    visit_type = (body.visit_type or pricing.slugify_visit_type(label)).strip()
    if pricing.find_fee(db, tenant_id, visit_type) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"A fee for '{visit_type}' already exists.",
        )

    fee = models.ConsultationFee(
        id=new_id("fee"),
        hospital_id=tenant_id,
        visit_type=visit_type,
        label=label,
        amount=body.amount or 0,
        active=body.active,
        sort_order=body.sort_order,
        created_at=now_iso(),
    )
    db.add(fee)
    db.commit()
    db.refresh(fee)
    return fee


@router.put("/{fee_id}", response_model=schemas.ConsultationFeeOut)
def update_consultation_fee(
    fee_id: str,
    body: schemas.ConsultationFeeUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_permission("fees.manage")),
    tenant_id: str = Depends(get_tenant_id),
):
    fee = (
        scoped(db, models.ConsultationFee, tenant_id)
        .filter(models.ConsultationFee.id == fee_id)
        .first()
    )
    if fee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fee not found")

    if body.amount is not None:
        if body.amount < 0:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Amount cannot be negative")
        fee.amount = body.amount
    if body.label is not None:
        label = body.label.strip()
        if not label:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Label is required")
        # `visit_type` stays put: appointments already booked reference it, and
        # renaming a price should not rewrite what a past visit was billed as.
        fee.label = label
    if body.active is not None:
        fee.active = body.active
    if body.sort_order is not None:
        fee.sort_order = body.sort_order

    db.commit()
    db.refresh(fee)
    return fee


@router.delete("/{fee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_consultation_fee(
    fee_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(require_permission("fees.manage")),
    tenant_id: str = Depends(get_tenant_id),
):
    """Retire a price.

    Deactivates rather than deletes when appointments were booked at this price,
    so the day-report can still say what a past visit was billed as. A row
    nothing references is removed outright.
    """
    fee = (
        scoped(db, models.ConsultationFee, tenant_id)
        .filter(models.ConsultationFee.id == fee_id)
        .first()
    )
    if fee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fee not found")

    in_use = (
        scoped(db, models.Appointment, tenant_id)
        .filter(models.Appointment.visit_type == fee.visit_type)
        .first()
        is not None
    )
    if in_use:
        fee.active = False
    else:
        db.delete(fee)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
