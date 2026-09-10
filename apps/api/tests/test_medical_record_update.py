"""A clinical note is edited in place, not re-created.

The appointment screen opens the clinical-notes modal on the note already filed
against a visit. Saving it has to update that row — reopening the modal and
saving again must not stack a second record — and only the clinical text is
editable: the patient, doctor and appointment a note belongs to are facts about
the visit, not form fields.
"""

MR = "/medical-records"


def _new_note(tenant, **fields) -> dict:
    body = {
        "patientId": tenant.ids["patient"],
        "doctorId": tenant.ids["doctor"],
        "appointmentId": tenant.ids["appointment"],
        **fields,
    }
    response = tenant.post(MR, body, token=tenant.doctor_token)
    assert response.status_code == 201, response.text
    return response.json()


def test_a_doctor_updates_the_note_on_their_own_visit(hospital_a):
    note = _new_note(hospital_a, diagnosis="Viral pharyngitis", treatmentAdvice="Rest")

    response = hospital_a.put(
        f"{MR}/{note['id']}",
        json={"treatmentAdvice": "Rest, fluids, paracetamol PRN"},
        token=hospital_a.doctor_token,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == note["id"]
    assert body["treatmentAdvice"] == "Rest, fluids, paracetamol PRN"
    # A field left out of the PATCH is untouched, not blanked.
    assert body["diagnosis"] == "Viral pharyngitis"


def test_updating_does_not_create_a_second_row(hospital_a):
    note = _new_note(hospital_a, diagnosis="Sprain")
    before = hospital_a.get(
        f"{MR}?appointmentId={hospital_a.ids['appointment']}",
        token=hospital_a.doctor_token,
    ).json()

    hospital_a.put(
        f"{MR}/{note['id']}",
        json={"followUpAdvice": "Review in a week"},
        token=hospital_a.doctor_token,
    )

    after = hospital_a.get(
        f"{MR}?appointmentId={hospital_a.ids['appointment']}",
        token=hospital_a.doctor_token,
    ).json()
    assert len(after) == len(before)
    edited = next(r for r in after if r["id"] == note["id"])
    assert edited["followUpAdvice"] == "Review in a week"


def test_a_line_the_doctor_clears_is_persisted(hospital_a):
    note = _new_note(hospital_a, diagnosis="Provisional", followUpAdvice="tbd")

    response = hospital_a.put(
        f"{MR}/{note['id']}",
        json={"followUpAdvice": ""},
        token=hospital_a.doctor_token,
    )
    assert response.status_code == 200, response.text
    assert response.json()["followUpAdvice"] == ""


def test_an_admin_cannot_write_clinical_notes(hospital_a):
    note = _new_note(hospital_a, diagnosis="Baseline")
    # Default token is the hospital admin, who holds no medical_records.manage.
    response = hospital_a.put(f"{MR}/{note['id']}", json={"diagnosis": "Edited by admin"})
    assert response.status_code == 403


def test_another_hospitals_note_is_not_found(hospital_a, hospital_b):
    note = _new_note(hospital_a, diagnosis="Alpha only")
    response = hospital_b.put(
        f"{MR}/{note['id']}",
        json={"diagnosis": "Beta reaches in"},
        token=hospital_b.doctor_token,
    )
    # 404, never 403 — a cross-tenant probe learns nothing about the id.
    assert response.status_code == 404


def test_an_unknown_id_is_not_found(hospital_a):
    response = hospital_a.put(
        f"{MR}/med_does_not_exist",
        json={"diagnosis": "x"},
        token=hospital_a.doctor_token,
    )
    assert response.status_code == 404
