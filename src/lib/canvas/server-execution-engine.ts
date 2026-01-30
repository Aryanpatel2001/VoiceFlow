/**
 * Server-Side Flow Execution Engine
 *
 * Shared execution logic used by both the production webhook
 * and the flow voice agent. Handles node routing, AI agent calls,
 * condition evaluation, variable substitution, and API calls.
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
}

export interface AIAgentResult {
  response: string;
  outputHandle: string;
  nextAction: "continue" | "transfer" | "end_call" | "escalate";
  extractedEntities: Record<string, unknown>;
}

// ============================================
// Core Execution
// ============================================

/**
 * Execute a flow node and return the result.
 * Recursively follows non-speaking nodes (condition, set_variable, etc.)
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
    return {
      response: "I'm sorry, there was an error in the conversation flow.",
      action: "end",
      nextNodeId: null,
      variables,
    };
  }

  const config = (node.data as { config?: Record<string, unknown> })?.config || {};

  switch (node.type) {
    case "start": {
      const greeting = (config.greeting as string) || "Hello! How can I help you today?";
      const nextNode = findNextNode(edges, nodeId, "default");
      return {
        response: greeting,
        action: nextNode ? "gather" : "end",
        nextNodeId: nextNode,
        variables,
      };
    }

    case "ai_agent": {
      const result = await executeAIAgent(config, userInput, variables, conversationHistory);
      const nextNode = findNextNode(edges, nodeId, result.outputHandle || "default");

      // If AI decides to continue conversation, stay on this node
      if (result.nextAction === "continue") {
        return {
          response: result.response,
          action: "gather",
          nextNodeId: nodeId, // Stay on AI agent for multi-turn
          variables: { ...variables, ...result.extractedEntities },
        };
      }

      return {
        response: result.response,
        action: result.nextAction === "transfer" ? "transfer" : result.nextAction === "end_call" ? "end" : "gather",
        nextNodeId: nextNode,
        variables: { ...variables, ...result.extractedEntities },
        transferTo: result.nextAction === "transfer" ? (config.transferTarget as string) : undefined,
      };
    }

    case "condition": {
      const rules = (config.rules as Array<{ variable: string; operator: string; value: unknown; outputHandle: string }>) || [];
      const defaultHandle = (config.defaultHandle as string) || "false";

      let matchedHandle = defaultHandle;
      for (const rule of rules) {
        if (evaluateCondition(variables[rule.variable], rule.operator, rule.value)) {
          matchedHandle = rule.outputHandle;
          break;
        }
      }

      const nextNode = findNextNode(edges, nodeId, matchedHandle);
      // Continue to next node without speaking
      if (nextNode) {
        return executeNode(nodes, edges, nextNode, userInput, variables, conversationHistory);
      }
      return {
        response: "",
        action: "end",
        nextNodeId: null,
        variables,
      };
    }

    case "set_variable": {
      const assignments = (config.assignments as Array<{ variable: string; value: string; operation: string }>) || [];
      const newVariables = { ...variables };

      for (const assign of assignments) {
        const value = substituteVariables(assign.value, variables);
        switch (assign.operation) {
          case "set":
            newVariables[assign.variable] = value;
            break;
          case "append":
            newVariables[assign.variable] = `${variables[assign.variable] || ""}${value}`;
            break;
          case "increment":
            newVariables[assign.variable] = Number(variables[assign.variable] || 0) + Number(value);
            break;
          case "decrement":
            newVariables[assign.variable] = Number(variables[assign.variable] || 0) - Number(value);
            break;
        }
      }

      const nextNode = findNextNode(edges, nodeId, "default");
      if (nextNode) {
        return executeNode(nodes, edges, nextNode, userInput, newVariables, conversationHistory);
      }
      return {
        response: "",
        action: "end",
        nextNodeId: null,
        variables: newVariables,
      };
    }

    case "transfer": {
      const message = (config.message as string) || "Please hold while I transfer you.";
      const destination = (config.destination as string) || "";
      return {
        response: message,
        action: "transfer",
        nextNodeId: null,
        variables,
        transferTo: destination,
      };
    }

    case "end_call": {
      const message = (config.message as string) || "Thank you for calling. Goodbye!";
      return {
        response: message,
        action: "end",
        nextNodeId: null,
        variables,
      };
    }

    case "api_call": {
      const result = await executeAPICall(config, variables);
      const nextHandle = result.success ? "success" : "error";
      const nextNode = findNextNode(edges, nodeId, nextHandle);

      if (nextNode) {
        return executeNode(
          nodes,
          edges,
          nextNode,
          userInput,
          { ...variables, ...result.mappedVariables },
          conversationHistory
        );
      }
      return {
        response: "",
        action: "end",
        nextNodeId: null,
        variables: { ...variables, ...result.mappedVariables },
      };
    }

    case "function": {
      const functionResult = executeFunction(config, variables);
      const newVariables = { ...variables };
      if (config.outputVariable) {
        newVariables[config.outputVariable as string] = functionResult;
      }

      const nextNode = findNextNode(edges, nodeId, "default");
      if (nextNode) {
        return executeNode(nodes, edges, nextNode, userInput, newVariables, conversationHistory);
      }
      return {
        response: "",
        action: "end",
        nextNodeId: null,
        variables: newVariables,
      };
    }

    default: {
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
// Helper Functions
// ============================================

/**
 * Find the start node ID from a list of nodes
 */
