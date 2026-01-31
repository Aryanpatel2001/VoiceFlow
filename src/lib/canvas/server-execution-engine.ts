/**
 * Server-Side Flow Execution Engine
 *
 * Executes canvas flow nodes for production phone calls via
 * Twilio/Deepgram/ElevenLabs. Handles node routing, conversation AI,
 * transition evaluation, variable substitution, function execution,
 * and call control actions.
 *
 * Node types: start, conversation, function, call_transfer, set_variable, end
 *
 * @module lib/canvas/server-execution-engine
 */

import OpenAI from "openai";

// ============================================
// Types
// ============================================

export interface FlowNodeData {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface FlowEdgeData {
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface FlowVariableData {
  name: string;
  defaultValue?: unknown;
}

export interface ExecutionTurnResult {
  response: string;
  action: "speak" | "transfer" | "end" | "gather";
  nextNodeId: string | null;
  variables: Record<string, unknown>;
  transferTo?: string;
  transferType?: "cold" | "warm";
  warmOptions?: { holdMusic?: boolean; humanDetectionTimeout?: number };
}

export interface ConversationResult {
  response: string;
  matchedTransition: string | null;
  extractedVariables: Record<string, unknown>;
}

// ============================================
// Internal Types
// ============================================

interface ContentConfig {
  mode: "prompt" | "static";
  content: string;
}

interface TransitionCondition {
  id: string;
  type: "equation" | "prompt";
  condition: string;
  handle: string;
  label?: string;
}

interface ResponseMapping {
  id: string;
  variable: string;
  path: string;
}

interface VariableAssignment {
  id: string;
  variable: string;
  value: string;
  operation: "set" | "append" | "increment" | "decrement";
}

// ============================================
// Core Execution
// ============================================

/**
 * Execute a flow node and return the result.
 * Recursively follows non-speaking nodes (set_variable, function, etc.)
 */
export async function executeNode(
  nodes: FlowNodeData[],
  edges: FlowEdgeData[],
  nodeId: string,
  userInput: string,
  variables: Record<string, unknown>,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<ExecutionTurnResult> {
  const node = nodes.find((n) => n.id === nodeId);

  if (!node) {
    console.error(`[Engine] Node not found: ${nodeId}`);
    return {
      response: "I'm sorry, there was an error in the conversation flow.",
      action: "end",
      nextNodeId: null,
      variables,
    };
  }

  const config =
    (node.data as { config?: Record<string, unknown> })?.config || {};

  switch (node.type) {
    // ------------------------------------------
    // Start Node
    // ------------------------------------------
    case "start": {
      console.log(`[Engine] Executing start node: ${nodeId}`);

      const speaksFirst = (config.speaksFirst as boolean) ?? true;
      const greeting = config.greeting as ContentConfig | undefined;

      let response = "";
      if (speaksFirst && greeting && greeting.content) {
        // For start node, we use the greeting content directly
        // (both static and prompt modes resolve to their content string at start)
        response = substituteVariables(greeting.content, variables);
      }

      const nextNode = findNextNode(edges, nodeId, "default");

      return {
        response,
        action: nextNode ? "gather" : "end",
        nextNodeId: nextNode,
        variables,
      };
    }

    // ------------------------------------------
    // Conversation Node
    // ------------------------------------------
    case "conversation": {
      console.log(`[Engine] Executing conversation node: ${nodeId}`);
      console.log(`[Engine] User input: "${userInput}"`);

      const content = config.content as ContentConfig | undefined;
      const transitions =
        (config.transitions as TransitionCondition[]) || [];
      const model = (config.model as string) || "gpt-4o-mini";
      const temperature = (config.temperature as number) ?? 0.7;
      const maxTokens = (config.maxTokens as number) ?? 300;

      // --- Static mode ---
      if (content?.mode === "static") {
        const staticText = substituteVariables(
          content.content || "",
          variables
        );

        // If user hasn't spoken yet (no input), deliver the static text
        // and gather input, staying on this node.
        if (!userInput) {
          return {
            response: staticText,
            action: "gather",
            nextNodeId: nodeId,
            variables,
          };
        }

        // User has responded to the static text. Evaluate transitions.
        const matchedHandle = await evaluateTransitions(
          transitions,
          variables,
          userInput,
          conversationHistory
        );

        if (matchedHandle) {
          const nextNode = findNextNode(edges, nodeId, matchedHandle);
          if (nextNode) {
            return {
              response: "",
              action: "gather",
              nextNodeId: nextNode,
              variables,
            };
          }
        }

        // No transition matched -- stay on this node, re-deliver static text
        return {
          response: staticText,
          action: "gather",
          nextNodeId: nodeId,
          variables,
        };
      }

      // --- Prompt mode ---
      const result = await executeConversation(
        config,
        userInput,
        variables,
        conversationHistory,
        transitions,
        model,
        temperature,
        maxTokens
      );

      // Merge extracted variables
      const updatedVariables = {
        ...variables,
        ...result.extractedVariables,
      };

      // If AI returned a matched transition handle, follow it
      if (result.matchedTransition) {
        const nextNode = findNextNode(
          edges,
          nodeId,
          result.matchedTransition
        );
        if (nextNode) {
          return {
            response: result.response,
            action: "gather",
            nextNodeId: nextNode,
            variables: updatedVariables,
          };
        }
      }

      // Also try evaluating transitions ourselves (equation first, then prompt)
      // This handles cases where the AI didn't match but an equation condition does
      const evalHandle = await evaluateTransitions(
        transitions,
        updatedVariables,
        userInput,
        conversationHistory
      );

      if (evalHandle) {
        const nextNode = findNextNode(edges, nodeId, evalHandle);
        if (nextNode) {
          return {
            response: result.response,
            action: "gather",
            nextNodeId: nextNode,
            variables: updatedVariables,
          };
        }
      }

      // No transition matched -- stay on this node (multi-turn loop)
      return {
        response: result.response,
        action: "gather",
        nextNodeId: nodeId,
        variables: updatedVariables,
      };
    }

    // ------------------------------------------
    // Function Node
    // ------------------------------------------
    case "function": {
      console.log(`[Engine] Executing function node: ${nodeId}`);

      const executionType = (config.executionType as string) || "http";
      const transitions =
        (config.transitions as TransitionCondition[]) || [];
      const speakDuring = config.speakDuringExecution as
        | ContentConfig
        | undefined;
      const timeout = (config.timeout as number) || 10000;

      let functionVariables = { ...variables };

      // Execute based on type
      if (executionType === "http") {
        const httpResult = await executeHTTPFunction(
          config,
          functionVariables,
          timeout
        );
        functionVariables = {
          ...functionVariables,
          ...httpResult.mappedVariables,
        };
        functionVariables["_function_success"] = httpResult.success;
        functionVariables["_function_status"] = httpResult.statusCode;
      } else if (executionType === "code") {
        const codeResult = executeCodeFunction(config, functionVariables);
        if (config.outputVariable) {
          functionVariables[config.outputVariable as string] = codeResult;
        }
      }

      // Evaluate transitions after execution
      const matchedHandle = await evaluateTransitions(
        transitions,
        functionVariables,
        userInput,
        conversationHistory
      );

      let nextNode: string | null = null;
      if (matchedHandle) {
        nextNode = findNextNode(edges, nodeId, matchedHandle);
      }
      if (!nextNode) {
        nextNode = findNextNode(edges, nodeId, "default");
      }

      // If there is speech during execution, return it and let the caller
      // handle the next node on the following turn
      if (speakDuring && speakDuring.content) {
        const speechText = substituteVariables(
          speakDuring.content,
          functionVariables
        );
        return {
          response: speechText,
          action: nextNode ? "gather" : "end",
          nextNodeId: nextNode,
          variables: functionVariables,
        };
      }

      // Silent auto-advance: recursively execute the next node
      if (nextNode) {
        return executeNode(
          nodes,
          edges,
          nextNode,
          userInput,
          functionVariables,
          conversationHistory
        );
      }

      return {
        response: "",
        action: "end",
        nextNodeId: null,
        variables: functionVariables,
      };
    }

    // ------------------------------------------
    // Set Variable Node
    // ------------------------------------------
    case "set_variable": {
      console.log(`[Engine] Executing set_variable node: ${nodeId}`);

      const assignments =
        (config.assignments as VariableAssignment[]) || [];
      const newVariables = { ...variables };

      for (const assign of assignments) {
        const value = substituteVariables(assign.value, newVariables);
        switch (assign.operation) {
          case "set":
            newVariables[assign.variable] = value;
            break;
          case "append":
            newVariables[assign.variable] = `${newVariables[assign.variable] || ""}${value}`;
            break;
          case "increment":
            newVariables[assign.variable] =
              Number(newVariables[assign.variable] || 0) + Number(value);
            break;
          case "decrement":
            newVariables[assign.variable] =
              Number(newVariables[assign.variable] || 0) - Number(value);
            break;
        }
      }

      // Silent auto-advance
      const nextNode = findNextNode(edges, nodeId, "default");
      if (nextNode) {
        return executeNode(
          nodes,
          edges,
          nextNode,
          userInput,
          newVariables,
          conversationHistory
        );
      }

      return {
        response: "",
        action: "end",
        nextNodeId: null,
        variables: newVariables,
      };
    }

    // ------------------------------------------
    // Call Transfer Node
    // ------------------------------------------
    case "call_transfer": {
      console.log(`[Engine] Executing call_transfer node: ${nodeId}`);

      const destination = substituteVariables(
        (config.destination as string) || "",
        variables
      );
      const transferType =
        (config.transferType as "cold" | "warm") || "cold";
      const warmOptions = config.warmOptions as
        | { holdMusic?: boolean; humanDetectionTimeout?: number }
        | undefined;

      return {
        response: "",
        action: "transfer",
        nextNodeId: null,
        variables,
        transferTo: destination,
        transferType,
        warmOptions:
          transferType === "warm" ? warmOptions : undefined,
      };
    }

    // ------------------------------------------
    // End Node
    // ------------------------------------------
    case "end": {
      console.log(`[Engine] Executing end node: ${nodeId}`);

      const speakDuring = config.speakDuringExecution as
        | ContentConfig
        | undefined;
      const reason = (config.reason as string) || "completed";

      let farewell = "";
      if (speakDuring && speakDuring.content) {
        farewell = substituteVariables(speakDuring.content, variables);
      }

      console.log(`[Engine] Call ending. Reason: ${reason}`);

      return {
        response: farewell,
        action: "end",
        nextNodeId: null,
        variables,
      };
    }

    // ------------------------------------------
    // Unknown node type -- try to advance
    // ------------------------------------------
    default: {
      console.warn(`[Engine] Unknown node type: ${node.type}`);
      const nextNode = findNextNode(edges, nodeId, "default");
      return {
        response: "",
        action: nextNode ? "gather" : "end",
        nextNodeId: nextNode,
        variables,
      };
    }
  }
}

// ============================================
// Transition Evaluation
// ============================================

/**
 * Evaluate transition conditions and return the handle of the first matching
 * transition, or null if none match.
 *
 * Evaluation order:
 *   1. Equation transitions (top-to-bottom) -- deterministic checks
 *   2. Prompt transitions (top-to-bottom) -- AI-evaluated conditions
 *
 * First TRUE wins.
 */
export async function evaluateTransitions(
  transitions: TransitionCondition[],
  variables: Record<string, unknown>,
  userInput: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string | null> {
  if (!transitions || transitions.length === 0) {
    return null;
  }

  // Split into equation and prompt transitions, preserving order within each group
  const equationTransitions = transitions.filter(
    (t) => t.type === "equation"
  );
  const promptTransitions = transitions.filter(
    (t) => t.type === "prompt"
  );

  // --- Evaluate equation transitions first ---
  for (const transition of equationTransitions) {
    const result = evaluateEquationCondition(
      transition.condition,
      variables,
      userInput
    );
    if (result) {
      console.log(
        `[Transitions] Equation match: "${transition.condition}" -> handle "${transition.handle}"`
      );
      return transition.handle;
    }
  }

  // --- Evaluate prompt transitions with AI ---
  if (promptTransitions.length > 0) {
    const matchedHandle = await evaluatePromptTransitions(
      promptTransitions,
      variables,
      userInput,
      conversationHistory
    );
    if (matchedHandle) {
      return matchedHandle;
    }
  }

  return null;
}

/**
 * Evaluate a single equation-type condition string against variables and user input.
 *
 * Supported formats:
 *   "{{variable}} == \"value\""
 *   "{{variable}} != \"value\""
 *   "{{variable}} > 5"
 *   "{{variable}} >= 5"
 *   "{{variable}} < 5"
 *   "{{variable}} <= 5"
 *   "{{variable}} CONTAINS \"text\""
 *   "{{variable}} NOT CONTAINS \"text\""
 *   "{{variable}} exists"
 *   "{{variable}} not exists"
 */
function evaluateEquationCondition(
  condition: string,
  variables: Record<string, unknown>,
  userInput: string
): boolean {
  try {
    // Substitute variables in the condition string first
    const substituted = substituteVariables(condition, {
      ...variables,
      user_input: userInput,
    });

    // --- "exists" / "not exists" patterns ---
    const existsMatch = condition.match(
      /^\{\{(\w+)\}\}\s+(exists|not exists)$/i
    );
    if (existsMatch) {
      const varName = existsMatch[1];
      const op = existsMatch[2].toLowerCase();
      const value = variables[varName];
      const doesExist =
        value !== undefined &&
        value !== null &&
        value !== "";

      return op === "exists" ? doesExist : !doesExist;
    }

    // --- Binary operator patterns ---
    // Try to parse: left OPERATOR right
    const binaryMatch = condition.match(
      /^\{\{(\w+)\}\}\s*(==|!=|>=|<=|>|<|CONTAINS|NOT CONTAINS)\s*(.+)$/i
    );
    if (binaryMatch) {
      const varName = binaryMatch[1];
      const operator = binaryMatch[2].toUpperCase();
      let compareValue = binaryMatch[3].trim();

      // Strip surrounding quotes from compare value
      if (
        (compareValue.startsWith('"') && compareValue.endsWith('"')) ||
        (compareValue.startsWith("'") && compareValue.endsWith("'"))
      ) {
        compareValue = compareValue.slice(1, -1);
      }

      // Resolve the compare value for any variable references
      compareValue = substituteVariables(compareValue, variables);

      const varValue = variables[varName];

      switch (operator) {
        case "==":
          return String(varValue ?? "") === String(compareValue);
        case "!=":
          return String(varValue ?? "") !== String(compareValue);
        case ">":
          return Number(varValue) > Number(compareValue);
        case ">=":
          return Number(varValue) >= Number(compareValue);
        case "<":
          return Number(varValue) < Number(compareValue);
        case "<=":
          return Number(varValue) <= Number(compareValue);
        case "CONTAINS":
          return String(varValue ?? "")
            .toLowerCase()
            .includes(compareValue.toLowerCase());
        case "NOT CONTAINS":
          return !String(varValue ?? "")
            .toLowerCase()
            .includes(compareValue.toLowerCase());
        default:
          return false;
      }
    }

    // --- Fallback: try evaluating the fully-substituted string ---
    // If the condition string after substitution looks like a simple truthy check
    if (substituted.trim() === "true") return true;
    if (substituted.trim() === "false") return false;

    return false;
  } catch (error) {
    console.error(
      `[Transitions] Error evaluating equation condition "${condition}":`,
      error
    );
    return false;
  }
}

/**
 * Use AI to evaluate prompt-type transitions.
 * Sends all prompt conditions to the model and asks which (if any) are satisfied.
 */
async function evaluatePromptTransitions(
  transitions: TransitionCondition[],
  variables: Record<string, unknown>,
  userInput: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      "[Transitions] Cannot evaluate prompt transitions: no OpenAI API key"
    );
    return null;
  }

  const openai = new OpenAI({ apiKey });

  const conditionsList = transitions
    .map(
      (t, i) =>
        `${i + 1}. [handle="${t.handle}"] Condition: "${t.condition}"${t.label ? ` (Label: ${t.label})` : ""}`
    )
    .join("\n");

  const variableContext =
    Object.keys(variables).length > 0
      ? `\nCurrent variables:\n${Object.entries(variables)
          .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
          .join("\n")}`
      : "";

  const recentHistory = conversationHistory.slice(-6);
  const historyText =
    recentHistory.length > 0
      ? `\nRecent conversation:\n${recentHistory.map((m) => `  ${m.role}: ${m.content}`).join("\n")}`
      : "";

  const systemPrompt = `You are a transition condition evaluator for a voice AI agent.

Given the user's latest input, conversation history, and current variables, determine which transition condition (if any) is satisfied.

Transition conditions to evaluate (in order):
${conditionsList}
${variableContext}
${historyText}

User's latest input: "${userInput}"

Evaluate each condition in order. Return the handle of the FIRST condition that is TRUE, or "none" if no conditions match.

You must respond with ONLY a JSON object in this exact format:
{"matchedHandle": "<handle string or none>", "reasoning": "<brief explanation>"}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }],
      temperature: 0.1,
      max_tokens: 150,
    });

    const responseText =
      completion.choices[0]?.message?.content?.trim() || "";
    console.log(
      `[Transitions] Prompt evaluation response: ${responseText}`
    );

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const handle = parsed.matchedHandle;
      if (handle && handle !== "none") {
        // Verify the handle is one of our transitions
        const valid = transitions.find((t) => t.handle === handle);
        if (valid) {
          console.log(
            `[Transitions] Prompt match: "${valid.condition}" -> handle "${handle}" (${parsed.reasoning})`
          );
          return handle;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("[Transitions] Error evaluating prompt transitions:", error);
    return null;
  }
}

// ============================================
// Conversation Node Execution
// ============================================

/**
 * Execute the conversation node's AI call.
 *
 * The system prompt comes from config.content.content.
 * Transition conditions are included in the system prompt so the AI
 * can evaluate prompt-type transitions inline.
 *
 * Uses structured function calling to return:
 *   - response: natural language reply
 *   - matchedTransition: handle of the first matching transition (or null)
 *   - extractedVariables: any variables extracted from the conversation
 */
export async function executeConversation(
  config: Record<string, unknown>,
  userInput: string,
  variables: Record<string, unknown>,
  conversationHistory: Array<{ role: string; content: string }>,
  transitions: TransitionCondition[],
  model: string,
  temperature: number,
  maxTokens: number
): Promise<ConversationResult> {
  console.log(`[Conversation] executeConversation called`);
  console.log(`[Conversation] User input: "${userInput}"`);

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error(`[Conversation] OpenAI API key not configured!`);
    return {
      response:
        "I apologize, but I'm unable to process your request right now.",
      matchedTransition: null,
      extractedVariables: {},
    };
  }

  const openai = new OpenAI({ apiKey });

  // Build the system prompt from node content
  const content = config.content as ContentConfig | undefined;
  const basePrompt =
    content?.content || "You are a helpful voice assistant.";

  // Variable context
  const variableContext =
    Object.keys(variables).length > 0
      ? `\n\nCurrent conversation variables:\n${Object.entries(variables)
          .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
          .join("\n")}`
      : "";

  // Transition context -- include so the AI can reason about transitions
  let transitionContext = "";
  if (transitions.length > 0) {
    const transitionDescriptions = transitions
      .map(
        (t, i) =>
          `  ${i + 1}. [type=${t.type}, handle="${t.handle}"] ${t.condition}${t.label ? ` (${t.label})` : ""}`
      )
      .join("\n");

    transitionContext = `\n\nTransition conditions (evaluate after responding):
${transitionDescriptions}
When you detect that one of the above conditions is met based on the user's input and conversation context, include the matching transition handle in your response. Evaluate conditions in order; first TRUE wins.`;
  }

