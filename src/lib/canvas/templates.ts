/**
 * Flow Templates
 *
 * Pre-built conversation flow templates for different industries.
 * Uses the new 6-node system: start, conversation, function, call_transfer, set_variable, end
 *
 * @module lib/canvas/templates
 */

import type { FlowTemplate, FlowNode, FlowEdge, FlowVariable, FlowSettings } from "./types";
import { getDefaultConfig } from "./node-configs";

// ============================================
// Default Settings
// ============================================

const DEFAULT_SETTINGS: FlowSettings = {
  defaultVoice: "21m00Tcm4TlvDq8ikWAM", // Rachel
  language: "en-US",
  timeout: 30000,
  maxTurns: 20,
  recordCalls: true,
  transcribeCalls: true,
};

// ============================================
// Helper Functions
// ============================================

function createNode(
  id: string,
  type: FlowNode["type"],
  label: string,
  position: { x: number; y: number },
  configOverrides?: Partial<FlowNode["data"]["config"]>
): FlowNode {
  return {
    id,
    type,
    position,
    data: {
      label,
      config: {
        ...getDefaultConfig(type),
        ...configOverrides,
      },
    },
  };
}

function createEdge(
  source: string,
  target: string,
  sourceHandle = "default",
  label?: string
): FlowEdge {
  return {
    id: `${source}-${target}-${sourceHandle}`,
    source,
    target,
    sourceHandle,
    label,
  };
}

// ============================================
// Home Services Booking Template
// ============================================

