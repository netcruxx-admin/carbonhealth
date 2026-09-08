"""A consultation costs what the hospital says it costs.

Pricing used to sit on the doctor, which meant the number came from whichever
doctor was booked. It now sits on the hospital's fee schedule, keyed by the kind
of visit, and these tests hold the two properties that made the move worth
doing: the price is per hospital (so one tenant cannot read or move another's),
and it is the server's to decide (so a client naming a visit type cannot name
its price too).
"""

from tests.conftest import _superadmin_token

FEES = "/consultation-fees"


def _superadmin(client, hospital_id: str) -> dict:
    """The platform, acting on one named hospital.

    A superadmin has no home tenant, so every request has to say which
    hospital's price list it means — that header is the whole difference
    between the two holders of `fees.manage`.
    """
    return {
        "Authorization": f"Bearer {_superadmin_token(client)}",
        "X-Hospital-Id": hospital_id,
    }


def _fee(tenant, visit_type: str) -> dict:
    rows = tenant.get(f"{FEES}?includeInactive=true").json()
    return next(row for row in rows if row["visitType"] == visit_type)


def test_a_new_hospital_starts_with_the_standard_visit_types(hospital_a):
    """Provisioning seeds the schedule so an admin edits amounts, not structure."""
    rows = hospital_a.get(FEES).json()
    assert {row["visitType"] for row in rows} >= {"new", "follow_up", "emergency"}


def test_the_seeded_amounts_are_zero_rather_than_invented(hospital_a):
    """A price nobody chose is worse than no price: fee_for refuses a zero, so
    the hospital is asked to set one instead of silently billing a guess.

    Scoped to the seeded types on purpose. The claim is about what provisioning
    does, not about the whole list — another test adding a priced visit type of
    its own must not read as provisioning having invented a price."""
    seeded = {"new", "follow_up", "emergency"}
    rows = [r for r in hospital_a.get(FEES).json() if r["visitType"] in seeded]
    assert len(rows) == len(seeded)
    assert all(row["amount"] == 0 for row in rows)


def test_an_admin_sets_the_price(hospital_a):
    fee = _fee(hospital_a, "new")
    response = hospital_a.put(f"{FEES}/{fee['id']}", json={"amount": 600})
    assert response.status_code == 200, response.text
    assert response.json()["amount"] == 600


def test_a_doctor_may_read_the_price_but_not_set_it(hospital_a):
    """`fees.read` is wide because a price has to be quotable at the desk and by
    the patient; `fees.manage` is the hospital admin's."""
    token = hospital_a.doctor_token
    assert hospital_a.get(FEES, token=token).status_code == 200

    fee = _fee(hospital_a, "new")
    refused = hospital_a.put(f"{FEES}/{fee['id']}", json={"amount": 1}, token=token)
    assert refused.status_code == 403, refused.text


def test_a_patient_can_see_what_a_visit_costs(hospital_a):
    """A price the patient cannot see is a price they cannot agree to pay."""
    token = hospital_a.ids["patient_token"]
    assert hospital_a.get(FEES, token=token).status_code == 200


def test_one_hospitals_prices_are_invisible_to_another(hospital_a, hospital_b):
    a_ids = {row["id"] for row in hospital_a.get(FEES).json()}
    b_ids = {row["id"] for row in hospital_b.get(FEES).json()}
    assert a_ids and b_ids
    assert a_ids.isdisjoint(b_ids)


def test_one_hospital_cannot_edit_anothers_price(hospital_a, hospital_b):
    """A row that is not yours reads as absent — 404, never 403, which would
    confirm the id exists."""
    theirs = _fee(hospital_b, "new")
    response = hospital_a.put(f"{FEES}/{theirs['id']}", json={"amount": 1})
    assert response.status_code == 404, response.text


def test_a_negative_price_is_refused(hospital_a):
    fee = _fee(hospital_a, "new")
    assert hospital_a.put(f"{FEES}/{fee['id']}", json={"amount": -10}).status_code == 422