  const fullSystemPrompt = `${substituteVariables(basePrompt, variables)}${variableContext}${transitionContext}\n\nKeep responses concise and natural for voice (1-3 sentences). Do not use markdown, bullet points, or formatting.`;

  // Build messages array
  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: fullSystemPrompt },
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  if (userInput) {
    messages.push({ role: "user", content: userInput });
  }

  // Build transition handle enum for the tool
  const transitionHandles = transitions.map((t) => t.handle);

  try {
    console.log(
      `[Conversation] Calling OpenAI with model: ${model}`
    );

    const tools: OpenAI.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "process_conversation",
          description:
            "Process the conversation turn and return a structured response with transition evaluation",
          parameters: {
            type: "object" as const,
            properties: {
              response: {
                type: "string",
                description:
                  "Natural, concise voice response to the user (1-3 sentences)",
              },
              matchedTransition: {
                type: ["string", "null"],
                description:
                  transitionHandles.length > 0
                    ? `The handle of the first transition condition that is TRUE based on the conversation, or null if none match. Valid handles: ${transitionHandles.map((h) => `"${h}"`).join(", ")}`
                    : "Always null when there are no transitions",
              },
              extractedVariables: {
                type: "object",
                additionalProperties: true,
                description:
                  "Any variables or entities extracted from the user's input (e.g., name, phone number, date). Keys should be variable names, values should be the extracted data.",
              },
            },
            required: [
              "response",
              "matchedTransition",
              "extractedVariables",
            ],
          },
        },
      },
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      tools,
      tool_choice: {
        type: "function",
        function: { name: "process_conversation" },
      },
    });

    console.log(`[Conversation] OpenAI response received`);
    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];

    if (toolCall && toolCall.type === "function" && toolCall.function?.arguments) {
      console.log(`[Conversation] Tool call received, parsing...`);
      const parsed = JSON.parse(toolCall.function.arguments);

      const result: ConversationResult = {
        response:
          parsed.response ||
          "I understand. How can I help you further?",
        matchedTransition: parsed.matchedTransition || null,
        extractedVariables: parsed.extractedVariables || {},
      };

      // Validate matched transition handle
      if (
        result.matchedTransition &&
        !transitionHandles.includes(result.matchedTransition)
      ) {
        console.warn(
          `[Conversation] AI returned invalid transition handle "${result.matchedTransition}", ignoring`
        );
        result.matchedTransition = null;
      }

      console.log(
        `[Conversation] Response: "${result.response.substring(0, 100)}...", transition: ${result.matchedTransition}`
      );
      return result;
    }

    // Fallback to regular content response
    const fallbackResponse =
      completion.choices[0]?.message?.content ||
      "I understand. How can I help you?";
    console.log(
      `[Conversation] Using fallback response: "${fallbackResponse.substring(0, 100)}..."`
    );
    return {
      response: fallbackResponse,
      matchedTransition: null,
      extractedVariables: {},
    };
  } catch (error) {
    console.error("[Conversation] OpenAI error:", error);
    return {
      response: "I apologize, could you please repeat that?",
      matchedTransition: null,
      extractedVariables: {},
    };
  }
}

