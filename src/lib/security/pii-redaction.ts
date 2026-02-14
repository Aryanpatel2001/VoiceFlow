/**
 * PII Redaction Utility
 *
 * Detects and redacts Personally Identifiable Information (PII)
 * from call transcripts and other text content.
 *
 * Supported PII types:
 * - Credit card numbers
 * - Social Security Numbers (SSN)
 * - Phone numbers
 * - Email addresses
 * - Dates of birth
 * - IP addresses
 */

export type PiiType =
  | "credit_card"
  | "ssn"
  | "phone"
  | "email"
  | "dob"
  | "ip_address"
  | "bank_account";

interface PiiMatch {
  type: PiiType;
  original: string;
  redacted: string;
  startIndex: number;
  endIndex: number;
}

interface RedactionResult {
  text: string;
  matches: PiiMatch[];
  hasRedactions: boolean;
}

// Regex patterns for PII detection
const PII_PATTERNS: Record<PiiType, RegExp> = {
  // Credit card: 13-19 digits, possibly with spaces or dashes
  credit_card:
    /\b(?:\d[ -]*?){13,19}\b/g,

  // SSN: XXX-XX-XXXX or XXXXXXXXX
  ssn: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g,

  // Phone numbers: various formats
  phone:
    /\b(?:\+?1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)?[2-9]\d{2}[-.\s]?\d{4}\b/g,

  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Date of birth patterns
  dob: /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g,

  // IP addresses
  ip_address:
    /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

  // Bank account numbers (basic pattern)
  bank_account: /\b\d{8,17}\b/g,
};

// Redaction strings for each type
const REDACTION_STRINGS: Record<PiiType, string> = {
  credit_card: "[CREDIT_CARD_REDACTED]",
  ssn: "[SSN_REDACTED]",
  phone: "[PHONE_REDACTED]",
  email: "[EMAIL_REDACTED]",
  dob: "[DOB_REDACTED]",
  ip_address: "[IP_REDACTED]",
  bank_account: "[ACCOUNT_REDACTED]",
};

/**
 * Validates if a string looks like a real credit card (Luhn check)
 */
function isValidCreditCard(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Validates if a string looks like a real SSN
 */
function isValidSSN(ssn: string): boolean {
  const digits = ssn.replace(/\D/g, "");
  if (digits.length !== 9) return false;

  // SSN cannot start with 000, 666, or 900-999
  const area = parseInt(digits.substring(0, 3), 10);
  if (area === 0 || area === 666 || area >= 900) return false;

  // Group number cannot be 00
  const group = parseInt(digits.substring(3, 5), 10);
  if (group === 0) return false;

  // Serial number cannot be 0000
  const serial = parseInt(digits.substring(5, 9), 10);
  if (serial === 0) return false;

  return true;
}

/**
 * Redact PII from text
 */
export function redactPii(
  text: string,
  options: {
    types?: PiiType[];
    validatePatterns?: boolean;
  } = {}
): RedactionResult {
  const { types = Object.keys(PII_PATTERNS) as PiiType[], validatePatterns = true } =
    options;

  const matches: PiiMatch[] = [];
  let resultText = text;
  let offset = 0;

  for (const type of types) {
    const pattern = PII_PATTERNS[type];
    if (!pattern) continue;

    // Reset regex lastIndex
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const original = match[0];

      // Apply validation for specific types
      if (validatePatterns) {
        if (type === "credit_card" && !isValidCreditCard(original)) continue;
        if (type === "ssn" && !isValidSSN(original)) continue;
        // Skip short numbers that might be false positives for bank accounts
        if (type === "bank_account" && original.replace(/\D/g, "").length < 10) continue;
      }

      const redacted = REDACTION_STRINGS[type];

      matches.push({
        type,
        original,
        redacted,
        startIndex: match.index,
        endIndex: match.index + original.length,
      });
    }
  }

  // Sort matches by start index (descending) to replace from end to start
  matches.sort((a, b) => b.startIndex - a.startIndex);

  // Apply redactions
  for (const match of matches) {
    resultText =
      resultText.substring(0, match.startIndex + offset) +
      match.redacted +
      resultText.substring(match.endIndex + offset);
    offset += match.redacted.length - match.original.length;
  }

  // Re-sort for output
  matches.sort((a, b) => a.startIndex - b.startIndex);

  return {
    text: resultText,
    matches,
    hasRedactions: matches.length > 0,
  };
}

/**
 * Check if text contains PII without redacting
 */
export function containsPii(
  text: string,
  types?: PiiType[]
): { hasPii: boolean; types: PiiType[] } {
  const result = redactPii(text, { types, validatePatterns: true });
  const foundTypes = Array.from(new Set(result.matches.map((m) => m.type)));

  return {
    hasPii: result.hasRedactions,
    types: foundTypes,
  };
}

/**
 * Partially redact PII (show last 4 digits for cards, etc.)
 */
export function partialRedact(text: string, type: PiiType): string {
  const pattern = PII_PATTERNS[type];
  if (!pattern) return text;

  return text.replace(pattern, (match) => {
    const digits = match.replace(/\D/g, "");

    switch (type) {
      case "credit_card":
        return `****-****-****-${digits.slice(-4)}`;
      case "ssn":
        return `***-**-${digits.slice(-4)}`;
      case "phone":
        return `***-***-${digits.slice(-4)}`;
      case "email":
        const [local, domain] = match.split("@");
        return `${local[0]}***@${domain}`;
      default:
        return REDACTION_STRINGS[type];
    }
  });
}
