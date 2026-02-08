/**
 * CSV Parser for Campaign Contacts
 *
 * Parses CSV files containing contact information for campaigns.
 * Required column: phone_number (or phone/phonenumber)
 * Optional columns: first_name, last_name, email, [any custom fields]
 *
 * @module lib/campaign/csv-parser
 */

export interface ParsedContact {
  phoneNumber: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  customData: Record<string, unknown>;
}

export interface ParseResult {
  contacts: ParsedContact[];
  errors: Array<{ row: number; message: string }>;
  totalRows: number;
  validRows: number;
}

/**
 * Parse CSV content into contacts
 * Flexible parsing - auto-detects phone column by header name OR by data pattern
 */
export function parseContactsCsv(csvContent: string): ParseResult {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      contacts: [],
      errors: [{ row: 0, message: "Empty CSV file" }],
      totalRows: 0,
      validRows: 0,
    };
  }

  // Detect and skip title rows - if first line has no commas (single value),
  // it's likely a title/label, not a header row
  let headerLineIndex = 0;
  while (headerLineIndex < lines.length - 1) {
    const parsed = parseCSVLine(lines[headerLineIndex]);
    if (parsed.length > 1) break; // Multiple columns = likely a header
    // Single column that doesn't look like a header - skip it
    console.log(`[CSV Parser] Skipping title row: "${lines[headerLineIndex]}"`);
    headerLineIndex++;
  }

  // Parse header row
  const headers = parseCSVLine(lines[headerLineIndex]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_")
  );

  // Flexible phone column detection - accept many variations
  const phoneHeaderPatterns = [
    "phone_number", "phone", "phonenumber", "phone_no", "phone_num",
    "mobile", "mobile_number", "mobilenumber", "mobile_no", "mobile_phone",
    "cell", "cell_number", "cellphone", "cell_phone",
    "telephone", "tel", "tel_number", "contact", "contact_number",
    "number", "no", "ph", "mob"
  ];

  let phoneIndex = headers.findIndex((h) =>
    phoneHeaderPatterns.some(pattern => h === pattern || h.includes(pattern))
  );

  const dataStartIndex = headerLineIndex + 1;

  // If no header match, try to detect by looking at data in first data row
  if (phoneIndex === -1 && lines.length > dataStartIndex) {
    const firstDataRow = parseCSVLine(lines[dataStartIndex]);
    phoneIndex = firstDataRow.findIndex((val) => looksLikePhoneNumber(val));

    if (phoneIndex !== -1) {
      console.log(`[CSV Parser] Auto-detected phone column at index ${phoneIndex} by data pattern`);
    }
  }

  if (phoneIndex === -1) {
    return {
      contacts: [],
      errors: [
        {
          row: 1,
          message:
            'Could not find phone number column. Add a header like "phone" or "mobile", or ensure phone numbers are in a recognizable format.',
        },
      ],
      totalRows: lines.length - dataStartIndex,
      validRows: 0,
    };
  }

  // Flexible name column detection
  const firstNamePatterns = ["first_name", "firstname", "first", "fname", "given_name", "givenname"];
  const lastNamePatterns = ["last_name", "lastname", "last", "lname", "surname", "family_name"];
  const namePatterns = ["name", "full_name", "fullname", "contact_name"];
  const emailPatterns = ["email", "e_mail", "email_address", "mail"];

  const firstNameIndex = headers.findIndex((h) =>
    firstNamePatterns.some(p => h === p || h.includes(p))
  );
  const lastNameIndex = headers.findIndex((h) =>
    lastNamePatterns.some(p => h === p || h.includes(p))
  );
  const fullNameIndex = headers.findIndex((h) =>
    namePatterns.some(p => h === p) && !firstNamePatterns.some(p => h.includes(p)) && !lastNamePatterns.some(p => h.includes(p))
  );
  const emailIndex = headers.findIndex((h) =>
    emailPatterns.some(p => h === p || h.includes(p))
  );

  // Everything else is custom data
  const standardIndices = new Set([
    phoneIndex,
    firstNameIndex,
    lastNameIndex,
    fullNameIndex,
    emailIndex,
  ]);
  const customIndices = headers
    .map((header, index) => ({ header, index }))
    .filter(({ index }) => !standardIndices.has(index) && index >= 0);

  const contacts: ParsedContact[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  // Parse data rows (start after header)
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i];
    const values = parseCSVLine(line);
    const rowNum = i + 1;

    // Get and normalize phone number
    const rawPhone = values[phoneIndex]?.trim() || "";
    if (!rawPhone) {
      errors.push({ row: rowNum, message: "Missing phone number" });
      continue;
    }

    const phoneNumber = normalizePhoneNumber(rawPhone);
    if (!isValidPhoneNumber(phoneNumber)) {
      errors.push({
        row: rowNum,
        message: `Invalid phone number: ${rawPhone}`,
      });
      continue;
    }

    const contact: ParsedContact = {
      phoneNumber,
      customData: {},
    };

    // Add optional standard fields
    if (firstNameIndex >= 0 && values[firstNameIndex]) {
      contact.firstName = values[firstNameIndex].trim();
    }
    if (lastNameIndex >= 0 && values[lastNameIndex]) {
      contact.lastName = values[lastNameIndex].trim();
    }
    // Handle full name column - split into first/last
    if (!contact.firstName && !contact.lastName && fullNameIndex >= 0 && values[fullNameIndex]) {
      const fullName = values[fullNameIndex].trim();
      const nameParts = fullName.split(/\s+/);
      if (nameParts.length >= 2) {
        contact.firstName = nameParts[0];
        contact.lastName = nameParts.slice(1).join(" ");
      } else {
        contact.firstName = fullName;
      }
    }
    if (emailIndex >= 0 && values[emailIndex]) {
      const email = values[emailIndex].trim();
      if (isValidEmail(email)) {
        contact.email = email;
      }
    }

    // Add custom fields
    for (const { header, index } of customIndices) {
      const value = values[index]?.trim();
      if (value) {
        contact.customData[header] = value;
      }
    }

    contacts.push(contact);
  }

  return {
    contacts,
    errors,
    totalRows: lines.length - dataStartIndex,
    validRows: contacts.length,
  };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (char === '"') {
        // End of quoted section
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted section
        inQuotes = true;
      } else if (char === ",") {
        // Field separator
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
}

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX for US)
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  const hasPlus = phone.startsWith("+");
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    // US number without country code
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    // US number with country code
    return `+${digits}`;
  }

  // International number
  if (hasPlus) {
    return `+${digits}`;
  }

  // Assume US if we have 10+ digits
  if (digits.length >= 10) {
    return `+${digits}`;
  }

  // Return as-is if too short
  return digits;
}

/**
 * Validate phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  // Must start with + and have at least 10 digits
  if (!phone.startsWith("+")) return false;

  const digits = phone.slice(1);
  if (!/^\d+$/.test(digits)) return false;
  if (digits.length < 10 || digits.length > 15) return false;

  return true;
}

/**
 * Check if a string value looks like a phone number
 * Used for auto-detecting the phone column when headers don't match
 */
function looksLikePhoneNumber(value: string): boolean {
  if (!value) return false;
  const cleaned = value.trim();
  // Check if it starts with + or has mostly digits
  if (cleaned.startsWith("+") && cleaned.replace(/\D/g, "").length >= 10) return true;
  // Check for patterns like (XXX) XXX-XXXX, XXX-XXX-XXXX, XXX.XXX.XXXX
  const digitsOnly = cleaned.replace(/\D/g, "");
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    // Must be at least 60% digits to look like a phone number
    const digitRatio = digitsOnly.length / cleaned.length;
    return digitRatio > 0.6;
  }
  return false;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate a sample CSV template
 */
export function generateCsvTemplate(): string {
  return `phone_number,first_name,last_name,email,company
+12025551234,John,Doe,john@example.com,Acme Inc
+12025555678,Jane,Smith,jane@example.com,Widget Co`;
}
