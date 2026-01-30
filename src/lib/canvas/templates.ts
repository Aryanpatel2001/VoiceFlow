/**
 * Flow Templates
 *
 * Pre-built conversation flow templates for different industries.
 * Users can start from these templates instead of building from scratch.
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
    greeting: "Thank you for calling ABC Home Services. How can I help you today?",
  }),
  createNode("collect_service", "ai_agent", "Collect Service Type", { x: 250, y: 120 }, {
    mode: "structured",
    prompt: "You are a friendly receptionist for a home services company. Ask what service the customer needs.",
    responses: [
      { id: "hvac", condition: "intent:hvac", text: "I can help you with HVAC service. Is this for repair, maintenance, or installation?" },
      { id: "plumbing", condition: "intent:plumbing", text: "I can help with plumbing. Is this an emergency or a scheduled service?" },
      { id: "electrical", condition: "intent:electrical", text: "I can help with electrical work. What seems to be the issue?" },
      { id: "other", text: "I'd be happy to help. Could you tell me more about what service you need?" },
    ],
  }),
  createNode("set_service", "set_variable", "Set Service Type", { x: 250, y: 240 }, {
    assignments: [
      { id: "a1", variable: "service_type", value: "{{detected_intent}}", operation: "set" },
    ],
  }),
  createNode("check_emergency", "condition", "Emergency Check", { x: 250, y: 360 }, {
    rules: [
      { id: "r1", variable: "is_emergency", operator: "equals", value: true, outputHandle: "emergency" },
    ],
    defaultHandle: "normal",
  }),
  createNode("emergency_transfer", "transfer", "Emergency Transfer", { x: 50, y: 480 }, {
    type: "department",
    destination: "emergency",
    message: "I understand this is urgent. Let me connect you with our emergency team right away.",
    warmTransfer: true,
  }),
  createNode("collect_info", "ai_agent", "Collect Customer Info", { x: 400, y: 480 }, {
    mode: "freeform",
    prompt: `You are scheduling a {{service_type}} appointment. Collect:
1. Customer name
2. Address
3. Phone number
4. Preferred date/time
5. Brief description of the issue

Be conversational and helpful. Confirm details before proceeding.`,
    allowedActions: ["continue", "transfer"],
    maxTurns: 5,
  }),
  createNode("set_customer", "set_variable", "Save Customer Info", { x: 400, y: 600 }, {
    assignments: [
      { id: "a1", variable: "customer_name", value: "{{collected_name}}", operation: "set" },
      { id: "a2", variable: "address", value: "{{collected_address}}", operation: "set" },
      { id: "a3", variable: "preferred_time", value: "{{collected_time}}", operation: "set" },
    ],
  }),
  createNode("check_availability", "api_call", "Check Availability", { x: 400, y: 720 }, {
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
    errorHandle: "error",
  }),
  createNode("confirm_booking", "ai_agent", "Confirm Booking", { x: 300, y: 840 }, {
    mode: "structured",
    prompt: "Confirm the appointment details with the customer.",
    responses: [
      { id: "r1", text: "Great! I have you scheduled for {{service_type}} on {{preferred_time}}. {{technician_name}} will be your technician. Is there anything else I can help you with?" },
    ],
  }),
  createNode("end_success", "end_call", "End Call - Success", { x: 300, y: 960 }, {
    message: "Thank you for choosing ABC Home Services. We'll see you soon. Have a great day!",
    reason: "appointment_booked",
  }),
  createNode("api_error", "ai_agent", "Handle API Error", { x: 550, y: 840 }, {
    mode: "structured",
    prompt: "Apologize for technical difficulties and offer to take their information.",
    responses: [
      { id: "r1", text: "I apologize, I'm having trouble checking our schedule. Let me take your information and have someone call you back within the hour to confirm your appointment." },
    ],
  }),
  createNode("transfer_human", "transfer", "Transfer to Human", { x: 550, y: 960 }, {
    type: "agent",
    destination: "scheduling",
    message: "Let me connect you with our scheduling team.",
    warmTransfer: false,
  }),
];

const homeServicesEdges: FlowEdge[] = [
  createEdge("start", "collect_service"),
  createEdge("collect_service", "set_service"),
  createEdge("set_service", "check_emergency"),
  createEdge("check_emergency", "emergency_transfer", "emergency", "Emergency"),
  createEdge("check_emergency", "collect_info", "normal", "Normal"),
  createEdge("collect_info", "set_customer"),
  createEdge("set_customer", "check_availability"),
  createEdge("check_availability", "confirm_booking", "success", "Success"),
  createEdge("check_availability", "api_error", "error", "Error"),
  createEdge("confirm_booking", "end_success"),
  createEdge("api_error", "transfer_human"),
];

const homeServicesVariables: FlowVariable[] = [
  { id: "v1", name: "service_type", type: "string", description: "Type of service requested" },
  { id: "v2", name: "customer_name", type: "string", description: "Customer's full name" },
  { id: "v3", name: "address", type: "string", description: "Service address" },
  { id: "v4", name: "phone", type: "string", description: "Customer phone number" },
  { id: "v5", name: "preferred_time", type: "string", description: "Preferred appointment time" },
  { id: "v6", name: "is_emergency", type: "boolean", defaultValue: false, description: "Is this an emergency?" },
  { id: "v7", name: "available_slots", type: "array", description: "Available appointment slots" },
  { id: "v8", name: "technician_name", type: "string", description: "Assigned technician name" },
  { id: "v9", name: "api_base_url", type: "string", defaultValue: "https://api.example.com", description: "API base URL" },
];

// ============================================
// Real Estate Inquiry Template
// ============================================

const realEstateNodes: FlowNode[] = [
  createNode("start", "start", "Start", { x: 250, y: 0 }, {
    greeting: "Hi, thank you for calling Premier Realty. I'm your AI assistant. Are you looking to buy, sell, or rent a property?",
  }),
  createNode("determine_intent", "condition", "Determine Intent", { x: 250, y: 120 }, {
    rules: [
      { id: "r1", variable: "intent", operator: "equals", value: "buy", outputHandle: "buy" },
      { id: "r2", variable: "intent", operator: "equals", value: "sell", outputHandle: "sell" },
      { id: "r3", variable: "intent", operator: "equals", value: "rent", outputHandle: "rent" },
    ],
    defaultHandle: "other",
  }),
  createNode("buyer_questions", "ai_agent", "Buyer Qualification", { x: 50, y: 280 }, {
    mode: "freeform",
    prompt: `You are a real estate assistant qualifying a buyer. Ask about:
1. Property type preference (house, condo, townhouse)
2. Preferred location/neighborhood
3. Budget range
4. Number of bedrooms/bathrooms needed
5. Timeline for purchase
6. Pre-approval status

Be friendly and helpful. Gather all information naturally.`,
    allowedActions: ["continue", "schedule_showing", "transfer"],
    maxTurns: 6,
  }),
  createNode("seller_questions", "ai_agent", "Seller Qualification", { x: 250, y: 280 }, {
    mode: "freeform",
    prompt: `You are a real estate assistant helping a seller. Ask about:
1. Property address
2. Property type and size
3. Reason for selling
4. Timeline to sell
5. Have they had a recent appraisal?
6. Any existing mortgage?

Be empathetic and professional.`,
    allowedActions: ["continue", "schedule_consultation", "transfer"],
    maxTurns: 6,
  }),
  createNode("rental_questions", "ai_agent", "Rental Inquiry", { x: 450, y: 280 }, {
    mode: "freeform",
    prompt: `You are helping someone find a rental. Ask about:
1. Preferred location
2. Budget range
3. Move-in date
4. Number of bedrooms needed
5. Pet requirements
6. Lease term preference

Be helpful and efficient.`,
    allowedActions: ["continue", "schedule_tour", "transfer"],
    maxTurns: 5,
  }),
  createNode("search_kb", "knowledge_base", "Search Listings", { x: 250, y: 420 }, {
    datasetId: "listings",
    query: "{{property_type}} in {{location}} under {{budget}}",
    topK: 5,
    minScore: 0.6,
    outputVariable: "matching_listings",
    noResultsHandle: "no_results",
  }),
  createNode("present_options", "ai_agent", "Present Options", { x: 150, y: 540 }, {
    mode: "structured",
    prompt: "Present the matching listings to the customer.",
    responses: [
      { id: "r1", text: "I found {{matching_listings.length}} properties that match your criteria. The top option is {{matching_listings[0].address}} - a {{matching_listings[0].type}} listed at {{matching_listings[0].price}}. Would you like to schedule a showing?" },
    ],
  }),
  createNode("no_matches", "ai_agent", "No Matches", { x: 350, y: 540 }, {
    mode: "structured",
    prompt: "No exact matches found.",
    responses: [
      { id: "r1", text: "I don't have exact matches right now, but new listings come in daily. Would you like me to have an agent call you when something matches your criteria?" },
    ],
  }),
  createNode("schedule_showing", "ai_agent", "Schedule Showing", { x: 250, y: 660 }, {
    mode: "freeform",
    prompt: "Help schedule a property showing. Collect their name, phone number, and preferred times.",
    allowedActions: ["continue", "end_call"],
    maxTurns: 3,
  }),
  createNode("end_success", "end_call", "End Call", { x: 250, y: 780 }, {
    message: "Thank you for calling Premier Realty. An agent will contact you shortly to confirm your showing. Have a great day!",
    reason: "showing_scheduled",
  }),
  createNode("transfer_agent", "transfer", "Transfer to Agent", { x: 500, y: 420 }, {
    type: "department",
    destination: "sales",
    message: "Let me connect you with one of our experienced agents.",
    warmTransfer: false,
  }),
];

const realEstateEdges: FlowEdge[] = [
  createEdge("start", "determine_intent"),
  createEdge("determine_intent", "buyer_questions", "buy", "Buying"),
  createEdge("determine_intent", "seller_questions", "sell", "Selling"),
  createEdge("determine_intent", "rental_questions", "rent", "Renting"),
  createEdge("determine_intent", "transfer_agent", "other", "Other"),
  createEdge("buyer_questions", "search_kb"),
  createEdge("seller_questions", "transfer_agent"),
  createEdge("rental_questions", "search_kb"),
  createEdge("search_kb", "present_options", "found", "Found"),
  createEdge("search_kb", "no_matches", "no_results", "No Results"),
  createEdge("present_options", "schedule_showing"),
  createEdge("no_matches", "transfer_agent"),
  createEdge("schedule_showing", "end_success"),
];

const realEstateVariables: FlowVariable[] = [
  { id: "v1", name: "intent", type: "string", description: "Buy, sell, or rent" },
  { id: "v2", name: "property_type", type: "string", description: "Type of property" },
  { id: "v3", name: "location", type: "string", description: "Preferred location" },
  { id: "v4", name: "budget", type: "string", description: "Budget range" },
  { id: "v5", name: "bedrooms", type: "number", description: "Number of bedrooms" },
  { id: "v6", name: "timeline", type: "string", description: "Purchase/move timeline" },
  { id: "v7", name: "matching_listings", type: "array", description: "Matching property listings" },
  { id: "v8", name: "customer_name", type: "string", description: "Customer name" },
  { id: "v9", name: "customer_phone", type: "string", description: "Customer phone" },
];

// ============================================
// Legal Intake Template
// ============================================

const legalIntakeNodes: FlowNode[] = [
  createNode("start", "start", "Start", { x: 250, y: 0 }, {
    greeting: "Thank you for calling Smith & Associates Law Firm. This call may be recorded for quality purposes. How may I direct your call?",
  }),
  createNode("case_type", "ai_agent", "Determine Case Type", { x: 250, y: 120 }, {
    mode: "freeform",
    prompt: `You are a legal intake specialist. Determine what type of legal matter the caller needs help with:
- Personal Injury (car accident, slip and fall, medical malpractice)
- Family Law (divorce, custody, adoption)
- Criminal Defense
- Estate Planning (wills, trusts)
- Business Law
- Other

Ask clarifying questions to properly categorize their needs.`,
    allowedActions: ["continue", "transfer"],
    maxTurns: 3,
  }),
  createNode("set_case_type", "set_variable", "Set Case Type", { x: 250, y: 240 }, {
    assignments: [
      { id: "a1", variable: "case_type", value: "{{detected_case_type}}", operation: "set" },
    ],
  }),
  createNode("check_case_type", "condition", "Route by Case Type", { x: 250, y: 360 }, {
    rules: [
      { id: "r1", variable: "case_type", operator: "equals", value: "personal_injury", outputHandle: "pi" },
      { id: "r2", variable: "case_type", operator: "equals", value: "family_law", outputHandle: "family" },
      { id: "r3", variable: "case_type", operator: "equals", value: "criminal", outputHandle: "criminal" },
    ],
    defaultHandle: "general",
  }),
  createNode("pi_intake", "ai_agent", "Personal Injury Intake", { x: 50, y: 500 }, {
    mode: "freeform",
    prompt: `Conduct personal injury intake. Collect:
1. Date of incident
2. Type of incident (car accident, slip & fall, etc.)
3. Were there injuries? What kind?
4. Have they seen a doctor?
5. Is there a police report?
6. Have they spoken to insurance?
7. Statute of limitations check (ask when it happened)

Be empathetic. This may be traumatic for the caller.`,
    allowedActions: ["continue", "schedule_consultation"],
    maxTurns: 6,
  }),
  createNode("family_intake", "ai_agent", "Family Law Intake", { x: 250, y: 500 }, {
    mode: "freeform",
    prompt: `Conduct family law intake. Determine:
1. Type of matter (divorce, custody, adoption, etc.)
2. Are there children involved?
3. Is this contested or uncontested?
4. Have papers been filed?
5. Is there a court date?
6. Urgency level

Be sensitive - these are personal matters.`,
    allowedActions: ["continue", "schedule_consultation"],
    maxTurns: 5,
  }),
  createNode("criminal_intake", "ai_agent", "Criminal Intake", { x: 450, y: 500 }, {
    mode: "structured",
    prompt: "Criminal matters require immediate attorney attention.",
    responses: [
      { id: "r1", text: "Criminal matters require immediate attention from one of our attorneys. Let me transfer you directly. May I have your name and a callback number in case we get disconnected?" },
    ],
  }),
  createNode("general_intake", "ai_agent", "General Intake", { x: 650, y: 500 }, {
    mode: "freeform",
    prompt: `General legal intake. Collect:
1. Brief description of legal matter
2. Urgency level
3. Contact information
4. Best time to call back`,
    allowedActions: ["continue", "transfer"],
    maxTurns: 4,
  }),
  createNode("conflict_check", "api_call", "Conflict Check", { x: 250, y: 640 }, {
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
    errorHandle: "error",
  }),
  createNode("check_conflict", "condition", "Has Conflict?", { x: 250, y: 760 }, {
    rules: [
      { id: "r1", variable: "has_conflict", operator: "equals", value: true, outputHandle: "conflict" },
    ],
    defaultHandle: "no_conflict",
  }),
  createNode("conflict_decline", "end_call", "Decline - Conflict", { x: 50, y: 880 }, {
    message: "I apologize, but after a preliminary check, our firm may have a conflict of interest in this matter. I recommend contacting another firm. The State Bar can provide referrals.",
    reason: "conflict_of_interest",
  }),
  createNode("schedule", "ai_agent", "Schedule Consultation", { x: 350, y: 880 }, {
    mode: "freeform",
    prompt: "Schedule a consultation. Collect preferred date/time and confirm contact information.",
    allowedActions: ["continue"],
    maxTurns: 3,
  }),
  createNode("end_success", "end_call", "End - Scheduled", { x: 350, y: 1000 }, {
    message: "Your consultation is scheduled. You'll receive a confirmation email shortly. Please bring any relevant documents. Thank you for calling Smith & Associates.",
    reason: "consultation_scheduled",
  }),
  createNode("transfer_attorney", "transfer", "Transfer to Attorney", { x: 550, y: 640 }, {
    type: "department",
    destination: "criminal_defense",
    message: "Connecting you now.",
    warmTransfer: true,
  }),
];

const legalIntakeEdges: FlowEdge[] = [
  createEdge("start", "case_type"),
  createEdge("case_type", "set_case_type"),
  createEdge("set_case_type", "check_case_type"),
  createEdge("check_case_type", "pi_intake", "pi", "Personal Injury"),
  createEdge("check_case_type", "family_intake", "family", "Family Law"),
  createEdge("check_case_type", "criminal_intake", "criminal", "Criminal"),
  createEdge("check_case_type", "general_intake", "general", "Other"),
  createEdge("pi_intake", "conflict_check"),
  createEdge("family_intake", "conflict_check"),
  createEdge("criminal_intake", "transfer_attorney"),
  createEdge("general_intake", "conflict_check"),
  createEdge("conflict_check", "check_conflict", "success"),
  createEdge("conflict_check", "schedule", "error"),
  createEdge("check_conflict", "conflict_decline", "conflict", "Conflict"),
  createEdge("check_conflict", "schedule", "no_conflict", "No Conflict"),
  createEdge("schedule", "end_success"),
];

const legalIntakeVariables: FlowVariable[] = [
  { id: "v1", name: "case_type", type: "string", description: "Type of legal matter" },
  { id: "v2", name: "caller_name", type: "string", description: "Caller's full name" },
  { id: "v3", name: "caller_phone", type: "string", description: "Callback number" },
  { id: "v4", name: "caller_email", type: "string", description: "Email address" },
  { id: "v5", name: "incident_date", type: "string", description: "Date of incident" },
  { id: "v6", name: "opposing_party", type: "string", description: "Other party involved" },
  { id: "v7", name: "has_conflict", type: "boolean", defaultValue: false, description: "Conflict check result" },
  { id: "v8", name: "urgency", type: "string", defaultValue: "normal", description: "Urgency level" },
  { id: "v9", name: "api_base_url", type: "string", defaultValue: "https://api.example.com", description: "API base URL" },
];

// ============================================
// Healthcare Triage Template
// ============================================

const healthcareTriageNodes: FlowNode[] = [
  createNode("start", "start", "Start", { x: 250, y: 0 }, {
    greeting: "Thank you for calling City Medical Center. For emergencies, please hang up and dial 911. For all other inquiries, I'm here to help. What can I assist you with today?",
  }),
  createNode("triage", "ai_agent", "Initial Triage", { x: 250, y: 120 }, {
    systemPrompt: `You are a professional medical receptionist for City Medical Center. You are warm, empathetic, and efficient. Your job is to understand the caller's needs and route them appropriately.

IMPORTANT SAFETY RULES:
- If someone mentions chest pain, difficulty breathing, severe bleeding, stroke symptoms (face drooping, arm weakness, speech difficulty), or any life-threatening emergency, immediately tell them to hang up and call 911.
- Never provide medical diagnoses or advice - always recommend seeing a healthcare professional.
- Be empathetic, especially for those describing symptoms or concerns.`,
    instructions: "Listen carefully to understand what the caller needs, then route them to the appropriate service.",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
    intents: [
      {
        id: "intent_emergency",
        name: "emergency",
        description: "Caller has a medical emergency requiring 911",
        examples: ["I'm having chest pain", "I can't breathe", "someone is unconscious", "there's a lot of blood"],
        outputHandle: "emergency",
      },
      {
        id: "intent_appointment",
        name: "appointment",
        description: "Caller wants to schedule, reschedule, or cancel an appointment",
        examples: ["I need to see a doctor", "schedule an appointment", "book a checkup", "cancel my appointment"],
        outputHandle: "appointment",
      },
      {
        id: "intent_refill",
        name: "refill",
        description: "Caller needs a prescription refill",
        examples: ["I need a refill", "prescription refill", "I'm out of my medication", "renew my prescription"],
        outputHandle: "refill",
      },
      {
        id: "intent_symptoms",
        name: "symptoms",
        description: "Caller is describing symptoms and needs guidance",
        examples: ["I'm not feeling well", "I have a headache", "I've been sick", "what should I do about"],
        outputHandle: "symptoms",
      },
      {
        id: "intent_billing",
        name: "billing",
        description: "Caller has billing or insurance questions",
        examples: ["I have a question about my bill", "insurance claim", "payment", "how much does it cost"],
        outputHandle: "billing",
      },
    ],
    entities: [
      {
        id: "entity_patient_name",
        name: "patient_name",
        type: "string",
        description: "The patient's full name",
        variableName: "patient_name",
        required: false,
      },
      {
        id: "entity_symptoms",
        name: "symptoms",
        type: "string",
        description: "Any symptoms or health concerns mentioned",
        variableName: "symptoms",
        required: false,
      },
    ],
    fallbackResponse: "I want to make sure I help you correctly. Could you tell me more about what you need today?",
    confidenceThreshold: 0.6,
  }),
  // Removed the condition node - AI Agent now handles routing directly via intents
  createNode("emergency_msg", "end_call", "Emergency - Call 911", { x: 0, y: 400 }, {
    message: "Based on what you've described, please hang up and call 911 immediately, or go to your nearest emergency room. This sounds like it needs immediate medical attention.",
    reason: "emergency_redirect",
  }),
  createNode("appointment_flow", "ai_agent", "Schedule Appointment", { x: 150, y: 400 }, {
    systemPrompt: "You are a friendly medical receptionist helping schedule an appointment. Be efficient but thorough in collecting information.",
    instructions: "Collect: patient name, date of birth, appointment type (checkup, follow-up, sick visit), preferred doctor, preferred date/time, and reason for visit.",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
    intents: [],
    entities: [
      { id: "e1", name: "patient_name", type: "string", description: "Patient's full name", variableName: "patient_name", required: true },
      { id: "e2", name: "patient_dob", type: "date", description: "Patient's date of birth", variableName: "patient_dob", required: true },
      { id: "e3", name: "appointment_type", type: "string", description: "Type of appointment", variableName: "appointment_type", required: true },
      { id: "e4", name: "preferred_date", type: "date", description: "Preferred appointment date", variableName: "preferred_date", required: true },
      { id: "e5", name: "preferred_doctor", type: "string", description: "Preferred doctor name", variableName: "preferred_doctor", required: false },
    ],
  }),
  createNode("refill_flow", "ai_agent", "Prescription Refill", { x: 300, y: 400 }, {
    systemPrompt: "You are a medical receptionist helping with prescription refills. Be helpful and verify all medication details carefully.",
    instructions: "Collect: patient name, date of birth, medication name, dosage, pharmacy preference.",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
    intents: [],
    entities: [
      { id: "e1", name: "patient_name", type: "string", description: "Patient's full name", variableName: "patient_name", required: true },
      { id: "e2", name: "patient_dob", type: "date", description: "Patient's date of birth", variableName: "patient_dob", required: true },
      { id: "e3", name: "medication_name", type: "string", description: "Name of medication to refill", variableName: "medication_name", required: true },
      { id: "e4", name: "pharmacy", type: "string", description: "Preferred pharmacy", variableName: "pharmacy", required: true },
    ],
  }),
  createNode("symptom_check", "ai_agent", "Symptom Assessment", { x: 450, y: 400 }, {
    systemPrompt: `You are a medical triage assistant. Assess the caller's symptoms to determine urgency.

NEVER diagnose conditions - only assess urgency and recommend next steps.

EMERGENCY signs (recommend 911): chest pain, difficulty breathing, severe bleeding, stroke symptoms, loss of consciousness.`,
    instructions: "Ask about: main symptom, when it started, severity (1-10), other symptoms, current medications. Then recommend: emergency (911), urgent care, schedule appointment, or nurse callback.",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 250,
    intents: [
      { id: "i1", name: "emergency_symptoms", description: "Symptoms requiring immediate emergency care", examples: ["chest pain getting worse", "can't breathe", "severe pain"], outputHandle: "emergency" },
      { id: "i2", name: "urgent_care", description: "Needs same-day care but not 911", examples: ["high fever", "severe headache", "injury"], outputHandle: "urgent" },
      { id: "i3", name: "routine", description: "Can wait for scheduled appointment", examples: ["mild symptoms", "ongoing issue", "checkup needed"], outputHandle: "default" },
    ],
    entities: [
      { id: "e1", name: "symptoms", type: "string", description: "Described symptoms", variableName: "symptoms", required: true },
      { id: "e2", name: "urgency_level", type: "string", description: "Assessed urgency", variableName: "urgency_level", required: false },
    ],
  }),
  createNode("check_availability", "api_call", "Check Availability", { x: 250, y: 540 }, {
    method: "POST",
    url: "{{api_base_url}}/appointments/availability",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      patient_dob: "{{patient_dob}}",
      appointment_type: "{{appointment_type}}",
      preferred_date: "{{preferred_date}}",
      doctor_id: "{{preferred_doctor}}",
    }),
    responseMapping: [
      { id: "m1", variable: "available_slots", path: "$.slots" },
    ],
    errorHandle: "error",
  }),
  createNode("confirm_appointment", "ai_agent", "Confirm Appointment", { x: 200, y: 680 }, {
    systemPrompt: "You are confirming a medical appointment. Read back the details and ask if there's anything else needed.",
    instructions: "Confirm the appointment details: type, date, time, doctor. Remind them to arrive 15 minutes early with insurance card and ID.",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 150,
    intents: [
      { id: "i1", name: "needs_change", description: "Patient wants to change something", examples: ["actually can we change", "different time", "wrong date"], outputHandle: "change" },
      { id: "i2", name: "confirmed", description: "Patient confirms appointment", examples: ["sounds good", "that works", "perfect", "yes"], outputHandle: "default" },
    ],
    entities: [],
  }),
  createNode("send_refill", "api_call", "Submit Refill Request", { x: 350, y: 540 }, {
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
    errorHandle: "error",
  }),
  createNode("refill_confirm", "ai_agent", "Confirm Refill", { x: 350, y: 680 }, {
    systemPrompt: "You are confirming a prescription refill request. Let them know the timeline and ask if there's anything else.",
    instructions: "Confirm the refill was submitted. Tell them the pharmacy will have it ready in 24-48 hours and will notify them.",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 150,
    intents: [],
    entities: [],
  }),
  createNode("nurse_callback", "ai_agent", "Request Nurse Callback", { x: 500, y: 540 }, {
    systemPrompt: "You are scheduling a nurse callback for a patient with symptoms. Be reassuring and collect their contact information.",
    instructions: "Collect: patient name, callback phone number, and brief summary of their symptoms. Let them know a nurse will call back within 2 hours.",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 200,
    intents: [],
    entities: [
      { id: "e1", name: "patient_name", type: "string", description: "Patient's full name", variableName: "patient_name", required: true },
      { id: "e2", name: "callback_phone", type: "phone", description: "Phone number for callback", variableName: "callback_phone", required: true },
      { id: "e3", name: "symptoms", type: "string", description: "Brief symptom summary", variableName: "symptoms", required: true },
    ],
  }),
  createNode("end_call", "end_call", "End Call", { x: 300, y: 800 }, {
    message: "Thank you for calling City Medical Center. Take care and feel better soon!",
    reason: "completed",
  }),
  createNode("transfer_billing", "transfer", "Transfer to Billing", { x: 550, y: 400 }, {
    type: "department",
    destination: "billing",
    message: "Let me transfer you to our billing department.",
    warmTransfer: false,
  }),
];

const healthcareTriageEdges: FlowEdge[] = [
  // Start → Triage
  createEdge("start", "triage"),

  // Triage AI Agent routes based on detected intent
  createEdge("triage", "emergency_msg", "emergency", "Emergency"),
  createEdge("triage", "appointment_flow", "appointment", "Appointment"),
  createEdge("triage", "refill_flow", "refill", "Refill"),
  createEdge("triage", "symptom_check", "symptoms", "Symptoms"),
  createEdge("triage", "transfer_billing", "billing", "Billing"),
  createEdge("triage", "symptom_check", "default", "Other"),

  // Appointment flow
  createEdge("appointment_flow", "check_availability"),
  createEdge("check_availability", "confirm_appointment", "success"),
  createEdge("check_availability", "nurse_callback", "error"),
  createEdge("confirm_appointment", "end_call"),

  // Refill flow
  createEdge("refill_flow", "send_refill"),
  createEdge("send_refill", "refill_confirm", "success"),
  createEdge("send_refill", "transfer_billing", "error"),
  createEdge("refill_confirm", "end_call"),

  // Symptom check flow - routes based on urgency assessment
  createEdge("symptom_check", "emergency_msg", "emergency", "Emergency"),
  createEdge("symptom_check", "appointment_flow", "urgent", "Urgent Care"),
  createEdge("symptom_check", "nurse_callback", "default", "Nurse Callback"),

  // Nurse callback → End
  createEdge("nurse_callback", "end_call"),
];

const healthcareTriageVariables: FlowVariable[] = [
  { id: "v1", name: "patient_name", type: "string", description: "Patient full name (auto-extracted)" },
  { id: "v2", name: "patient_dob", type: "string", description: "Patient date of birth" },
  { id: "v3", name: "appointment_type", type: "string", description: "Type of appointment" },
  { id: "v4", name: "preferred_date", type: "string", description: "Preferred appointment date" },
  { id: "v5", name: "preferred_doctor", type: "string", description: "Preferred doctor ID" },
  { id: "v6", name: "medication_name", type: "string", description: "Medication for refill" },
  { id: "v7", name: "pharmacy", type: "string", description: "Preferred pharmacy" },
  { id: "v8", name: "symptoms", type: "string", description: "Reported symptoms (auto-extracted)" },
  { id: "v9", name: "urgency_level", type: "string", defaultValue: "normal", description: "Urgency assessment" },
  { id: "v10", name: "available_slots", type: "array", description: "Available appointment slots" },
  { id: "v11", name: "api_base_url", type: "string", defaultValue: "https://api.example.com", description: "API base URL" },
  { id: "v12", name: "_detected_intent", type: "string", description: "AI-detected intent (auto-set)" },
  { id: "v13", name: "_intent_confidence", type: "number", description: "Intent confidence score (auto-set)" },
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
        greeting: "Hello! How can I help you today?",
      }),
    ],
    edges: [],
    variables: [
      { id: "v1", name: "user_input", type: "string", description: "Latest user input" },
      { id: "v2", name: "intent", type: "string", description: "Detected user intent" },
    ],
    settings: DEFAULT_SETTINGS,
  };
}
