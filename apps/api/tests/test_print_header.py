"""The hospital block that goes on top of anything a tenant prints.

`GET /hospitals/current/print-header` is the letterhead source for a lab report
today and a prescription later — the same identity the GST invoice already
carries in its seller block, minus the tax id. It answers any signed-in member
of the tenant, because the letterhead is not a secret to the staff who print on
it and each document is still gated by its own endpoint.
"""

import io

from tests.conftest import a4_letterhead_png


def _seed_identity(tenant):
    tenant.patch("/hospitals/me/settings", json={
        "addressLine1": "42 Health Road", "city": "Pune",
        "state": "Maharashtra", "pincode": "411001",
        "phonePrimary": "9812345678", "email": "front-desk@example.com",
    })
    tenant.client.put(
        "/hospitals/me/letterhead",
        headers=tenant.headers(),
        files={"file": ("lh.png", io.BytesIO(a4_letterhead_png()), "image/png")},
    )


def test_it_carries_the_letterhead_and_the_identity(hospital_a):
    _seed_identity(hospital_a)

    response = hospital_a.get("/hospitals/current/print-header")
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["name"], "the sheet is never anonymous"
    assert "Pune" in body["address"]
    assert body["phone"] == "9812345678"
    assert body["letterheadUrl"], "the letterhead is what gets printed on top"


def test_the_url_is_signed_not_the_stored_reference(hospital_a):
    _seed_identity(hospital_a)
    body = hospital_a.get("/hospitals/current/print-header").json()
    # storage.public_url() turns the opaque stored ref into something a browser
    # can fetch — never handed out raw.
    assert not body["letterheadUrl"].startswith("r2://")


def test_it_does_not_carry_the_gstin(hospital_a):
    """A report has no use for the tax id, and it should not be readable
    anywhere the GST invoice (behind payments.read) does not already serve it."""
    body = hospital_a.get("/hospitals/current/print-header").json()
    assert "gstin" not in body


def test_any_signed_in_member_of_the_tenant_can_read_it(hospital_a):
    """Not an admin-only capability — the nurse and the patient print too."""
    for token in (hospital_a.nurse_token, hospital_a.doctor_token,
                  hospital_a.ids["patient_token"]):
        response = hospital_a.get("/hospitals/current/print-header", token=token)
        assert response.status_code == 200, response.text


def test_it_needs_a_signed_in_caller(client, hospital_a):
    response = client.get(
        "/hospitals/current/print-header",
        headers={"X-Hospital-Id": hospital_a.id},
    )
    assert response.status_code == 401, response.text


def test_the_tenant_comes_from_the_token(hospital_a, hospital_b):
    """No id in the URL — hospital B's caller gets hospital B's letterhead,
    whatever host header rides along."""
    a = hospital_a.get("/hospitals/current/print-header").json()
    b = hospital_b.get("/hospitals/current/print-header").json()
    assert "Alpha" in a["name"]
    assert "Beta" in b["name"]
