"""A patient is the same record whichever door they came through.

There are three ways a patient record gets written — the person signs up
themselves, the front desk registers them on POST /users, or someone edits an
existing record — and each used to collect a different subset of the person.
Sign-up asked for insurance and allergies; the front desk's Add Patient asked
for name, phone, gender, blood group and date of birth and nothing else; the
edit modal could not reach insurance at all. Nobody, anywhere, could record an
address or an Aadhaar number, because the columns did not exist.

`PatientProfileFields` is now one list inherited by all three schemas, so these
tests are mostly about the property that follows from that: what you can give
at one door, you can give at every other.
"""

import uuid

from tests.conftest import PROVISIONED_PASSWORD, REQUIRED_CONSENTS

# Verhoeff-valid throughout: the API refuses a number that cannot exist, so a
# made-up one like 123456789012 would fail these tests for the wrong reason.
AADHAAR = "234567890124"
OTHER_AADHAAR = "999999990019"

FULL_ADDRESS = {
    "addressLine1": "12 Nehru Road",
    "addressLine2": "Near Jubilee Park",
    "city": "Pune",
    "district": "Pune",
    "state": "Maharashtra",
    "pincode": "411001",
    "country": "India",
}


def _unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _unique_phone() -> str:
    # Phone is unique per tenant now (see uq_users_tenant_phone) — a fixed
    # literal reused by every call in this file would collide with itself
    # inside hospital_a, which several tests share across multiple registrations.
    return f"9{uuid.uuid4().int % 10**9:09d}"


def _register(client, tenant, aadhaar: str = "", **overrides) -> dict:
    """A patient signing themselves up, with the details a person would give."""
    body = {
        "name": "Self Registered",
        "email": f"{_unique('self')}@patient.test",
        "password": PROVISIONED_PASSWORD,
        "phone": _unique_phone(),
        "role": "patient",
        "dateOfBirth": "1992-04-17",
        "gender": "female",
        "bloodGroup": "O+",
        "consents": REQUIRED_CONSENTS,
        **FULL_ADDRESS,
        **overrides,
    }
    if aadhaar:
        body["aadhaarNumber"] = aadhaar
    return client.post(
        "/auth/register", headers={"X-Hospital-Id": tenant.id}, json=body
    )


def _add_at_desk(tenant, aadhaar: str = "", **overrides):
    """The same patient, registered at the counter instead."""
    body = {
        "name": "Desk Registered",
        "email": f"{_unique('desk')}@patient.test",
        "password": PROVISIONED_PASSWORD,
        "role": "patient",
        "phone": _unique_phone(),
        "dateOfBirth": "1988-02-03",
        "gender": "male",
        "bloodGroup": "B+",
        "allergies": "Penicillin",
        "chronicDiseases": "Hypertension",
        "emergencyContact": "Ramesh Desai",
        "emergencyPhone": "9000000003",
        "insuranceProvider": "Star Health",
        "insuranceNumber": "SH-99881",
        **FULL_ADDRESS,
        **overrides,
    }
    if aadhaar:
        body["aadhaarNumber"] = aadhaar
    return tenant.post("/users", body)


def _patient_by_email(tenant, email: str) -> dict:
    rows = tenant.get("/patients").json()
    return next(row for row in rows if row.get("user", {}).get("email") == email)


# ---------------------------------------------------------------------------
# The record is the same shape from either door
# ---------------------------------------------------------------------------


def test_a_self_registered_patient_keeps_their_address_and_aadhaar(client, hospital_a):
    response = _register(client, hospital_a, AADHAAR)
    assert response.status_code == 200, response.text

    patient = response.json()["patient"]
    assert patient["aadhaarNumber"] == AADHAAR
    assert patient["addressLine1"] == "12 Nehru Road"
    assert patient["city"] == "Pune"
    assert patient["pincode"] == "411001"
    assert patient["country"] == "India"


def test_the_front_desk_collects_the_whole_record_too(hospital_a):
    """The property this change exists for: POST /users used to accept three
    patient fields, so anything else about the person was uncollectable until
    somebody opened the edit modal — which could not reach half of it either."""
    email = f"{_unique('desk')}@patient.test"
    created = _add_at_desk(hospital_a, OTHER_AADHAAR, email=email)
    assert created.status_code == 201, created.text

    patient = _patient_by_email(hospital_a, email)
    assert patient["aadhaarNumber"] == OTHER_AADHAAR
    assert patient["addressLine1"] == "12 Nehru Road"
    assert patient["state"] == "Maharashtra"
    assert patient["allergies"] == "Penicillin"
    assert patient["chronicDiseases"] == "Hypertension"
    assert patient["emergencyContact"] == "Ramesh Desai"
    assert patient["insuranceProvider"] == "Star Health"
    assert patient["insuranceNumber"] == "SH-99881"


