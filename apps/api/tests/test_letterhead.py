"""The full-page letterhead: what may be uploaded, and the safe box on top of it.

A hospital's letterhead is placed as a full-page A4 background and the print
sheet keeps its content inside a box the hospital declares — four margins in
millimetres. So the upload is fussy about proportions (a non-A4 image would
stretch and the margins would land wrong) and the margins ride on the profile
like every other setting.
"""

import io

from PIL import Image

from tests.conftest import a4_letterhead_png

LH = "/hospitals/me/letterhead"
SETTINGS = "/hospitals/me/settings"


def _png(width: int, height: int) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, format="PNG")
    return buffer.getvalue()


def _upload(tenant, data: bytes, *, name="lh.png", content_type="image/png", token=None):
    return tenant.client.put(
        LH,
        headers=tenant.headers(token),
        files={"file": (name, io.BytesIO(data), content_type)},
    )


# --- the upload accepts only a print-worthy A4 portrait --------------------

def test_an_a4_portrait_letterhead_is_accepted(hospital_a):
    response = _upload(hospital_a, a4_letterhead_png())
    assert response.status_code == 200, response.text
    assert response.json()["letterheadUrl"]


def test_a_four_by_three_image_is_rejected(hospital_a):
    response = _upload(hospital_a, _png(1600, 1200))
    assert response.status_code == 422, response.text
    assert "A4" in response.json()["detail"]


def test_a_landscape_letterhead_is_rejected(hospital_a):
    response = _upload(hospital_a, _png(1754, 1240))
    assert response.status_code == 422, response.text
    assert "landscape" in response.json()["detail"].lower()


def test_a_low_resolution_letterhead_is_rejected(hospital_a):
    # Right proportions, but ~half the dpi floor — would print fuzzy.
    response = _upload(hospital_a, _png(620, 877))
    assert response.status_code == 422, response.text
    assert "dpi" in response.json()["detail"] or "print" in response.json()["detail"]


def test_a_file_that_is_not_an_image_is_rejected(hospital_a):
    response = _upload(hospital_a, b"this is not a png", name="lh.png")
    assert response.status_code == 400, response.text


def test_a_pdf_letterhead_is_rejected_before_it_is_even_opened(hospital_a):
    response = _upload(hospital_a, b"%PDF-1.4", name="lh.pdf", content_type="application/pdf")
    assert response.status_code == 415, response.text


def test_a_nurse_cannot_upload_a_letterhead(hospital_a):
    response = _upload(hospital_a, a4_letterhead_png(), token=hospital_a.nurse_token)
    assert response.status_code == 403, response.text


# --- the safe-area margins -------------------------------------------------

def test_margins_have_sensible_defaults(hospital_a):
    profile = hospital_a.get(SETTINGS).json()["profile"]
    assert profile["letterheadMarginTopMm"] == 48
    assert profile["letterheadMarginBottomMm"] == 32
    assert profile["letterheadMarginLeftMm"] == 18
    assert profile["letterheadMarginRightMm"] == 18


def test_an_admin_can_set_the_margins(hospital_a):
    saved = hospital_a.patch(SETTINGS, json={
        "letterheadMarginTopMm": 60,
        "letterheadMarginBottomMm": 40,
        "letterheadMarginLeftMm": 22,
        "letterheadMarginRightMm": 22,
    })
    assert saved.status_code == 200, saved.text
    profile = hospital_a.get(SETTINGS).json()["profile"]
    assert profile["letterheadMarginTopMm"] == 60
    assert profile["letterheadMarginBottomMm"] == 40


def test_an_absurd_margin_is_refused(hospital_a):
    response = hospital_a.patch(SETTINGS, json={"letterheadMarginTopMm": 200})
    assert response.status_code == 422, response.text


def test_the_print_header_carries_the_margins(hospital_a):
    hospital_a.patch(SETTINGS, json={"letterheadMarginTopMm": 55})
    margins = hospital_a.get("/hospitals/current/print-header").json()["letterheadMargins"]
    assert margins["top"] == 55
    assert set(margins) == {"top", "bottom", "left", "right"}


def test_the_invoice_seller_carries_the_margins(hospital_a):
    hospital_a.patch(SETTINGS, json={"letterheadMarginBottomMm": 37})
    appointment = hospital_a.get("/appointments").json()[0]
    payment = hospital_a.post("/payments", json={
        "appointmentId": appointment["id"],
        "patientId": appointment["patientId"],
        "amount": 300, "status": "completed", "paymentMethod": "cash",
    }).json()
    seller = hospital_a.get(f"/payments/{payment['id']}/invoice").json()["seller"]
    assert seller["letterheadMargins"]["bottom"] == 37
