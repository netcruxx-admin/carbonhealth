import * as Yup from 'yup';

/**
 * Same check the server applies when a login identifier doesn't contain an
 * "@" (see app/identity.py `normalise_phone`) — a bare 10-digit number, or
 * one with a +91/91 prefix, spaced or not, the way people actually type it.
 */
export function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  const withoutPrefix = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
  return withoutPrefix.length === 10;
}

/**
 * Attach to the `email` field of a Yup object schema that also has a `phone`
 * field, on any form where phone is not independently required. An account
 * with neither has no way to sign in (login accepts either — see /auth
 * login) and no way to reset a password, so at least one has to be given
 * even though each is individually optional. Mirrors
 * `_require_email_or_phone` in app/schemas.py.
 */
export function requireEmailOrPhone(email: Yup.StringSchema) {
  return email.test('email-or-phone', 'Enter an email address or a phone number', function (value) {
    return !!(value?.trim() || this.parent.phone?.trim());
  });
}