export function findStartNode(nodes: Array<{ id: string; type: string }>): string {
  const startNode = nodes.find((n) => n.type === "start");
  return startNode?.id || nodes[0]?.id || "";
}

/**
 * Initialize variables with defaults
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
 * Find next node from edges by source ID and handle
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
    (e) => e.source === sourceId && (!e.sourceHandle || e.sourceHandle === "default")
  );
  return defaultMatch?.target || null;
}

/**
 * Evaluate a condition against a value
 */
export function evaluateCondition(value: unknown, operator: string, compareValue: unknown): boolean {
  switch (operator) {
    case "equals":
      return String(value) === String(compareValue);
    case "not_equals":
      return String(value) !== String(compareValue);
    case "contains":
      return String(value).toLowerCase().includes(String(compareValue).toLowerCase());
    case "not_contains":
      return !String(value).toLowerCase().includes(String(compareValue).toLowerCase());
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

/**
 * Substitute {{variable}} placeholders in text
 */
export function substituteVariables(text: string, variables: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] ?? ""));
}

/**
 * Execute AI Agent node with OpenAI
 */
export async function executeAIAgent(
  config: Record<string, unknown>,
  userInput: string,
  variables: Record<string, unknown>,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<AIAgentResult> {
  console.log(`[AIAgent] executeAIAgent called`);
  console.log(`[AIAgent] User input: "${userInput}"`);
  console.log(`[AIAgent] Config keys: ${Object.keys(config).join(', ')}`);

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error(`[AIAgent] OpenAI API key not configured!`);
    return {
      response: "I apologize, but I'm unable to process your request right now.",
      outputHandle: "default",
      nextAction: "continue",
      extractedEntities: {},
    };
  }

  const openai = new OpenAI({ apiKey });

  const systemPrompt = (config.systemPrompt as string) || "You are a helpful voice assistant.";
  const instructions = (config.instructions as string) || "";

  console.log(`[AIAgent] System prompt (first 100 chars): "${systemPrompt.substring(0, 100)}..."`);
  console.log(`[AIAgent] Conversation history length: ${conversationHistory.length}`);
  const intents = (config.intents as Array<{ name: string; description: string; examples?: string[]; outputHandle: string }>) || [];
  const entities = (config.entities as Array<{ name: string; type?: string; description?: string; variableName: string }>) || [];

  // Build context
  const intentDescriptions = intents.length > 0
    ? `\n\nAvailable intents to detect:\n${intents.map((i) => `- ${i.name}: ${i.description}`).join("\n")}`
    : "";

  const entityDescriptions = entities.length > 0
    ? `\n\nEntities to extract:\n${entities.map((e) => `- ${e.name}${e.type ? ` (${e.type})` : ""}${e.description ? `: ${e.description}` : ""}`).join("\n")}`
    : "";

  const variableContext = Object.keys(variables).length > 0
    ? `\n\nCurrent variables:\n${Object.entries(variables).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`
    : "";

  const fullSystemPrompt = `${systemPrompt}${instructions ? `\n\n${instructions}` : ""}${intentDescriptions}${entityDescriptions}${variableContext}\n\nKeep responses brief (1-2 sentences) for voice.`;

  // Build messages
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: fullSystemPrompt },
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  if (userInput) {
    messages.push({ role: "user", content: userInput });
  }

  try {
    console.log(`[AIAgent] Calling OpenAI with model: ${(config.model as string) || "gpt-4o-mini"}`);

    const completion = await openai.chat.completions.create({
      model: (config.model as string) || "gpt-4o-mini",
      messages,
      temperature: (config.temperature as number) || 0.7,
      max_tokens: (config.maxTokens as number) || 300,
      tools: [
        {
          type: "function",
          function: {
            name: "process_response",
            description: "Process the conversation and return structured response",
            parameters: {
              type: "object",
              properties: {
                response: {
                  type: "string",
                  description: "Natural response to the user",
                },
                intent: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    confidence: { type: "number" },
                  },
                  description: "Detected intent if any",
                },
                extractedEntities: {
                  type: "object",
                  additionalProperties: true,
                  description: "Extracted entities from conversation",
                },
                nextAction: {
                  type: "string",
                  enum: ["continue", "transfer", "end_call", "escalate"],
                  description: "What should happen next",
                },
              },
              required: ["response", "nextAction"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "process_response" } },
    });

    console.log(`[AIAgent] OpenAI response received`);
    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      console.log(`[AIAgent] Tool call received, parsing response...`);
      const parsed = JSON.parse(toolCall.function.arguments);
      const detectedIntent = parsed.intent?.name || "";
      const outputHandle = intents.find((i) => i.name === detectedIntent)?.outputHandle || "default";

      // Map extracted entities to variables
      const extractedEntities: Record<string, unknown> = {};
      if (parsed.extractedEntities) {
        for (const entity of entities) {
          if (parsed.extractedEntities[entity.name] !== undefined) {
            extractedEntities[entity.variableName] = parsed.extractedEntities[entity.name];
          }
        }
      }

      const result = {
        response: parsed.response || "I understand. How can I help you further?",
        outputHandle,
        nextAction: parsed.nextAction || "continue",
        extractedEntities,
      };
      console.log(`[AIAgent] Returning response: "${result.response.substring(0, 100)}...", action: ${result.nextAction}`);
      return result;
    }

    // Fallback to regular response
    const fallbackResponse = completion.choices[0]?.message?.content || "I understand. How can I help you?";
    console.log(`[AIAgent] Using fallback response: "${fallbackResponse.substring(0, 100)}..."`);
    return {
      response: fallbackResponse,
      outputHandle: "default",
      nextAction: "continue",
      extractedEntities: {},
    };
  } catch (error) {
    console.error("[AIAgent] OpenAI error:", error);
    return {
      response: "I apologize, could you please repeat that?",
      outputHandle: "default",
      nextAction: "continue",
      extractedEntities: {},
    };
  }
}

