#!/usr/bin/env npx ts-node
/**
 * Add Twilio Phone Number to Database
 *
 * Usage:
 *   npx ts-node scripts/add-phone-number.ts +1234567890 [org-id] [flow-id]
 *
 * Examples:
 *   npx ts-node scripts/add-phone-number.ts +18005551234
 *   npx ts-node scripts/add-phone-number.ts +18005551234 org-uuid-here
 *   npx ts-node scripts/add-phone-number.ts +18005551234 org-uuid flow-uuid
 *
 * If org-id is not provided, uses the first organization in the database.
 * If flow-id is provided, assigns the phone number to that flow.
 */

import { Pool } from "pg";
import twilio from "twilio";

// Load environment variables
require("dotenv").config({ path: ".env.local" });

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "voiceflow_pro",
  user: process.env.DB_USER || "postgres",
  ...(process.env.DB_PASSWORD ? { password: process.env.DB_PASSWORD } : {}),
};

interface PhoneNumberInfo {
  number: string;
  countryCode: string;
  providerId: string | null;
  friendlyName: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
}

async function fetchTwilioNumberInfo(
  phoneNumber: string
): Promise<PhoneNumberInfo | null> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.log("⚠️  Twilio credentials not found, using basic info");
    return null;
  }

  try {
    const client = twilio(accountSid, authToken);

    // Fetch incoming phone numbers from Twilio
    const numbers = await client.incomingPhoneNumbers.list({
      phoneNumber: phoneNumber,
    });

    if (numbers.length === 0) {
      console.log("⚠️  Number not found in Twilio account, using basic info");
      return null;
    }

    const num = numbers[0];
    return {
      number: num.phoneNumber,
      countryCode: num.phoneNumber.slice(1, 3) === "1" ? "US" : "INT",
      providerId: num.sid,
      friendlyName: num.friendlyName || phoneNumber,
      capabilities: {
        voice: num.capabilities?.voice || false,
        sms: num.capabilities?.sms || false,
        mms: num.capabilities?.mms || false,
      },
    };
  } catch (error) {
    console.log("⚠️  Could not fetch from Twilio API:", (error as Error).message);
    return null;
  }
}

