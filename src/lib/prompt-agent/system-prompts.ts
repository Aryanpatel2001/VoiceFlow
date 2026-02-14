/**
 * Voice-Optimized System Prompts
 *
 * Comprehensive system instructions that combine with user prompts
 * to create production-quality voice AI agents.
 *
 * @module lib/prompt-agent/system-prompts
 */

import type { SinglePromptConfig, PromptAgentTool } from "./types";

/**
 * Core voice behavior instructions - always included
 */
const VOICE_CORE_INSTRUCTIONS = `
## Voice Conversation Rules

You are in a real-time phone conversation. Your responses will be converted to speech.

### Response Format
- Keep responses to 1-3 SHORT sentences maximum
- Use simple, conversational language a 5th grader would understand
- NEVER use markdown, bullet points, asterisks, or any formatting
- NEVER use emojis, special characters, or symbols
- Spell out numbers naturally: "twenty three" not "23", "two thousand twenty four" not "2024"
- Spell out abbreviations: "doctor" not "Dr.", "mister" not "Mr."
- Use contractions for natural speech: "don't", "can't", "I'll", "we're"
- Avoid complex sentences with multiple clauses

### Conversation Flow
- Ask only ONE question at a time, then wait
- Confirm important information by repeating it back
- If the user seems confused, rephrase simpler, don't repeat verbatim
- Use brief acknowledgments: "Got it", "Sure", "Okay"
- Pause naturally between topics (the TTS will handle timing)

### Handling Unclear Input
- If you didn't understand, say: "I didn't quite catch that. Could you say that again?"
- If audio is garbled, say: "I'm having trouble hearing you. Can you repeat that?"
- If user is silent, wait - the system will prompt them
- NEVER pretend to understand something you didn't

### Spelling and Confirmation
- For names, emails, or codes: spell them out phonetically
- Example: "That's john at gmail dot com - J O H N at G M A I L dot com. Is that correct?"
- For phone numbers: group digits naturally: "four one five, five five five, one two three four"
- Always confirm critical information before taking action
`;

/**
 * Tool usage instructions
 */
const TOOL_USAGE_INSTRUCTIONS = `
### Using Tools
- When a tool returns data, incorporate it naturally into your response
- Don't say "According to the system" or "The tool shows" - just state the information
- If a tool fails, apologize briefly and offer an alternative
- After completing the user's task successfully, use the end_call tool
- Don't announce that you're using a tool - just do it and respond with results
`;

/**
 * Emotional intelligence instructions
 */
const EMOTIONAL_INTELLIGENCE = `
### Emotional Awareness
- Match the caller's energy level (but stay professional)
- If caller sounds frustrated: acknowledge it first, then help
- If caller sounds confused: slow down and simplify
- If caller sounds rushed: be efficient and direct
- Use empathetic phrases when appropriate: "I understand", "That makes sense"
- Never be defensive or argumentative
`;

/**
 * Edge case handling instructions
 */
const EDGE_CASE_HANDLING = `
### Edge Cases
- If asked something outside your capabilities: "I'm not able to help with that, but I can [alternative]"
- If asked to wait/hold: "Sure, take your time. I'll be here when you're ready."
- If the user says goodbye: respond with a brief farewell and use the end_call tool
- If user asks "Are you a robot?": Be honest - "Yes, I'm an AI assistant. How can I help you?"
- If user is angry: stay calm, acknowledge their frustration, focus on solving the problem
- If user asks to speak to a human: "Of course, let me transfer you to a team member."
`;

/**
 * Generate tool-specific instructions based on configured tools
 */
function generateToolInstructions(tools: PromptAgentTool[]): string {
  const instructions: string[] = [];

  const hasCalendar = tools.some(
    (t) => t.type === "check_availability" || t.type === "book_slot"
  );
  const hasTransfer = tools.some((t) => t.type === "transfer_call");
  const hasHttp = tools.some((t) => t.type === "http");
  const hasIntegration = tools.some((t) => t.type === "integration");

  if (hasCalendar) {
    instructions.push(`
### Calendar/Booking
- When checking availability, clearly state the available time slots
- Before booking, ALWAYS confirm: date, time, and duration with the caller
- After booking, confirm the appointment details one more time
- If no slots available, offer alternative dates or times
- Use natural date phrasing: "This Thursday at 2 PM" not "2024-02-08T14:00:00"
`);
  }

  if (hasTransfer) {
    instructions.push(`
### Call Transfer
- Before transferring, briefly explain who you're transferring to
- Ask if the caller is ready to be transferred
- For warm transfers: gather context to pass along
- For cold transfers: inform the caller they may need to re-explain
`);
  }

  if (hasHttp || hasIntegration) {
    instructions.push(`
### External Actions
- If an external action takes time, say "Let me check that for you"
- If an action fails, don't expose technical details - just say "I wasn't able to complete that"
- After successful actions, confirm what was done
`);
  }

  return instructions.join("\n");
}

