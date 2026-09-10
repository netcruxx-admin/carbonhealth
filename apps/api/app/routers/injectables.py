"""Injectables — the catalogue of shots a hospital stocks, plus the stock
ledger that feeds it. The injection-side counterpart of `medicines` +
`inventory`, collapsed into one router because a greenfield resource does not
need the historical medicines/inventory split: one `injectables.*` capability
covers browsing the catalogue, seeing stock, and moving it.

Orders live in `injection_orders`; administration (which is what consumes
stock) is there, not here."""

from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..authz import require_permission
from ..database import get_db
from ..tenancy import assert_body_in_tenant, get_tenant_id, scoped
from ..utils import ListQuery, list_params, new_id, now_iso, paginate, text_search

router = APIRouter(prefix="/injectables", tags=["injectables"])


# ── Catalogue ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[schemas.InjectableOut])
def list_injectables(
    response: Response,
    category: Optional[str] = Query(default=None),
    params: ListQuery = Depends(list_params),
    db: Session = Depends(get_db),
    _: str = Depends(require_permission("injectables.read")),
    tenant_id: str = Depends(get_tenant_id),
):
    query = scoped(db, models.Injectable, tenant_id)
    if category:
        query = query.filter(models.Injectable.category == category)
    query = text_search(
        query,
        [models.Injectable.name, models.Injectable.category, models.Injectable.form, models.Injectable.strength],
        params.q,
    )
    query = query.order_by(models.Injectable.name)
    return paginate(query, response, params.limit, params.offset).all()


@router.post("", response_model=schemas.InjectableOut, status_code=status.HTTP_201_CREATED)
def create_injectable(
    body: schemas.InjectableCreate,
    db: Session = Depends(get_db),
    _: str = Depends(require_permission("injectables.manage")),
    tenant_id: str = Depends(get_tenant_id),
):
    item = models.Injectable(id=new_id("inj"), hospital_id=tenant_id, **body.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{injectable_id}", response_model=schemas.InjectableOut)
def update_injectable(
    injectable_id: str,
    body: schemas.InjectableUpdate,
    db: Session = Depends(get_db),
    _: str = Depends(require_permission("injectables.manage")),
    tenant_id: str = Depends(get_tenant_id),
):
    item = (
        scoped(db, models.Injectable, tenant_id)
        .filter(models.Injectable.id == injectable_id)
        .first()
    )
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Injectable not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{injectable_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_injectable(
    injectable_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(require_permission("injectables.delete")),
    tenant_id: str = Depends(get_tenant_id),
):
    item = (
        scoped(db, models.Injectable, tenant_id)
        .filter(models.Injectable.id == injectable_id)
        .first()
    )
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Injectable not found")
    db.delete(item)
    db.commit()


# ── Stock ───────────────────────────────────────────────────────────────────

@router.get("/stock/low", response_model=list[schemas.InjectableOut])
def list_low_stock(
    db: Session = Depends(get_db),
    _: str = Depends(require_permission("injectables.read")),
    tenant_id: str = Depends(get_tenant_id),
):
    """Injectables at or below their reorder level."""
    return (
        scoped(db, models.Injectable, tenant_id)
        .filter(models.Injectable.stock <= models.Injectable.reorder_level)
        .order_by(models.Injectable.stock.asc())
        .all()
    )


@router.get("/stock/movements", response_model=list[schemas.InjectionStockMovementOut])
def list_movements(
    response: Response,
    injectable_id: Optional[str] = Query(default=None, alias="injectableId"),
    movement_type: Optional[str] = Query(default=None, alias="type"),
    params: ListQuery = Depends(list_params),
    db: Session = Depends(get_db),
    _: str = Depends(require_permission("injectables.read")),
    tenant_id: str = Depends(get_tenant_id),
):
    query = scoped(db, models.InjectionStockMovement, tenant_id)
    if injectable_id:
        query = query.filter(models.InjectionStockMovement.injectable_id == injectable_id)
    if movement_type:
        query = query.filter(models.InjectionStockMovement.movement_type == movement_type)
    query = query.order_by(models.InjectionStockMovement.created_at.desc())
    rows = paginate(query, response, params.limit, params.offset).all()
    return [_enrich_movement(db, tenant_id, m) for m in rows]


@router.post("/stock/restock", response_model=schemas.InjectionStockMovementOut, status_code=status.HTTP_201_CREATED)
def restock(
    body: schemas.InjectionRestockBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
    _: str = Depends(require_permission("injectables.manage")),
    tenant_id: str = Depends(get_tenant_id),
):
    assert_body_in_tenant(db, body, tenant_id)
    item = (
        scoped(db, models.Injectable, tenant_id)
        .filter(models.Injectable.id == body.injectable_id)
        .first()
    )
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Injectable not found")
    item.stock += body.quantity
    # A fresh lot replaces the recorded lot/expiry so the catalogue row tracks
    # the stock actually on the shelf.
    if body.lot_number:
        item.lot_number = body.lot_number
    if body.expiry_date:
        item.expiry_date = body.expiry_date
    movement = models.InjectionStockMovement(
        id=new_id("injmv"),
        hospital_id=tenant_id,
        injectable_id=body.injectable_id,
        movement_type="restock",
        quantity=body.quantity,
        lot_number=body.lot_number,
        expiry_date=body.expiry_date,
        notes=body.notes,
        performed_by=user.id,
        created_at=now_iso(),
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return _enrich_movement(db, tenant_id, movement)


@router.post("/stock/adjust", response_model=schemas.InjectionStockMovementOut, status_code=status.HTTP_201_CREATED)
def adjust(
    body: schemas.InjectionAdjustBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
    _: str = Depends(require_permission("injectables.manage")),
    tenant_id: str = Depends(get_tenant_id),
):
    assert_body_in_tenant(db, body, tenant_id)
    item = (
        scoped(db, models.Injectable, tenant_id)
        .filter(models.Injectable.id == body.injectable_id)
        .first()
    )
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Injectable not found")
    item.stock = max(0, item.stock + body.quantity)
    movement = models.InjectionStockMovement(
        id=new_id("injmv"),
        hospital_id=tenant_id,
        injectable_id=body.injectable_id,
        movement_type=body.movement_type,
        quantity=body.quantity,
        notes=body.notes,
        performed_by=user.id,
        created_at=now_iso(),
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return _enrich_movement(db, tenant_id, movement)


def _enrich_movement(
    db: Session, tenant_id: str, m: models.InjectionStockMovement
) -> schemas.InjectionStockMovementOut:
    result = schemas.InjectionStockMovementOut.model_validate(m)
    item = (
        scoped(db, models.Injectable, tenant_id)
        .filter(models.Injectable.id == m.injectable_id)
        .first()
    )
    if item:
        result.injectable_name = item.name
    u = db.query(models.User).filter(models.User.id == m.performed_by).first()
    if u:
        result.performed_by_name = u.name
    return result