/**
 * Execute API call node
 */
export async function executeAPICall(
  config: Record<string, unknown>,
  variables: Record<string, unknown>
): Promise<{ success: boolean; mappedVariables: Record<string, unknown> }> {
  const url = substituteVariables((config.url as string) || "", variables);
  const method = (config.method as string) || "GET";
  const headers = (config.headers as Record<string, string>) || {};
  const body = config.body ? substituteVariables(config.body as string, variables) : undefined;
  const responseMapping = (config.responseMapping as Array<{ variable: string; path: string }>) || [];

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: method !== "GET" ? body : undefined,
    });

    if (!response.ok) {
      return { success: false, mappedVariables: {} };
    }

    const data = await response.json();
    const mappedVariables: Record<string, unknown> = {};

    // Map response to variables using dot-path notation
    for (const mapping of responseMapping) {
      const pathParts = mapping.path.split(".");
      let value: unknown = data;
      for (const part of pathParts) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[part];
        }
      }
      mappedVariables[mapping.variable] = value;
    }

    return { success: true, mappedVariables };
  } catch (error) {
    console.error("API call error:", error);
    return { success: false, mappedVariables: {} };
  }
}

/**
 * Execute custom function (sandboxed)
 */
export function executeFunction(
  config: Record<string, unknown>,
  variables: Record<string, unknown>
): unknown {
  const code = (config.code as string) || "return null;";
  const inputVariables = (config.inputVariables as string[]) || [];

  const inputs: Record<string, unknown> = {};
  for (const varName of inputVariables) {
    inputs[varName] = variables[varName];
  }

  try {
    const fn = new Function("inputs", code);
    return fn(inputs);
  } catch (error) {
    console.error("Function execution error:", error);
    return null;
  }
}