const homeServicesNodes: FlowNode[] = [
  createNode("start", "start", "Start", { x: 250, y: 0 }, {
    speaksFirst: true,
    greeting: {
      mode: "static",
      content: "Thank you for calling ABC Home Services. How can I help you today?",
    },
  }),
  createNode("collect_service", "conversation", "Collect Service Type", { x: 250, y: 140 }, {
    content: {
      mode: "prompt",
      content: `You are a friendly receptionist for a home services company (HVAC, plumbing, electrical).
Ask what service the customer needs. Be warm and professional.
If they mention an emergency, acknowledge the urgency.`,
    },
    transitions: [
      { id: "t_emergency", type: "prompt", condition: "Customer describes an emergency or urgent issue", handle: "t_emergency", label: "Emergency" },
      { id: "t_service_identified", type: "prompt", condition: "Customer has clearly stated what service they need", handle: "t_service_identified", label: "Service Identified" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
  }),
  createNode("emergency_transfer", "call_transfer", "Emergency Transfer", { x: 0, y: 320 }, {
    destination: "+15551234567",
    transferType: "warm",
  }),
  createNode("collect_info", "conversation", "Collect Customer Info", { x: 300, y: 320 }, {
    content: {
      mode: "prompt",
      content: `You are scheduling a service appointment. Collect:
1. Customer name
2. Address
3. Phone number
4. Preferred date/time
5. Brief description of the issue

Be conversational and helpful. Confirm details before proceeding.`,
    },
    transitions: [
      { id: "t_info_complete", type: "prompt", condition: "All required information has been collected and confirmed", handle: "t_info_complete", label: "Info Complete" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 250,
  }),
  createNode("check_availability", "function", "Check Availability", { x: 300, y: 500 }, {
    executionType: "http",
    method: "POST",
    url: "{{api_base_url}}/availability",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service: "{{service_type}}",
      date: "{{preferred_time}}",
      address: "{{address}}",
    }),
    responseMapping: [
      { id: "m1", variable: "available_slots", path: "$.slots" },
      { id: "m2", variable: "technician_name", path: "$.technician" },
    ],
    speakDuringExecution: { mode: "static", content: "Let me check our schedule for you..." },
    waitForResult: true,
    timeout: 10000,
    transitions: [
      { id: "t_avail_success", type: "equation", condition: "{{_function_success}} == true", handle: "t_avail_success", label: "Available" },
      { id: "t_avail_error", type: "equation", condition: "{{_function_success}} == false", handle: "t_avail_error", label: "Error" },
    ],
  }),
  createNode("confirm_booking", "conversation", "Confirm Booking", { x: 200, y: 680 }, {
    content: {
      mode: "static",
      content: "Great! I have you scheduled. {{technician_name}} will be your technician. Is there anything else I can help you with?",
    },
    transitions: [
      { id: "t_done", type: "prompt", condition: "Customer confirms or says no more questions", handle: "t_done", label: "Done" },
    ],
  }),
  createNode("api_error_msg", "conversation", "API Error", { x: 450, y: 680 }, {
    content: {
      mode: "static",
      content: "I apologize, I'm having trouble checking our schedule. Let me connect you with our scheduling team.",
    },
    skipResponse: true,
    transitions: [],
  }),
  createNode("transfer_human", "call_transfer", "Transfer to Scheduling", { x: 450, y: 830 }, {
    destination: "+15559876543",
    transferType: "cold",
  }),
  createNode("end_success", "end", "End Call", { x: 200, y: 830 }, {
    speakDuringExecution: {
      mode: "static",
      content: "Thank you for choosing ABC Home Services. We'll see you soon. Have a great day!",
    },
    reason: "completed",
  }),
];

const homeServicesEdges: FlowEdge[] = [
  createEdge("start", "collect_service"),
  createEdge("collect_service", "emergency_transfer", "t_emergency", "Emergency"),
  createEdge("collect_service", "collect_info", "t_service_identified", "Service Identified"),
  createEdge("collect_info", "check_availability", "t_info_complete", "Info Complete"),
  createEdge("check_availability", "confirm_booking", "t_avail_success", "Available"),
  createEdge("check_availability", "api_error_msg", "t_avail_error", "Error"),
  createEdge("confirm_booking", "end_success", "t_done", "Done"),
  createEdge("api_error_msg", "transfer_human"),
];

const homeServicesVariables: FlowVariable[] = [
  { id: "v1", name: "service_type", type: "string", description: "Type of service requested" },
  { id: "v2", name: "customer_name", type: "string", description: "Customer's full name" },
  { id: "v3", name: "address", type: "string", description: "Service address" },
  { id: "v4", name: "phone", type: "string", description: "Customer phone number" },
  { id: "v5", name: "preferred_time", type: "string", description: "Preferred appointment time" },
  { id: "v6", name: "available_slots", type: "array", description: "Available appointment slots" },
  { id: "v7", name: "technician_name", type: "string", description: "Assigned technician name" },
  { id: "v8", name: "api_base_url", type: "string", defaultValue: "https://api.example.com", description: "API base URL" },
];

// ============================================
// Real Estate Inquiry Template
// ============================================

const realEstateNodes: FlowNode[] = [
  createNode("start", "start", "Start", { x: 250, y: 0 }, {
    speaksFirst: true,
    greeting: {
      mode: "static",
      content: "Hi, thank you for calling Premier Realty. I'm your AI assistant. Are you looking to buy, sell, or rent a property?",
    },
  }),
  createNode("qualify", "conversation", "Qualify Intent", { x: 250, y: 140 }, {
    content: {
      mode: "prompt",
      content: `You are a real estate assistant. Determine if the caller wants to buy, sell, or rent a property.
Ask clarifying questions and collect their preferences:
- For buyers: property type, location, budget, bedrooms, timeline
- For sellers: property address, reason for selling, timeline
- For renters: location, budget, move-in date, bedrooms, pets

Be friendly and professional.`,
    },
    transitions: [
      { id: "t_buy", type: "prompt", condition: "Caller wants to buy a property and has provided basic preferences", handle: "t_buy", label: "Buyer" },
      { id: "t_sell", type: "prompt", condition: "Caller wants to sell their property", handle: "t_sell", label: "Seller" },
      { id: "t_rent", type: "prompt", condition: "Caller is looking to rent a property and has provided preferences", handle: "t_rent", label: "Renter" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 250,
  }),
  createNode("search_listings", "function", "Search Listings", { x: 100, y: 360 }, {
    executionType: "http",
    method: "POST",
    url: "{{api_base_url}}/listings/search",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "{{property_type}}",
      location: "{{location}}",
      budget: "{{budget}}",
    }),
    responseMapping: [
      { id: "m1", variable: "matching_listings", path: "$.listings" },
      { id: "m2", variable: "listing_count", path: "$.count" },
    ],
    speakDuringExecution: { mode: "static", content: "Let me search our listings for you..." },
    waitForResult: true,
    timeout: 10000,
    transitions: [
      { id: "t_found", type: "equation", condition: "{{listing_count}} > 0", handle: "t_found", label: "Found" },
      { id: "t_none", type: "equation", condition: "{{listing_count}} == 0", handle: "t_none", label: "No Results" },
    ],
  }),
  createNode("present_options", "conversation", "Present Listings", { x: 0, y: 540 }, {
    content: {
      mode: "prompt",
      content: `Present the matching property listings to the caller. Mention the top 2-3 options with address, type, and price.
Ask if they'd like to schedule a showing for any of them.`,
    },
    transitions: [
      { id: "t_showing", type: "prompt", condition: "Caller wants to schedule a showing or learn more about a property", handle: "t_showing", label: "Schedule Showing" },
      { id: "t_agent", type: "prompt", condition: "Caller wants to speak with a human agent", handle: "t_agent", label: "Transfer" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 300,
  }),
  createNode("no_matches", "conversation", "No Matches", { x: 250, y: 540 }, {
    content: {
      mode: "static",
      content: "I don't have exact matches right now, but new listings come in daily. Would you like me to have an agent call you when something matches your criteria?",
    },
    transitions: [
      { id: "t_callback", type: "prompt", condition: "Caller agrees to get a callback", handle: "t_callback", label: "Callback" },
      { id: "t_no", type: "prompt", condition: "Caller declines", handle: "t_no", label: "No Thanks" },
    ],
  }),
  createNode("schedule_showing", "conversation", "Schedule Showing", { x: 0, y: 720 }, {
    content: {
      mode: "prompt",
      content: "Help schedule a property showing. Collect their full name, phone number, and preferred times. Confirm the details.",
    },
    transitions: [
      { id: "t_confirmed", type: "prompt", condition: "Showing has been scheduled and confirmed", handle: "t_confirmed", label: "Confirmed" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
  }),
  createNode("transfer_seller", "call_transfer", "Transfer to Agent", { x: 350, y: 360 }, {
    destination: "+15551112222",
    transferType: "warm",
  }),
  createNode("transfer_agent", "call_transfer", "Transfer to Agent", { x: 300, y: 720 }, {
    destination: "+15551112222",
    transferType: "cold",
  }),
  createNode("end_call", "end", "End Call", { x: 100, y: 880 }, {
    speakDuringExecution: {
      mode: "static",
      content: "Thank you for calling Premier Realty. An agent will contact you shortly. Have a great day!",
    },
    reason: "completed",
  }),
];

const realEstateEdges: FlowEdge[] = [
  createEdge("start", "qualify"),
  createEdge("qualify", "search_listings", "t_buy", "Buyer"),
  createEdge("qualify", "transfer_seller", "t_sell", "Seller"),
  createEdge("qualify", "search_listings", "t_rent", "Renter"),
  createEdge("search_listings", "present_options", "t_found", "Found"),
  createEdge("search_listings", "no_matches", "t_none", "No Results"),
  createEdge("present_options", "schedule_showing", "t_showing", "Showing"),
  createEdge("present_options", "transfer_agent", "t_agent", "Transfer"),
  createEdge("no_matches", "transfer_agent", "t_callback", "Callback"),
  createEdge("no_matches", "end_call", "t_no", "No Thanks"),
  createEdge("schedule_showing", "end_call", "t_confirmed", "Confirmed"),
];

const realEstateVariables: FlowVariable[] = [
  { id: "v1", name: "property_type", type: "string", description: "Type of property" },
  { id: "v2", name: "location", type: "string", description: "Preferred location" },
  { id: "v3", name: "budget", type: "string", description: "Budget range" },
  { id: "v4", name: "bedrooms", type: "number", description: "Number of bedrooms" },
  { id: "v5", name: "matching_listings", type: "array", description: "Matching property listings" },
  { id: "v6", name: "listing_count", type: "number", defaultValue: 0, description: "Number of matching listings" },
  { id: "v7", name: "customer_name", type: "string", description: "Customer name" },
  { id: "v8", name: "customer_phone", type: "string", description: "Customer phone" },
  { id: "v9", name: "api_base_url", type: "string", defaultValue: "https://api.example.com", description: "API base URL" },
];

// ============================================
// Legal Intake Template
// ============================================

const legalIntakeNodes: FlowNode[] = [
  createNode("start", "start", "Start", { x: 250, y: 0 }, {
    speaksFirst: true,
    greeting: {
      mode: "static",
      content: "Thank you for calling Smith & Associates Law Firm. This call may be recorded for quality purposes. How may I direct your call?",
    },
  }),
  createNode("case_type", "conversation", "Determine Case Type", { x: 250, y: 140 }, {
    content: {
      mode: "prompt",
      content: `You are a professional legal intake specialist for Smith & Associates. Determine what type of legal matter the caller needs:
- Personal Injury (car accident, slip and fall, medical malpractice)
- Family Law (divorce, custody, adoption)
- Criminal Defense
- Estate Planning (wills, trusts)
- Business Law

Ask clarifying questions to properly categorize. Be empathetic and professional.`,
    },
    transitions: [
      { id: "t_pi", type: "prompt", condition: "Caller has a personal injury case", handle: "t_pi", label: "Personal Injury" },
      { id: "t_family", type: "prompt", condition: "Caller needs family law help (divorce, custody, etc.)", handle: "t_family", label: "Family Law" },
      { id: "t_criminal", type: "prompt", condition: "Caller needs criminal defense", handle: "t_criminal", label: "Criminal" },
      { id: "t_other", type: "prompt", condition: "Caller needs estate planning, business law, or other legal help", handle: "t_other", label: "Other" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
  }),
  createNode("pi_intake", "conversation", "Personal Injury Intake", { x: 0, y: 360 }, {
    content: {
      mode: "prompt",
      content: `Conduct personal injury intake. Collect:
1. Date of incident
2. Type of incident (car accident, slip & fall, etc.)
3. Nature and severity of injuries
4. Have they seen a doctor?
5. Is there a police report?
6. Have they spoken to insurance?

Be empathetic - this may be traumatic for the caller.`,
    },
    transitions: [
      { id: "t_pi_done", type: "prompt", condition: "All personal injury intake information has been collected", handle: "t_pi_done", label: "Intake Complete" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 250,
  }),
  createNode("family_intake", "conversation", "Family Law Intake", { x: 250, y: 360 }, {
    content: {
      mode: "prompt",
      content: `Conduct family law intake. Determine:
1. Type of matter (divorce, custody, adoption)
2. Are there children involved?
3. Contested or uncontested?
4. Have papers been filed?
5. Is there a court date?

Be sensitive - these are deeply personal matters.`,
    },
    transitions: [
      { id: "t_fam_done", type: "prompt", condition: "Family law intake information has been collected", handle: "t_fam_done", label: "Intake Complete" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 250,
  }),
  createNode("criminal_msg", "conversation", "Criminal - Transfer", { x: 500, y: 360 }, {
    content: {
      mode: "static",
      content: "Criminal matters require immediate attention from one of our attorneys. Let me transfer you directly. May I have your name and a callback number in case we get disconnected?",
    },
    transitions: [
      { id: "t_crim_info", type: "prompt", condition: "Caller has provided their name and callback number", handle: "t_crim_info", label: "Info Provided" },
    ],
  }),
  createNode("general_intake", "conversation", "General Intake", { x: 700, y: 360 }, {
    content: {
      mode: "prompt",
      content: `General legal intake. Collect:
1. Brief description of legal matter
2. Urgency level
3. Contact information (name, phone, email)
4. Best time to call back`,
    },
    transitions: [
      { id: "t_gen_done", type: "prompt", condition: "All general intake information has been collected", handle: "t_gen_done", label: "Intake Complete" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
  }),
  createNode("conflict_check", "function", "Conflict Check", { x: 200, y: 560 }, {
    executionType: "http",
    method: "POST",
    url: "{{api_base_url}}/conflict-check",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caller_name: "{{caller_name}}",
      opposing_party: "{{opposing_party}}",
      case_type: "{{case_type}}",
    }),
    responseMapping: [
      { id: "m1", variable: "has_conflict", path: "$.conflict" },
    ],
    speakDuringExecution: { mode: "static", content: "Let me run a quick check in our system..." },
    waitForResult: true,
    timeout: 10000,
    transitions: [
      { id: "t_conflict", type: "equation", condition: "{{has_conflict}} == true", handle: "t_conflict", label: "Conflict Found" },
      { id: "t_no_conflict", type: "equation", condition: "{{has_conflict}} == false", handle: "t_no_conflict", label: "No Conflict" },
    ],
  }),
  createNode("conflict_decline", "end", "Decline - Conflict", { x: 50, y: 740 }, {
    speakDuringExecution: {
      mode: "static",
      content: "I apologize, but after a preliminary check, our firm may have a conflict of interest in this matter. I recommend contacting another firm. The State Bar can provide referrals.",
    },
    reason: "completed",
  }),
  createNode("schedule", "conversation", "Schedule Consultation", { x: 350, y: 740 }, {
    content: {
      mode: "prompt",
      content: "Schedule a consultation with the caller. Collect preferred date/time and confirm their contact information.",
    },
    transitions: [
      { id: "t_sched_done", type: "prompt", condition: "Consultation has been scheduled and confirmed", handle: "t_sched_done", label: "Scheduled" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
  }),
  createNode("transfer_attorney", "call_transfer", "Transfer to Attorney", { x: 600, y: 560 }, {
    destination: "+15553334444",
    transferType: "warm",
  }),
  createNode("end_success", "end", "End - Scheduled", { x: 350, y: 900 }, {
    speakDuringExecution: {
      mode: "static",
      content: "Your consultation is scheduled. You'll receive a confirmation email shortly. Please bring any relevant documents. Thank you for calling Smith & Associates.",
    },
    reason: "completed",
  }),
];

const legalIntakeEdges: FlowEdge[] = [
  createEdge("start", "case_type"),
  createEdge("case_type", "pi_intake", "t_pi", "Personal Injury"),
  createEdge("case_type", "family_intake", "t_family", "Family Law"),
  createEdge("case_type", "criminal_msg", "t_criminal", "Criminal"),
  createEdge("case_type", "general_intake", "t_other", "Other"),
  createEdge("pi_intake", "conflict_check", "t_pi_done"),
  createEdge("family_intake", "conflict_check", "t_fam_done"),
  createEdge("criminal_msg", "transfer_attorney", "t_crim_info"),
  createEdge("general_intake", "conflict_check", "t_gen_done"),
  createEdge("conflict_check", "conflict_decline", "t_conflict", "Conflict"),
  createEdge("conflict_check", "schedule", "t_no_conflict", "No Conflict"),
  createEdge("schedule", "end_success", "t_sched_done"),
];

const legalIntakeVariables: FlowVariable[] = [
  { id: "v1", name: "case_type", type: "string", description: "Type of legal matter" },
  { id: "v2", name: "caller_name", type: "string", description: "Caller's full name" },
  { id: "v3", name: "caller_phone", type: "string", description: "Callback number" },
  { id: "v4", name: "caller_email", type: "string", description: "Email address" },
  { id: "v5", name: "incident_date", type: "string", description: "Date of incident" },
  { id: "v6", name: "opposing_party", type: "string", description: "Other party involved" },
  { id: "v7", name: "has_conflict", type: "boolean", defaultValue: false, description: "Conflict check result" },
  { id: "v8", name: "api_base_url", type: "string", defaultValue: "https://api.example.com", description: "API base URL" },
];

// ============================================
// Healthcare Triage Template
// ============================================

const healthcareTriageNodes: FlowNode[] = [
  createNode("start", "start", "Start", { x: 250, y: 0 }, {
    speaksFirst: true,
    greeting: {
      mode: "static",
      content: "Thank you for calling City Medical Center. For emergencies, please hang up and dial 911. For all other inquiries, I'm here to help. What can I assist you with today?",
    },
  }),
  createNode("triage", "conversation", "Initial Triage", { x: 250, y: 160 }, {
    content: {
      mode: "prompt",
      content: `You are a professional medical receptionist for City Medical Center. You are warm, empathetic, and efficient.

IMPORTANT SAFETY RULES:
- If someone mentions chest pain, difficulty breathing, severe bleeding, stroke symptoms, or any life-threatening emergency, immediately tell them to hang up and call 911.
- Never provide medical diagnoses or advice.
- Be empathetic, especially for those describing symptoms.

Listen carefully to understand what the caller needs and help route them appropriately.`,
    },
    transitions: [
      { id: "t_emergency", type: "prompt", condition: "Caller describes a medical emergency requiring 911 (chest pain, difficulty breathing, severe bleeding, stroke symptoms)", handle: "t_emergency", label: "Emergency" },
      { id: "t_appointment", type: "prompt", condition: "Caller wants to schedule, reschedule, or cancel a doctor appointment", handle: "t_appointment", label: "Appointment" },
      { id: "t_refill", type: "prompt", condition: "Caller needs a prescription refill or medication renewal", handle: "t_refill", label: "Refill" },
      { id: "t_symptoms", type: "prompt", condition: "Caller is describing symptoms and needs guidance on what to do", handle: "t_symptoms", label: "Symptoms" },
      { id: "t_billing", type: "prompt", condition: "Caller has billing or insurance questions", handle: "t_billing", label: "Billing" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 250,
  }),
  createNode("emergency_msg", "end", "Emergency - Call 911", { x: 0, y: 380 }, {
    speakDuringExecution: {
      mode: "static",
      content: "Based on what you've described, please hang up and call 911 immediately, or go to your nearest emergency room. This sounds like it needs immediate medical attention.",
    },
    reason: "completed",
  }),
  createNode("appointment_flow", "conversation", "Schedule Appointment", { x: 180, y: 380 }, {
    content: {
      mode: "prompt",
      content: `You are a friendly medical receptionist helping schedule an appointment.
Collect: patient name, date of birth, appointment type (checkup, follow-up, sick visit), preferred doctor, preferred date/time, and reason for visit.
Be efficient but thorough.`,
    },
    transitions: [
      { id: "t_appt_done", type: "prompt", condition: "All appointment information has been collected and confirmed", handle: "t_appt_done", label: "Info Complete" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
  }),
  createNode("refill_flow", "conversation", "Prescription Refill", { x: 380, y: 380 }, {
    content: {
      mode: "prompt",
      content: `You are a medical receptionist helping with prescription refills.
Collect: patient name, date of birth, medication name, dosage, and pharmacy preference.
Verify all medication details carefully.`,
    },
    transitions: [
      { id: "t_refill_done", type: "prompt", condition: "All refill information has been collected", handle: "t_refill_done", label: "Info Complete" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
  }),
  createNode("symptom_check", "conversation", "Symptom Assessment", { x: 560, y: 380 }, {
    content: {
      mode: "prompt",
      content: `You are a medical triage assistant. Assess the caller's symptoms to determine urgency.

NEVER diagnose conditions - only assess urgency.
EMERGENCY signs (recommend 911): chest pain, difficulty breathing, severe bleeding, stroke symptoms, loss of consciousness.

Ask about: main symptom, when it started, severity (1-10), other symptoms, current medications.
Then recommend: schedule appointment, or nurse callback.`,
    },
    transitions: [
      { id: "t_sym_emergency", type: "prompt", condition: "Symptoms indicate a medical emergency requiring 911", handle: "t_sym_emergency", label: "Emergency" },
      { id: "t_sym_appt", type: "prompt", condition: "Symptoms suggest patient should schedule a doctor appointment", handle: "t_sym_appt", label: "Schedule Appt" },
      { id: "t_sym_callback", type: "prompt", condition: "Patient needs a nurse callback for further assessment", handle: "t_sym_callback", label: "Nurse Callback" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 250,
  }),
  createNode("check_availability", "function", "Check Availability", { x: 180, y: 580 }, {
    executionType: "http",
    method: "POST",
    url: "{{api_base_url}}/appointments/availability",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_dob: "{{patient_dob}}",
      appointment_type: "{{appointment_type}}",
      preferred_date: "{{preferred_date}}",
    }),
    responseMapping: [
      { id: "m1", variable: "available_slots", path: "$.slots" },
    ],
    speakDuringExecution: { mode: "static", content: "Let me check available appointments..." },
    waitForResult: true,
    timeout: 10000,
    transitions: [
      { id: "t_slots_found", type: "equation", condition: "{{_function_success}} == true", handle: "t_slots_found", label: "Slots Found" },
      { id: "t_slots_error", type: "equation", condition: "{{_function_success}} == false", handle: "t_slots_error", label: "Error" },
    ],
  }),
  createNode("confirm_appointment", "conversation", "Confirm Appointment", { x: 100, y: 760 }, {
    content: {
      mode: "prompt",
      content: "Confirm the appointment details: type, date, time. Remind them to arrive 15 minutes early with insurance card and ID. Ask if they need anything else.",
    },
    transitions: [
      { id: "t_appt_confirmed", type: "prompt", condition: "Patient confirms the appointment", handle: "t_appt_confirmed", label: "Confirmed" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
  }),
  createNode("submit_refill", "function", "Submit Refill", { x: 380, y: 580 }, {
    executionType: "http",
    method: "POST",
    url: "{{api_base_url}}/refills",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_name: "{{patient_name}}",
      patient_dob: "{{patient_dob}}",
      medication: "{{medication_name}}",
      pharmacy: "{{pharmacy}}",
    }),
    responseMapping: [
      { id: "m1", variable: "refill_status", path: "$.status" },
    ],
    speakDuringExecution: { mode: "static", content: "Submitting your refill request now..." },
    waitForResult: true,
    timeout: 10000,
    transitions: [],
  }),
  createNode("refill_confirm", "conversation", "Confirm Refill", { x: 380, y: 760 }, {
    content: {
      mode: "static",
      content: "Your refill request has been submitted. The pharmacy will have it ready in 24-48 hours and will notify you. Is there anything else I can help with?",
    },
    transitions: [
      { id: "t_refill_bye", type: "prompt", condition: "Caller is done and ready to end the call", handle: "t_refill_bye", label: "Done" },
    ],
  }),
  createNode("nurse_callback", "conversation", "Nurse Callback", { x: 560, y: 580 }, {
    content: {
      mode: "prompt",
      content: "Schedule a nurse callback. Collect: patient name, callback phone number, and brief summary of their symptoms. Let them know a nurse will call back within 2 hours.",
    },
    transitions: [
      { id: "t_nurse_done", type: "prompt", condition: "Nurse callback has been scheduled with all information collected", handle: "t_nurse_done", label: "Scheduled" },
    ],
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
  }),
  createNode("transfer_billing", "call_transfer", "Transfer to Billing", { x: 750, y: 380 }, {
    destination: "+15557778888",
    transferType: "cold",
  }),
  createNode("end_call", "end", "End Call", { x: 300, y: 920 }, {
    speakDuringExecution: {
      mode: "static",
      content: "Thank you for calling City Medical Center. Take care and feel better soon!",
    },
    reason: "completed",
  }),
];

const healthcareTriageEdges: FlowEdge[] = [
  // Start → Triage
  createEdge("start", "triage"),
  // Triage routes by intent
  createEdge("triage", "emergency_msg", "t_emergency", "Emergency"),
  createEdge("triage", "appointment_flow", "t_appointment", "Appointment"),
  createEdge("triage", "refill_flow", "t_refill", "Refill"),
  createEdge("triage", "symptom_check", "t_symptoms", "Symptoms"),
  createEdge("triage", "transfer_billing", "t_billing", "Billing"),
  // Appointment flow
  createEdge("appointment_flow", "check_availability", "t_appt_done"),
  createEdge("check_availability", "confirm_appointment", "t_slots_found"),
  createEdge("check_availability", "nurse_callback", "t_slots_error"),
  createEdge("confirm_appointment", "end_call", "t_appt_confirmed"),
  // Refill flow
  createEdge("refill_flow", "submit_refill", "t_refill_done"),
  createEdge("submit_refill", "refill_confirm"),
  createEdge("refill_confirm", "end_call", "t_refill_bye"),
  // Symptom check routes
  createEdge("symptom_check", "emergency_msg", "t_sym_emergency", "Emergency"),
  createEdge("symptom_check", "appointment_flow", "t_sym_appt", "Appointment"),
  createEdge("symptom_check", "nurse_callback", "t_sym_callback", "Nurse Callback"),
  // Nurse callback → End
  createEdge("nurse_callback", "end_call", "t_nurse_done"),
];

const healthcareTriageVariables: FlowVariable[] = [
  { id: "v1", name: "patient_name", type: "string", description: "Patient full name" },
  { id: "v2", name: "patient_dob", type: "string", description: "Patient date of birth" },
  { id: "v3", name: "appointment_type", type: "string", description: "Type of appointment" },
  { id: "v4", name: "preferred_date", type: "string", description: "Preferred appointment date" },
  { id: "v5", name: "preferred_doctor", type: "string", description: "Preferred doctor" },
  { id: "v6", name: "medication_name", type: "string", description: "Medication for refill" },
  { id: "v7", name: "pharmacy", type: "string", description: "Preferred pharmacy" },
  { id: "v8", name: "symptoms", type: "string", description: "Reported symptoms" },
  { id: "v9", name: "available_slots", type: "array", description: "Available appointment slots" },
  { id: "v10", name: "refill_status", type: "string", description: "Refill request status" },
  { id: "v11", name: "callback_phone", type: "string", description: "Phone number for nurse callback" },
  { id: "v12", name: "api_base_url", type: "string", defaultValue: "https://api.example.com", description: "API base URL" },
];

// ============================================
// Export All Templates
// ============================================

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "home-services",
    name: "Home Services Booking",
    description: "HVAC, plumbing, and electrical appointment scheduling with emergency routing",
    category: "Home Services",
    nodes: homeServicesNodes,
    edges: homeServicesEdges,
    variables: homeServicesVariables,
    settings: DEFAULT_SETTINGS,
  },
  {
    id: "real-estate",
    name: "Real Estate Inquiry",
    description: "Property buying, selling, and rental qualification with listing search",
    category: "Real Estate",
    nodes: realEstateNodes,
    edges: realEstateEdges,
    variables: realEstateVariables,
    settings: DEFAULT_SETTINGS,
  },
  {
    id: "legal-intake",
    name: "Legal Intake",
    description: "Law firm intake with case type routing and conflict checking",
    category: "Legal",
    nodes: legalIntakeNodes,
    edges: legalIntakeEdges,
    variables: legalIntakeVariables,
    settings: DEFAULT_SETTINGS,
  },
  {
    id: "healthcare-triage",
    name: "Healthcare Triage",
    description: "Medical office triage, appointment scheduling, and prescription refills",
    category: "Healthcare",
    nodes: healthcareTriageNodes,
    edges: healthcareTriageEdges,
    variables: healthcareTriageVariables,
    settings: DEFAULT_SETTINGS,
  },
];

// ============================================
// Get Template by ID
// ============================================

export function getTemplateById(id: string): FlowTemplate | undefined {
  return FLOW_TEMPLATES.find((t) => t.id === id);
}

// ============================================
// Create Blank Flow
// ============================================

export function createBlankFlow(): Pick<FlowTemplate, "nodes" | "edges" | "variables" | "settings"> {
  return {
    nodes: [
      createNode("start", "start", "Start", { x: 250, y: 100 }, {
        speaksFirst: true,
        greeting: {
          mode: "static",
          content: "Hello! How can I help you today?",
        },
      }),
    ],
    edges: [],
    variables: [
      { id: "v1", name: "user_input", type: "string", description: "Latest user input" },
    ],
    settings: DEFAULT_SETTINGS,
  };
}