function parsePhoneNumber(input: string): string {
  // Remove all non-digit characters except leading +
  let number = input.replace(/[^\d+]/g, "");

  // Ensure it starts with +
  if (!number.startsWith("+")) {
    // Assume US if 10 digits
    if (number.length === 10) {
      number = "+1" + number;
    } else if (number.length === 11 && number.startsWith("1")) {
      number = "+" + number;
    } else {
      number = "+" + number;
    }
  }

  return number;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
📞 Add Twilio Phone Number to Database

Usage:
  npx ts-node scripts/add-phone-number.ts <phone-number> [org-id] [flow-id]

Arguments:
  phone-number  The Twilio phone number (e.g., +18005551234)
  org-id        Optional: Organization UUID (uses first org if not provided)
  flow-id       Optional: Flow UUID to assign the number to

Examples:
  npx ts-node scripts/add-phone-number.ts +18005551234
  npx ts-node scripts/add-phone-number.ts "(800) 555-1234" my-org-uuid
  npx ts-node scripts/add-phone-number.ts +18005551234 org-uuid flow-uuid
`);
    process.exit(1);
  }

  const phoneNumber = parsePhoneNumber(args[0]);
  const orgIdArg = args[1];
  const flowIdArg = args[2];

  console.log(`\n📞 Adding phone number: ${phoneNumber}\n`);

  // Connect to database
  const pool = new Pool(dbConfig);

  try {
    // Test connection
    await pool.query("SELECT 1");
    console.log("✅ Database connected");

    // Get organization ID
    let organizationId: string;

    if (orgIdArg) {
      // Verify org exists
      const orgResult = await pool.query(
        "SELECT id, name FROM organizations WHERE id = $1",
        [orgIdArg]
      );
      if (orgResult.rows.length === 0) {
        console.error(`❌ Organization not found: ${orgIdArg}`);
        process.exit(1);
      }
      organizationId = orgResult.rows[0].id;
      console.log(`✅ Using organization: ${orgResult.rows[0].name}`);
    } else {
      // Use first organization
      const orgResult = await pool.query(
        "SELECT id, name FROM organizations ORDER BY created_at LIMIT 1"
      );
      if (orgResult.rows.length === 0) {
        console.error("❌ No organizations found in database");
        console.log("   Create an organization first by signing up in the app");
        process.exit(1);
      }
      organizationId = orgResult.rows[0].id;
      console.log(`✅ Using organization: ${orgResult.rows[0].name} (first in DB)`);
    }

    // Verify flow exists if provided
    let flowId: string | null = null;
    if (flowIdArg) {
      const flowResult = await pool.query(
        "SELECT id, name FROM flows WHERE id = $1",
        [flowIdArg]
      );
      if (flowResult.rows.length === 0) {
        console.error(`❌ Flow not found: ${flowIdArg}`);
        process.exit(1);
      }
      flowId = flowResult.rows[0].id;
      console.log(`✅ Will assign to flow: ${flowResult.rows[0].name}`);
    }

    // Check if number already exists
    const existingResult = await pool.query(
      "SELECT id FROM phone_numbers WHERE number = $1",
      [phoneNumber]
    );
    if (existingResult.rows.length > 0) {
      console.log(`⚠️  Phone number already exists in database`);

      // Update flow assignment if provided
      if (flowId) {
        await pool.query(
          "UPDATE phone_numbers SET assigned_flow_id = $1, updated_at = NOW() WHERE number = $2",
          [flowId, phoneNumber]
        );
        console.log(`✅ Updated flow assignment`);
      }

      console.log(`\n📞 Phone number ID: ${existingResult.rows[0].id}`);
      process.exit(0);
    }

    // Fetch info from Twilio API
    console.log("\n🔍 Fetching number info from Twilio...");
    const twilioInfo = await fetchTwilioNumberInfo(phoneNumber);

    // Prepare insert data
    const countryCode = twilioInfo?.countryCode || (phoneNumber.startsWith("+1") ? "US" : "INT");
    const providerId = twilioInfo?.providerId || null;
    const friendlyName = twilioInfo?.friendlyName || phoneNumber;
    const capabilities = twilioInfo?.capabilities || { voice: true, sms: true, mms: false };

    // Insert into database
    const insertResult = await pool.query(
      `INSERT INTO phone_numbers (
        organization_id,
        number,
        country_code,
        provider,
        provider_id,
        friendly_name,
        capabilities,
        status,
        assigned_flow_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        organizationId,
        phoneNumber,
        countryCode,
        "twilio",
        providerId,
        friendlyName,
        JSON.stringify(capabilities),
        "active",
        flowId,
      ]
    );

    const newId = insertResult.rows[0].id;

    console.log(`\n✅ Phone number added successfully!`);
    console.log(`\n📋 Details:`);
    console.log(`   ID:           ${newId}`);
    console.log(`   Number:       ${phoneNumber}`);
    console.log(`   Country:      ${countryCode}`);
    console.log(`   Provider:     twilio`);
    console.log(`   Provider ID:  ${providerId || "(not linked)"}`);
    console.log(`   Capabilities: ${JSON.stringify(capabilities)}`);
    console.log(`   Flow:         ${flowId || "(not assigned)"}`);

    if (!flowId) {
      console.log(`\n💡 To assign a flow, run:`);
      console.log(`   npx ts-node scripts/add-phone-number.ts ${phoneNumber} ${organizationId} <flow-id>`);
    }

    console.log(`\n🎉 Done!\n`);
  } catch (error) {
    console.error("\n❌ Error:", (error as Error).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
