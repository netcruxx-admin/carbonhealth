"""The hospital identity that goes on top of anything printed.

A bill, a lab report and (later) a prescription are all handed to a patient on
the hospital's own paper. Each needs the same block at the top — the letterhead
artwork if the hospital uploaded one, otherwise the name, address and phone as
text so the document is never anonymous. This composes it once.

`build_print_header` returns a plain dict rather than a schema so the two
callers can each pick what they expose: the invoice keeps `gstin` (a GST
invoice is not valid without it, and `payments.read` already gates that
endpoint), while `GET /hospitals/current/print-header` drops it — a lab report
has no use for the hospital's tax id and it should not spread further than the
one place that needs it.

The three `_url` fields are signed on the way out via `storage.public_url()`:
what is stored is an opaque, stable reference and what a browser can fetch is a
different, expiring string. Callers must not write the result back.
"""

from sqlalchemy.orm import Session

from . import models, storage


def _compose_address(profile: models.HospitalProfile | None) -> str:
    if profile is None:
        return ""
    parts = (
        profile.address_line1 or "",
        profile.address_line2 or "",
        profile.city or "",
        profile.state or "",
        profile.pincode or "",
    )
    return ", ".join(part for part in parts if part)


def _margins(profile: models.HospitalProfile | None) -> dict:
    """The declared safe box, falling back to the column defaults when the row
    predates the feature or has no profile at all."""
    def mm(attr: str, fallback: int) -> int:
        value = getattr(profile, attr, None) if profile else None
        return fallback if value is None else value

    return {
        "top": mm("letterhead_margin_top_mm", 48),
        "bottom": mm("letterhead_margin_bottom_mm", 32),
        "left": mm("letterhead_margin_left_mm", 18),
        "right": mm("letterhead_margin_right_mm", 18),
    }


def build_print_header(db: Session, tenant_id: str) -> dict:
    """The hospital block for any printable, keyed for both consumers.

    Keys: name, legal_name, gstin, address, phone, email, logo_url,
    letterhead_url, signature_url, letterhead_margins. `PrintHeaderOut` ignores
    `gstin`; `InvoiceSeller` ignores `signature_url`.
    """
    hospital = db.get(models.Hospital, tenant_id)
    profile = (
        db.query(models.HospitalProfile)
        .filter(models.HospitalProfile.hospital_id == tenant_id)
        .first()
    )
    return {
        "name": (hospital.name if hospital else "") or "",
        "legal_name": (hospital.legal_name if hospital else "") or "",
        "gstin": (hospital.gstin if hospital else "") or "",
        "address": _compose_address(profile),
        "phone": (profile.phone_primary if profile else "") or "",
        "email": (profile.email if profile else "") or "",
        "logo_url": storage.public_url(profile.logo_url if profile else ""),
        "letterhead_url": storage.public_url(profile.letterhead_url if profile else ""),
        "signature_url": storage.public_url(profile.signature_url if profile else ""),
        "letterhead_margins": _margins(profile),
    }