def test_renaming_a_price_keeps_its_key(hospital_a):
    """`visit_type` is what appointments recorded; relabelling is cosmetic and
    must not rewrite what a past visit was billed as."""
    fee = _fee(hospital_a, "follow_up")
    response = hospital_a.put(f"{FEES}/{fee['id']}", json={"label": "Review visit"})
    assert response.status_code == 200, response.text
    assert response.json()["visitType"] == "follow_up"
    assert response.json()["label"] == "Review visit"


def test_a_new_visit_type_gets_a_key_from_its_label(hospital_a):
    response = hospital_a.post(FEES, json={"label": "Health Check", "amount": 250})
    assert response.status_code == 201, response.text
    assert response.json()["visitType"] == "health_check"


def test_the_same_visit_type_cannot_be_priced_twice(hospital_a):
    hospital_a.post(FEES, json={"label": "Vaccination", "amount": 100})
    again = hospital_a.post(FEES, json={"label": "Vaccination", "amount": 900})
    assert again.status_code == 409, again.text


# ---------------------------------------------------------------------------
# Who sets the price
# ---------------------------------------------------------------------------
#
# `fees.manage` is held by two roles for two different reasons. The hospital
# admin holds it because what to charge is their business decision — unlike
# `departments.manage` or `hospital.settings.manage`, which reach provisioning
# and stayed with the platform. The superadmin holds it to do the same job on
# a hospital's behalf while onboarding one, which is why these tests care that
# the platform's edit lands in the hospital it named and nowhere else.


def test_the_platform_can_price_a_hospital_it_names(client, hospital_a):
    fee = _fee(hospital_a, "new")
    response = client.put(
        f"{FEES}/{fee['id']}",
        headers=_superadmin(client, hospital_a.id),
        json={"amount": 850},
    )
    assert response.status_code == 200, response.text
    assert response.json()["amount"] == 850
    # And the hospital sees it, because it is their row that changed.
    assert _fee(hospital_a, "new")["amount"] == 850


def test_the_platform_can_add_and_retire_a_visit_type(client, hospital_a):
    headers = _superadmin(client, hospital_a.id)

    created = client.post(
        FEES, headers=headers, json={"label": "Platform Set Checkup", "amount": 400}
    )
    assert created.status_code == 201, created.text
    fee_id = created.json()["id"]
    assert created.json()["visitType"] == "platform_set_checkup"

    retired = client.delete(f"{FEES}/{fee_id}", headers=headers)
    assert retired.status_code == 204, retired.text
    assert all(row["id"] != fee_id for row in hospital_a.get(f"{FEES}?includeInactive=true").json())


def test_the_platforms_edit_lands_in_the_hospital_it_named(client, hospital_a, hospital_b):
    """The header picks the tenant. Priced for one hospital, unchanged in the
    other — a superadmin editing "the" fee schedule would otherwise be editing
    whichever tenant happened to answer."""
    a_fee = _fee(hospital_a, "emergency")
    b_before = _fee(hospital_b, "emergency")["amount"]

    response = client.put(
        f"{FEES}/{a_fee['id']}",
        headers=_superadmin(client, hospital_a.id),
        json={"amount": 1500},
    )
    assert response.status_code == 200, response.text

    assert _fee(hospital_a, "emergency")["amount"] == 1500
    assert _fee(hospital_b, "emergency")["amount"] == b_before


def test_the_platform_cannot_reach_a_row_through_the_wrong_hospital(client, hospital_a, hospital_b):
    """Naming hospital B does not open hospital A's price list, even for the
    platform: `scoped()` still decides, and a row outside it reads as absent."""
    a_fee = _fee(hospital_a, "new")
    response = client.put(
        f"{FEES}/{a_fee['id']}",
        headers=_superadmin(client, hospital_b.id),
        json={"amount": 1},
    )
    assert response.status_code == 404, response.text


def test_a_receptionist_quotes_the_price_but_does_not_set_it(client, hospital_a):
    """The front desk reads the schedule on every booking screen. Changing what
    the hospital charges is not a front-desk decision."""
    fee = _fee(hospital_a, "new")
    token = hospital_a.nurse_token  # holds fees.read, not fees.manage
    assert hospital_a.get(FEES, token=token).status_code == 200
    refused = hospital_a.put(f"{FEES}/{fee['id']}", json={"amount": 5}, token=token)
    assert refused.status_code == 403, refused.text