def test_an_omitted_field_lands_empty_rather_than_null(hospital_a):
    """A walk-in is registered with a name and little else. The record still has
    to be readable, so absent means "" — never a NULL that breaks a list read."""
    email = f"{_unique('bare')}@patient.test"
    created = hospital_a.post(
        "/users",
        {
            "name": "Bare Minimum",
            "email": email,
            "password": PROVISIONED_PASSWORD,
            "role": "patient",
        },
    )
    assert created.status_code == 201, created.text

    patient = _patient_by_email(hospital_a, email)
    assert patient["aadhaarNumber"] == ""
    assert patient["addressLine1"] == ""
    # Except the one field with a sensible default: an address with no country
    # prints as a line ending in a comma.
    assert patient["country"] == "India"


# ---------------------------------------------------------------------------
# The number has to be transcribed correctly to be worth collecting
# ---------------------------------------------------------------------------


def test_a_mistyped_aadhaar_is_refused(client, hospital_a):
    """Its only use is matching a person to a record they already have, and a
    number with a digit wrong matches nothing. Verhoeff catches it without
    asking UIDAI anything."""
    refused = _register(client, hospital_a, "234567890123")
    assert refused.status_code == 422, refused.text


def test_a_number_aadhaar_never_issues_is_refused(client, hospital_a):
    """No Aadhaar begins 0 or 1, which is what makes 111111111111 detectable as
    a placeholder somebody typed to get past a required field."""
    refused = _register(client, hospital_a, "111111111111")
    assert refused.status_code == 422, refused.text


def test_the_spaced_form_off_the_card_is_accepted(client, hospital_a):
    """People copy the number as it is printed. Rejecting a correct number over
    its spacing teaches the desk to skip the field."""
    response = _register(client, hospital_a, "4444 4444 0003")
    assert response.status_code == 200, response.text
    assert response.json()["patient"]["aadhaarNumber"] == "444444440003"


def test_a_bad_pincode_is_refused(hospital_a):
    refused = _add_at_desk(hospital_a, pincode="41100")
    assert refused.status_code == 422, refused.text


# ---------------------------------------------------------------------------
# One person, one record, per hospital
# ---------------------------------------------------------------------------


def test_the_same_person_cannot_be_registered_twice(hospital_a):
    """The duplicate this number exists to prevent. Answered as a 409 the desk
    can read, not as the unique index raising a 500 underneath them."""
    aadhaar = "555555550001"
    first = _add_at_desk(hospital_a, aadhaar)
    assert first.status_code == 201, first.text

    again = _add_at_desk(hospital_a, aadhaar)
    assert again.status_code == 409, again.text
    assert "already registered" in again.json()["detail"].lower()


def test_editing_a_record_onto_a_taken_number_is_the_same_duplicate(hospital_a):
    aadhaar = "666666660002"
    assert _add_at_desk(hospital_a, aadhaar).status_code == 201

    email = f"{_unique('other')}@patient.test"
    assert _add_at_desk(hospital_a, email=email).status_code == 201
    other = _patient_by_email(hospital_a, email)

    refused = hospital_a.put(f"/patients/{other['id']}", json={"aadhaarNumber": aadhaar})
    assert refused.status_code == 409, refused.text


def test_a_record_may_keep_its_own_number_when_edited(hospital_a):
    """Saving the form unchanged must not read as a duplicate of itself."""
    aadhaar = "777777770001"
    email = f"{_unique('keep')}@patient.test"
    assert _add_at_desk(hospital_a, aadhaar, email=email).status_code == 201
    patient = _patient_by_email(hospital_a, email)

    response = hospital_a.put(
        f"/patients/{patient['id']}",
        json={"aadhaarNumber": aadhaar, "city": "Nagpur"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["city"] == "Nagpur"


def test_the_same_person_at_two_hospitals_is_two_records(hospital_a, hospital_b):
    """Uniqueness is per tenant. One hospital must not be able to discover that
    a patient exists at another by being told their number is taken."""
    aadhaar = "888888880001"
    assert _add_at_desk(hospital_a, aadhaar).status_code == 201
    assert _add_at_desk(hospital_b, aadhaar).status_code == 201


# ---------------------------------------------------------------------------
# Editing
# ---------------------------------------------------------------------------


def test_an_edit_reaches_every_field_the_forms_collect(hospital_a):
    """Insurance was collected at sign-up and then unreachable: the edit schema
    had no field for it. Everything one door collects, another can correct."""
    email = f"{_unique('edit')}@patient.test"
    assert _add_at_desk(hospital_a, email=email).status_code == 201
    patient = _patient_by_email(hospital_a, email)

    response = hospital_a.put(
        f"/patients/{patient['id']}",
        json={
            "insuranceProvider": "New India Assurance",
            "insuranceNumber": "NIA-4410",
            "addressLine1": "44 MG Road",
            "city": "Nashik",
            "pincode": "422001",
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["insuranceProvider"] == "New India Assurance"
    assert body["addressLine1"] == "44 MG Road"
    assert body["pincode"] == "422001"
    # Untouched fields stay put: unset means untouched, not blanked.
    assert body["state"] == "Maharashtra"


def test_one_hospital_cannot_read_anothers_patient_address(hospital_a, hospital_b):
    email = f"{_unique('scoped')}@patient.test"
    assert _add_at_desk(hospital_a, email=email).status_code == 201
    theirs = _patient_by_email(hospital_a, email)

    assert hospital_b.get(f"/patients/{theirs['id']}").status_code == 404