// ============================================
// Function Node Helpers
// ============================================

/**
 * Execute an HTTP function (GET, POST, PUT, PATCH, DELETE).
 * Substitutes variables in URL, headers, and body.
 * Maps response fields to variables via responseMapping.
 */
async function executeHTTPFunction(
  config: Record<string, unknown>,
  variables: Record<string, unknown>,
  timeout: number
): Promise<{
  success: boolean;
  statusCode: number;
  mappedVariables: Record<string, unknown>;
}> {
  const url = substituteVariables(
    (config.url as string) || "",
    variables
  );
  const method = (config.method as string) || "GET";
  const rawHeaders =
    (config.headers as Record<string, string>) || {};
  const body = config.body
    ? substituteVariables(config.body as string, variables)
    : undefined;
  const responseMapping =
    (config.responseMapping as ResponseMapping[]) || [];

  // Substitute variables in header values
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawHeaders)) {
    headers[key] = substituteVariables(value, variables);
  }

  // Ensure Content-Type is set
  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  console.log(`[Function/HTTP] ${method} ${url}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method,
      headers,
      body: method !== "GET" && method !== "DELETE" ? body : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const statusCode = response.status;
    console.log(`[Function/HTTP] Response status: ${statusCode}`);

    if (!response.ok) {
      console.error(
        `[Function/HTTP] Request failed with status ${statusCode}`
      );
      return { success: false, statusCode, mappedVariables: {} };
    }

    let data: unknown;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Map response fields to variables using dot-path notation
    const mappedVariables: Record<string, unknown> = {};
    for (const mapping of responseMapping) {
      const pathParts = mapping.path.replace(/^\$\.?/, "").split(".");
      let value: unknown = data;
      for (const part of pathParts) {
        if (value && typeof value === "object") {
          // Handle array indexing like "items[0]"
          const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
          if (arrayMatch) {
            value = (value as Record<string, unknown>)[arrayMatch[1]];
            if (Array.isArray(value)) {
              value = value[parseInt(arrayMatch[2], 10)];
            } else {
              value = undefined;
            }
          } else {
            value = (value as Record<string, unknown>)[part];
          }
        } else {
          value = undefined;
          break;
        }
      }
      mappedVariables[mapping.variable] = value;
    }

    // Also store the raw response body
    mappedVariables["_http_response"] = data;

    return { success: true, statusCode, mappedVariables };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.error(`[Function/HTTP] Request timed out after ${timeout}ms`);
    } else {
      console.error("[Function/HTTP] Request error:", error);
    }
    return { success: false, statusCode: 0, mappedVariables: {} };
  }
}

/**
 * Execute sandboxed JavaScript code.
 * Receives input variables and returns a result.
 */
function executeCodeFunction(
  config: Record<string, unknown>,
  variables: Record<string, unknown>
): unknown {
  const code = (config.code as string) || "return null;";
  const inputVariables = (config.inputVariables as string[]) || [];

  const inputs: Record<string, unknown> = {};
  for (const varName of inputVariables) {
    inputs[varName] = variables[varName];
  }

  console.log(
    `[Function/Code] Executing code with inputs: ${inputVariables.join(", ")}`
  );

  try {
    const fn = new Function("inputs", code);
    const result = fn(inputs);
    console.log(`[Function/Code] Execution result:`, result);
    return result;
  } catch (error) {
    console.error("[Function/Code] Execution error:", error);
    return null;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Find the start node ID from a list of nodes.
 */
export function findStartNode(
  nodes: Array<{ id: string; type: string }>
): string {
  const startNode = nodes.find((n) => n.type === "start");
  return startNode?.id || nodes[0]?.id || "";
}

/**
 * Initialize variables with their default values.
 */
export function initializeVariables(
  variables: Array<{ name: string; defaultValue?: unknown }>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const v of variables) {
    result[v.name] = v.defaultValue ?? "";
  }
  return result;
}

/**
 * Find next node from edges by source ID and handle.
 * Tries exact handle match first, then falls back to default handle.
 */
export function findNextNode(
  edges: FlowEdgeData[],
  sourceId: string,
  handle: string
): string | null {
  // Try exact handle match first
  const exactMatch = edges.find(
    (e) => e.source === sourceId && e.sourceHandle === handle
  );
  if (exactMatch) return exactMatch.target;

  // Try default handle
  const defaultMatch = edges.find(
    (e) =>
      e.source === sourceId &&
      (!e.sourceHandle || e.sourceHandle === "default")
  );
  return defaultMatch?.target || null;
}

/**
 * Substitute {{variable}} placeholders in text with their values.
 */
export function substituteVariables(
  text: string,
  variables: Record<string, unknown>
): string {
  if (!text) return "";
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    String(variables[key] ?? "")
  );
}

/**
 * Evaluate a condition against a value using the specified operator.
 * Used by legacy condition patterns and internal checks.
 */
export function evaluateCondition(
  value: unknown,
  operator: string,
  compareValue: unknown
): boolean {
  switch (operator) {
    case "equals":
      return String(value) === String(compareValue);
    case "not_equals":
      return String(value) !== String(compareValue);
    case "contains":
      return String(value)
        .toLowerCase()
        .includes(String(compareValue).toLowerCase());
    case "not_contains":
      return !String(value)
        .toLowerCase()
        .includes(String(compareValue).toLowerCase());
    case "greater_than":
      return Number(value) > Number(compareValue);
    case "less_than":
      return Number(value) < Number(compareValue);
    case "greater_or_equal":
      return Number(value) >= Number(compareValue);
    case "less_or_equal":
      return Number(value) <= Number(compareValue);
    case "is_empty":
      return value === "" || value === null || value === undefined;
    case "is_not_empty":
      return value !== "" && value !== null && value !== undefined;
    case "matches_regex":
      try {
        return new RegExp(String(compareValue)).test(String(value));
      } catch {
        return false;
      }
    default:
      return false;
  }
}
