"""Email is optional, on every door that creates or edits an account — as
long as some way to sign in is left standing.

Phone login (test_login_identifier.py) is what makes this safe to allow at
all: an account with no email still has somewhere to go. What these tests
check is the other half — that "no email" never quietly becomes "no way in
at all", and that the loosened uniqueness on email behaves the same as the
one already proven on phone.
"""

import uuid

from tests.conftest import PROVISIONED_PASSWORD, REQUIRED_CONSENTS


def _unique_phone() -> str:
    return f"9{uuid.uuid4().int % 10**9:09d}"


def _stored(phone: str) -> str:
    # The backend does not normalise phone on write, only on login lookup
    # (see app/identity.py normalise_phone) — every real caller is the
    # frontend's PhoneField, which always sends +91-prefixed, so that is
    # what has to be written here for a later login-by-phone to match.
    return f"+91{phone}"


def test_self_registration_with_phone_only_succeeds_and_signs_in(client, hospital_a):
    phone = _unique_phone()
    response = client.post(
        "/auth/register",
        headers={"X-Hospital-Id": hospital_a.id},
        json={
            "name": "Phone Only",
            "password": PROVISIONED_PASSWORD,
            "phone": _stored(phone),
            "role": "patient",
            "dateOfBirth": "1990-01-01",
            "consents": REQUIRED_CONSENTS,
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["email"] == ""

    signed_in = client.post(
        "/auth/login",
        headers={"X-Hospital-Id": hospital_a.id},
        json={"identifier": phone, "password": PROVISIONED_PASSWORD},
    )
    assert signed_in.status_code == 200, signed_in.text


def test_registration_with_neither_email_nor_phone_is_refused(client, hospital_a):
    response = client.post(
        "/auth/register",
        headers={"X-Hospital-Id": hospital_a.id},
        json={
            "name": "Nobody Reachable",
            "password": PROVISIONED_PASSWORD,
            "role": "patient",
            "dateOfBirth": "1990-01-01",
            "consents": REQUIRED_CONSENTS,
        },
    )
    assert response.status_code == 422, response.text


def test_two_blank_email_patients_can_coexist(client, hospital_a):
    """Email's uniqueness has to be partial the same way phone's is — two
    accounts that both left it out are not a collision."""
    for _ in range(2):
        response = client.post(
            "/auth/register",
            headers={"X-Hospital-Id": hospital_a.id},
            json={
                "name": "Phone Only",
                "password": PROVISIONED_PASSWORD,
                "phone": _unique_phone(),
                "role": "patient",
                "dateOfBirth": "1990-01-01",
                "consents": REQUIRED_CONSENTS,
            },
        )
        assert response.status_code == 200, response.text


def test_the_front_desk_can_register_a_patient_with_phone_only(hospital_a):
    created = hospital_a.post(
        "/users",
        {
            "name": "Desk, Phone Only",
            "password": PROVISIONED_PASSWORD,
            "role": "patient",
            "phone": _unique_phone(),
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["email"] == ""


def test_a_doctor_account_with_phone_only_can_be_created_and_signed_in(client, hospital_a):
    phone = _unique_phone()
    created = hospital_a.post(
        "/users",
        {"name": "Dr Phone Only", "password": PROVISIONED_PASSWORD, "role": "doctor", "phone": _stored(phone)},
    )
    assert created.status_code == 201, created.text

    signed_in = client.post(
        "/auth/login",
        headers={"X-Hospital-Id": hospital_a.id},
        json={"identifier": phone, "password": PROVISIONED_PASSWORD},
    )
    assert signed_in.status_code == 200, signed_in.text
    assert signed_in.json()["user"]["role"] == "doctor"


def test_creating_a_user_with_neither_contact_method_is_refused(hospital_a):
    created = hospital_a.post(
        "/users",
        {"name": "Nobody Reachable", "password": PROVISIONED_PASSWORD, "role": "patient"},
    )
    assert created.status_code == 422, created.text


def test_clearing_your_own_email_is_fine_while_a_phone_remains(hospital_a):
    phone = _unique_phone()
    created = hospital_a.post(
        "/users",
        {
            "name": "Will Clear Email",
            "email": f"{uuid.uuid4().hex[:8]}@login.test",
            "password": PROVISIONED_PASSWORD,
            "role": "patient",
            "phone": phone,
        },
    )
    assert created.status_code == 201, created.text
    user_id = created.json()["id"]

    updated = hospital_a.put(f"/users/{user_id}", {"email": ""})
    assert updated.status_code == 200, updated.text
    assert updated.json()["email"] == ""
    assert updated.json()["phone"] == phone


def test_clearing_both_contact_methods_is_refused(hospital_a):
    created = hospital_a.post(
        "/users",
        {
            "name": "Will Try To Clear Both",
            "email": f"{uuid.uuid4().hex[:8]}@login.test",
            "password": PROVISIONED_PASSWORD,
            "role": "patient",
            "phone": _unique_phone(),
        },
    )
    assert created.status_code == 201, created.text
    user_id = created.json()["id"]

    refused = hospital_a.put(f"/users/{user_id}", {"email": "", "phone": ""})
    assert refused.status_code == 422, refused.text
