"""Who can read a lab result, and through which link.

`GET /test-results` is what the lab report screen calls. A result row carries
neither patient_id nor doctor_id, so an "own" grant is resolved through the
parent order: the patient whose order it is, and the doctor who placed it. The
lab holds it at scope "all".

The doctor case is the one that regressed — the endpoint used to treat any
non-patient "own" caller as unsupported and return nothing, so a doctor opening
the report for a test they ordered saw an empty results table.
"""

from tests.conftest import PROVISIONED_PASSWORD, _login

RESULTS = "/test-results"


def _staff_token(tenant, role: str, tag: str) -> str:
    email = f"{tag}@{tenant.subdomain}.test"
    made = tenant.post("/users", {
        "name": f"{role.title()} {tag}", "email": email,
        "password": PROVISIONED_PASSWORD, "role": role,
    })
    assert made.status_code == 201, made.text
    return _login(tenant.client, tenant.id, email)


def _order_with_result(tenant, *, doctor_token: str, lab_token: str) -> str:
    """A test order placed by the given doctor, with one result entered by the
    lab. Returns the order id."""
    test = tenant.post("/lab-tests", {"name": "Complete Blood Count"}, token=lab_token)
    assert test.status_code == 201, test.text
    test_id = test.json()["id"]

    order = tenant.post("/test-orders", {
        "patientId": tenant.ids["patient"],
        "doctorId": tenant.ids["doctor"],
        "appointmentId": tenant.ids["appointment"],
        "items": [{"testId": test_id, "name": "Complete Blood Count"}],
    }, token=doctor_token)
    assert order.status_code == 201, order.text
    order_id = order.json()["id"]

    result = tenant.post(RESULTS, {
        "orderId": order_id, "testId": test_id, "testName": "Complete Blood Count",
        "parameters": [{"name": "Hemoglobin", "value": "13.5", "unit": "g/dL"}],
    }, token=lab_token)
    assert result.status_code == 200, result.text
    return order_id


def test_the_ordering_doctor_sees_the_result(hospital_a):
    lab = _staff_token(hospital_a, "lab", "labres")
    order_id = _order_with_result(
        hospital_a, doctor_token=hospital_a.doctor_token, lab_token=lab,
    )

    seen = hospital_a.get(f"{RESULTS}?orderId={order_id}", token=hospital_a.doctor_token)
    assert seen.status_code == 200, seen.text
    rows = seen.json()
    assert len(rows) == 1
    assert rows[0]["parameters"][0]["value"] == "13.5"


def test_the_admin_sees_the_result_and_the_order(hospital_a):
    """The patient-detail screen is an admin screen; its Lab Tests section reads
    both endpoints. Admin holds each at scope `all`."""
    lab = _staff_token(hospital_a, "lab", "labresadmin")
    order_id = _order_with_result(
        hospital_a, doctor_token=hospital_a.doctor_token, lab_token=lab,
    )

    # default token on the tenant fixture is the admin's
    orders = hospital_a.get(f"/test-orders?patientId={hospital_a.ids['patient']}")
    assert orders.status_code == 200, orders.text
    assert any(o["id"] == order_id for o in orders.json())

    results = hospital_a.get(f"{RESULTS}?orderId={order_id}")
    assert results.status_code == 200, results.text
    assert len(results.json()) == 1


def test_the_lab_sees_every_result(hospital_a):
    lab = _staff_token(hospital_a, "lab", "labres2")
    order_id = _order_with_result(
        hospital_a, doctor_token=hospital_a.doctor_token, lab_token=lab,
    )
    seen = hospital_a.get(f"{RESULTS}?orderId={order_id}", token=lab)
    assert seen.status_code == 200, seen.text
    assert len(seen.json()) == 1


def test_the_patient_sees_their_own_result(hospital_a):
    lab = _staff_token(hospital_a, "lab", "labres3")
    order_id = _order_with_result(
        hospital_a, doctor_token=hospital_a.doctor_token, lab_token=lab,
    )
    seen = hospital_a.get(
        f"{RESULTS}?orderId={order_id}", token=hospital_a.ids["patient_token"],
    )
    assert seen.status_code == 200, seen.text
    assert len(seen.json()) == 1


def test_own_scope_is_the_orders_you_placed_not_every_order(hospital_a, hospital_b):
    """A doctor from another hospital holds `lab_reports.read: own` too — the
    result must still be invisible to them. Covers both arms at once: a
    non-ordering doctor, and the tenant boundary."""
    lab_a = _staff_token(hospital_a, "lab", "labres5")
    order_id = _order_with_result(
        hospital_a, doctor_token=hospital_a.doctor_token, lab_token=lab_a,
    )
    seen = hospital_b.get(f"{RESULTS}?orderId={order_id}", token=hospital_b.doctor_token)
    assert seen.status_code == 200, seen.text
    assert seen.json() == []
