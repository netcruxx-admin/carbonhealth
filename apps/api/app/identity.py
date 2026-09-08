"""Identity numbers on a patient record, and what makes one valid.

A hospital collects an Aadhaar number for one operational reason: to know that
the person at the desk today is the same person as a record from two years ago.
That only works if the number is *right*, so this module refuses one that
cannot exist rather than storing a typo that will silently fail to match later.

Aadhaar carries a Verhoeff check digit precisely so a mistyped number can be
caught without asking UIDAI. Checking it here is not verification — it does not
prove the number belongs to the person, and nothing in this codebase claims it
does. It proves the number was transcribed correctly, which is the difference
between a duplicate record found and a duplicate record created.

Storage note: the number is held as the twelve digits, tenant-scoped and behind
`patients.read` like the rest of the record. If this deployment later needs to
show only the last four (Aadhaar Act s.29 and the UIDAI masking guidance), the
place to do it is `PatientOut`, so the mask applies to every reader at once.
"""

from __future__ import annotations

# Verhoeff's dihedral group D5 multiplication table.
_D = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 2, 3, 4, 0, 6, 7, 8, 9, 5),
    (2, 3, 4, 0, 1, 7, 8, 9, 5, 6),
    (3, 4, 0, 1, 2, 8, 9, 5, 6, 7),
    (4, 0, 1, 2, 3, 9, 5, 6, 7, 8),
    (5, 9, 8, 7, 6, 0, 4, 3, 2, 1),
    (6, 5, 9, 8, 7, 1, 0, 4, 3, 2),
    (7, 6, 5, 9, 8, 2, 1, 0, 4, 3),
    (8, 7, 6, 5, 9, 3, 2, 1, 0, 4),
    (9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
)

# The permutation applied per position.
_P = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 5, 7, 6, 2, 8, 3, 0, 9, 4),
    (5, 8, 0, 3, 7, 9, 6, 1, 4, 2),
    (8, 9, 1, 6, 0, 4, 3, 5, 2, 7),
    (9, 4, 5, 3, 1, 2, 6, 8, 7, 0),
    (4, 2, 8, 6, 5, 7, 3, 9, 0, 1),
    (2, 7, 9, 3, 8, 0, 6, 4, 1, 5),
    (7, 0, 4, 6, 9, 1, 3, 2, 5, 8),
)


def verhoeff_ok(digits: str) -> bool:
    """True when `digits` carries a valid trailing Verhoeff check digit."""
    checksum = 0
    for position, digit in enumerate(reversed(digits)):
        checksum = _D[checksum][_P[position % 8][int(digit)]]
    return checksum == 0


def normalise_aadhaar(value: str) -> str:
    """The twelve digits, or a ValueError naming what is wrong with them.

    Accepts the spaced and hyphenated forms people copy off the card
    ("1234 5678 9012"), because rejecting a correct number over its spacing
    teaches the desk to work around the field rather than fill it in.
    """
    digits = "".join(ch for ch in value if not ch.isspace() and ch != "-")
    if not digits:
        return ""
    if not digits.isdigit():
        raise ValueError("Aadhaar number must be 12 digits")
    if len(digits) != 12:
        raise ValueError("Aadhaar number must be exactly 12 digits")
    # UIDAI never issues a number beginning 0 or 1, which is what makes
    # sequences like 111111111111 detectable as nonsense rather than plausible.
    if digits[0] in "01":
        raise ValueError("Aadhaar number cannot start with 0 or 1")
    if not verhoeff_ok(digits):
        raise ValueError("That Aadhaar number is not valid — please re-check it")
    return digits


def mask_aadhaar(digits: str) -> str:
    """"XXXX XXXX 9012" — for anywhere the full number does not belong."""
    if len(digits) != 12:
        return ""
    return f"XXXX XXXX {digits[-4:]}"


def normalise_pincode(value: str) -> str:
    """Six digits, or a ValueError. Indian PIN codes never start with 0."""
    digits = value.strip()
    if not digits:
        return ""
    if not digits.isdigit() or len(digits) != 6:
        raise ValueError("PIN code must be 6 digits")
    if digits[0] == "0":
        raise ValueError("PIN code cannot start with 0")
    return digits