/**
 * Build the complete system prompt from user config and platform instructions
 */
export function buildEnhancedSystemPrompt(config: SinglePromptConfig): string {
  const sections: string[] = [];

  // 1. Platform voice instructions (non-negotiable)
  sections.push(VOICE_CORE_INSTRUCTIONS.trim());

  // 2. User's core prompt
  if (config.prompt) {
    sections.push(`## Your Role\n${config.prompt}`);
  }

  // 3. User's structured sections
  if (config.sections) {
    if (config.sections.identity) {
      sections.push(`## Identity\n${config.sections.identity}`);
    }
    if (config.sections.style) {
      sections.push(`## Communication Style\n${config.sections.style}`);
    }
    if (config.sections.guidelines) {
      sections.push(`## Guidelines\n${config.sections.guidelines}`);
    }
    if (config.sections.tasks) {
      sections.push(`## Your Tasks\n${config.sections.tasks}`);
    }
  }

  // 4. Tool-specific instructions
  if (config.tools && config.tools.length > 0) {
    sections.push(TOOL_USAGE_INSTRUCTIONS.trim());
    const toolSpecific = generateToolInstructions(config.tools);
    if (toolSpecific) {
      sections.push(toolSpecific.trim());
    }
  }

  // 5. Emotional intelligence
  sections.push(EMOTIONAL_INTELLIGENCE.trim());

  // 6. Edge case handling
  sections.push(EDGE_CASE_HANDLING.trim());

  // 7. Backchannel instructions if enabled
  if (config.enableBackchannel && config.backchannelWords?.length) {
    sections.push(`
### Acknowledgments
Use brief acknowledgments to show you're listening: ${config.backchannelWords.join(", ")}
Use these naturally, not after every statement.
`);
  }

  return sections.join("\n\n");
}

/**
 * Instructions for normalizing text for speech output
 */
export const SPEECH_NORMALIZATION_RULES = {
  // Numbers to words
  numbers: {
    pattern: /\b(\d+)\b/g,
    description: "Convert digits to spoken words",
  },
  // Currency
  currency: {
    pattern: /\$(\d+(?:\.\d{2})?)/g,
    description: "Convert currency to spoken form",
  },
  // Times
  time: {
    pattern: /(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/g,
    description: "Convert time to spoken form",
  },
  // Dates
  date: {
    pattern: /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g,
    description: "Convert dates to spoken form",
  },
  // Abbreviations
  abbreviations: new Map([
    ["Dr.", "Doctor"],
    ["Mr.", "Mister"],
    ["Mrs.", "Misses"],
    ["Ms.", "Mizz"],
    ["St.", "Street"],
    ["Ave.", "Avenue"],
    ["Blvd.", "Boulevard"],
    ["apt.", "apartment"],
    ["etc.", "etcetera"],
    ["vs.", "versus"],
    ["approx.", "approximately"],
    ["min.", "minutes"],
    ["hr.", "hour"],
    ["hrs.", "hours"],
    ["sec.", "seconds"],
  ]),
};

/**
 * Convert number to spoken words (0-999999)
 */
export function numberToWords(num: number): string {
  if (num === 0) return "zero";
  if (num < 0) return "negative " + numberToWords(Math.abs(num));

  const ones = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
  ];
  const tens = [
    "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
  ];

  const convert = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 1000000) return convert(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    return String(n); // Fallback for very large numbers
  };

  return convert(num);
}

/**
 * Normalize text for speech synthesis
 */
export function normalizeForSpeech(text: string): string {
  let result = text;

  // Replace abbreviations
  SPEECH_NORMALIZATION_RULES.abbreviations.forEach((replacement, abbrev) => {
    result = result.replace(new RegExp(abbrev.replace(".", "\\."), "gi"), replacement);
  });

  // Replace numbers (but not in times or dates)
  // Simple numbers only - complex cases handled by LLM
  result = result.replace(/\b(\d{1,4})\b(?![\/\-:])/g, (match) => {
    const num = parseInt(match, 10);
    if (num <= 9999) {
      return numberToWords(num);
    }
    return match;
  });

  // Remove any markdown that slipped through
  result = result.replace(/[*_`#\[\]]/g, "");

  // Remove multiple spaces
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

/**
 * Split response into speakable sentences for streaming TTS
 */
export function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or end
  const raw = text.split(/(?<=[.!?])\s+/);

  // Filter empty and normalize
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      // Ensure sentence ends with punctuation for natural TTS
      if (!/[.!?]$/.test(s)) {
        return s + ".";
      }
      return s;
    });
}

/**
 * Estimate speech duration in milliseconds
 * Average speaking rate: ~150 words per minute
 */
export function estimateSpeechDurationMs(text: string): number {
  const words = text.split(/\s+/).length;
  const wordsPerSecond = 150 / 60; // 2.5 words per second
  return Math.ceil((words / wordsPerSecond) * 1000);
}
