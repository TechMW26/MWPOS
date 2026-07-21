const E164_PHONE = /^\+[1-9]\d{7,14}$/;

export function normalizePhoneNumber(value: string, defaultCountryCode = "+91"): string {
  const input = value.trim();
  if (!input) throw new Error("Phone number is required");
  if (!/^[+\d\s().-]+$/.test(input)) throw new Error("Phone number contains invalid characters");

  const digits = input.replace(/\D/g, "");
  let normalized: string;

  if (input.startsWith("+")) {
    normalized = `+${digits}`;
  } else if (defaultCountryCode === "+91" && digits.length === 10) {
    normalized = `+91${digits}`;
  } else if (defaultCountryCode === "+91" && digits.length === 12 && digits.startsWith("91")) {
    normalized = `+${digits}`;
  } else {
    throw new Error("Include a valid country code, for example +91 98765 43210");
  }

  if (!E164_PHONE.test(normalized)) {
    throw new Error("Enter a valid phone number in international format");
  }

  return normalized;
}

export function isValidPhoneNumber(value: string): boolean {
  try {
    normalizePhoneNumber(value);
    return true;
  } catch {
    return false;
  }
}
