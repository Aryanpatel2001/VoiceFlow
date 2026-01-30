/**
 * Flow Execution Engine
 *
 * Executes flow nodes for testing/simulation purposes.
 * Handles variable substitution, node logic, and conversation flow.
 *
 * @module lib/canvas/execution-engine
 */

import type {
  FlowNode,
  FlowEdge,
  FlowVariable,
  ExecutionState,
  ExecutionResult,
  ExecutionMessage,
  AIAgentConfig,
  ConditionConfig,
  SetVariableConfig,
  APICallConfig,
  EndCallConfig,
  KnowledgeBaseConfig,
  FunctionConfig,
  StartConfig,
  ConditionOperator,
} from "./types";

// ============================================
// Flow Executor Class
// ============================================

export type TestModeType = "simulation" | "live";

export class FlowExecutor {
  private nodes: Map<string, FlowNode>;
  private edges: FlowEdge[];
  private variableDefinitions: FlowVariable[];
  private state: ExecutionState;
  private mode: TestModeType;
  private conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;

  constructor(
    nodes: FlowNode[],
    edges: FlowEdge[],
    variables: FlowVariable[],
    mode: TestModeType = "simulation"
  ) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]));
    this.edges = edges;
    this.variableDefinitions = variables;
    this.mode = mode;
    this.conversationHistory = [];

    // Initialize state
    const startNode = nodes.find((n) => n.type === "start");
    this.state = {
      currentNodeId: startNode?.id || "",
      variables: this.initializeVariables(variables),
      messages: [],
      status: "running",
    };
  }

  /**
   * Initialize variables with default values
   */
  private initializeVariables(variables: FlowVariable[]): Record<string, unknown> {
    const vars: Record<string, unknown> = {};
    for (const v of variables) {
      vars[v.name] = v.defaultValue ?? this.getDefaultForType(v.type);
    }
    return vars;
  }

  private getDefaultForType(type: string): unknown {
    switch (type) {
      case "string":
        return "";
      case "number":
        return 0;
      case "boolean":
        return false;
      case "array":
        return [];
      case "object":
        return {};
      default:
        return null;
    }
  }

  /**
   * Get current execution state (deep cloned to prevent external freezing)
   */
  getState(): ExecutionState {
    // Deep clone to prevent Immer from freezing our internal state
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Reset execution to start
   */
  reset(): void {
    const startNode = Array.from(this.nodes.values()).find((n) => n.type === "start");
    this.state = {
      currentNodeId: startNode?.id || "",
      variables: this.initializeVariables(this.variableDefinitions),
      messages: [],
      status: "running",
    };
    this.conversationHistory = [];
  }

  /**
   * Execute the current node and advance
   */
  async executeCurrentNode(userInput?: string): Promise<ExecutionResult> {
    if (this.state.status !== "running" && this.state.status !== "waiting_input") {
      return {
        nextNodeId: null,
        variableUpdates: {},
        error: "Execution has ended",
      };
    }

    const node = this.nodes.get(this.state.currentNodeId);
    if (!node) {
      this.state.status = "error";
      this.state.error = "Current node not found";
      return {
        nextNodeId: null,
        variableUpdates: {},
        error: "Node not found",
      };
    }

    // Store user input in variables
    if (userInput) {
      this.state.variables["user_input"] = userInput;
      this.addMessage("user", userInput, node.id);
    }

    try {
      const result = await this.executeNode(node, userInput);

      // Apply variable updates
      for (const [key, value] of Object.entries(result.variableUpdates)) {
        this.state.variables[key] = value;
      }

      // Add agent output as message
      if (result.output) {
        this.addMessage("agent", result.output, node.id);
      }

      // Advance to next node
      if (result.nextNodeId) {
        this.state.currentNodeId = result.nextNodeId;
        const nextNode = this.nodes.get(result.nextNodeId);

        // Check if next node is terminal
        if (nextNode?.type === "end_call" || nextNode?.type === "transfer") {
          // Execute terminal node
          const terminalResult = await this.executeNode(nextNode);
          if (terminalResult.output) {
            this.addMessage("agent", terminalResult.output, nextNode.id);
          }
          this.state.status = "completed";
        } else {
          this.state.status = "waiting_input";
        }
      } else {
        this.state.status = "completed";
      }

      return result;
    } catch (error) {
      this.state.status = "error";
      this.state.error = error instanceof Error ? error.message : "Unknown error";
      return {
        nextNodeId: null,
        variableUpdates: {},
        error: this.state.error,
      };
    }
  }

  /**
   * Execute a specific node
   */
  private async executeNode(node: FlowNode, userInput?: string): Promise<ExecutionResult> {
    switch (node.type) {
      case "start":
        return this.executeStart(node);
      case "ai_agent":
        return this.executeAIAgent(node, userInput);
      case "condition":
        return this.executeCondition(node);
      case "set_variable":
        return this.executeSetVariable(node);
      case "api_call":
        return this.executeAPICall(node);
      case "end_call":
        return this.executeEndCall(node);
      case "knowledge_base":
        return this.executeKnowledgeBase(node);
      case "function":
        return this.executeFunction(node);
      case "transfer":
        return this.executeTransfer(node);
      default:
        return {
          nextNodeId: this.getNextNodeId(node.id),
          variableUpdates: {},
        };
    }
  }

  /**
   * Execute Start node
   */
  private executeStart(node: FlowNode): ExecutionResult {
    const config = node.data.config as StartConfig;

    // Set initial variables
    const variableUpdates: Record<string, unknown> = {};
    if (config.initialVariables) {
      Object.assign(variableUpdates, config.initialVariables);
    }

    return {
      output: this.substituteVariables(config.greeting || "Hello!"),
      nextNodeId: this.getNextNodeId(node.id),
      variableUpdates,
    };
  }

  /**
   * Execute AI Agent node
   */
  private async executeAIAgent(node: FlowNode, userInput?: string): Promise<ExecutionResult> {
    const config = node.data.config as AIAgentConfig;

    // Live mode - use real OpenAI
    if (this.mode === "live") {
      return this.executeAIAgentLive(node, config, userInput);
    }

    // Simulation mode - use pattern matching for intents
    const intents = config.intents || [];
    const input = (userInput || "").toLowerCase();

    // Try to match intent based on examples
    let matchedIntent: typeof intents[0] | null = null;
    if (intents.length > 0 && userInput) {
      for (const intent of intents) {
        // Check if user input contains any of the intent's example phrases
        const examples = intent.examples || [];
        for (const example of examples) {
          if (input.includes(example.toLowerCase())) {
            matchedIntent = intent;
            break;
          }
        }
        if (matchedIntent) break;

        // Also check if input contains the intent name or description keywords
        if (input.includes(intent.name.toLowerCase())) {
          matchedIntent = intent;
          break;
        }
      }
    }

    // If intent matched, route to that intent's output handle
    if (matchedIntent) {
      const response = `I understand you want ${matchedIntent.name}. Let me help you with that.`;
      const nextNodeId = this.getNextNodeIdForHandle(node.id, matchedIntent.outputHandle);

      return {
        output: this.substituteVariables(response),
        nextNodeId: nextNodeId || this.getNextNodeId(node.id),
        variableUpdates: {
          _detected_intent: matchedIntent.name,
          _intent_confidence: 0.8,
        },
      };
    }

    // No intent matched - stay on this node for multi-turn conversation
    // Generate a contextual response asking for more information
    const simulatedResponse = this.simulateFreeformResponse(config, userInput);

    // AI Agents support multi-turn conversation by default
    // Stay on current node and keep the conversation going
    // Only advance to next node if user explicitly triggers an action

    // Check for exit phrases that should end the conversation
    const exitPhrases = ["bye", "goodbye", "thanks", "thank you", "that's all", "nothing else", "no thanks"];
    const shouldExit = exitPhrases.some(phrase => input.includes(phrase));

    if (shouldExit) {
      // User wants to end - go to next node
      return {
        output: "Thank you! Is there anything else I can help you with?",
        nextNodeId: this.getNextNodeId(node.id),
        variableUpdates: {},
      };
    }

    // Stay on current node for continued conversation
    return {
      output: this.substituteVariables(simulatedResponse),
      nextNodeId: node.id, // Loop back to self
      variableUpdates: {},
    };
  }

  /**
   * Execute AI Agent with real OpenAI API
   * Uses structured output for intent detection and entity extraction
   */
  private async executeAIAgentLive(
    node: FlowNode,
    config: AIAgentConfig,
    userInput?: string
  ): Promise<ExecutionResult> {
    // Build system prompt from node config
    const systemPrompt = config.systemPrompt || config.prompt || "You are a helpful AI voice assistant.";
    const instructions = config.instructions;

    // Get intents and entities from config
    const intents = config.intents || [];
    const entities = config.entities || [];

    try {
      const response = await fetch("/api/canvas/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInput || "Hello",
          systemPrompt,
          instructions,
          conversationHistory: this.conversationHistory,
          variables: this.state.variables,
          intents,
          entities,
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens || 300,
          model: config.model || "gpt-4o-mini",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get AI response");
      }

      const data = await response.json();
      const aiResponse = data.response || "I'm sorry, I couldn't generate a response.";
      const detectedIntent = data.intent || { name: "unknown", confidence: 0 };
      const extractedEntities = data.extractedEntities || {};
      const nextAction = data.nextAction || "continue";

      // Update conversation history
      if (userInput) {
        this.conversationHistory.push({ role: "user", content: userInput });
      }
      this.conversationHistory.push({ role: "assistant", content: aiResponse });

      // Build variable updates from extracted entities
      const variableUpdates: Record<string, unknown> = {};

      // Map extracted entities to variables
      for (const entity of entities) {
        if (extractedEntities[entity.name] !== undefined) {
          variableUpdates[entity.variableName] = extractedEntities[entity.name];
        }
      }

      // Store intent in variables for condition nodes
      variableUpdates["_detected_intent"] = detectedIntent.name;
      variableUpdates["_intent_confidence"] = detectedIntent.confidence;

      // Determine next node based on intent
      let nextNodeId: string | null = null;

      // First, check if intent maps to a specific output handle
      if (intents.length > 0 && detectedIntent.name !== "unknown") {
        const matchingIntent = intents.find((i) => i.name === detectedIntent.name);
        if (matchingIntent?.outputHandle) {
          nextNodeId = this.getNextNodeIdForHandle(node.id, matchingIntent.outputHandle);
        }
      }

      // If no intent-based routing, check for action-based routing
      if (!nextNodeId) {
        switch (nextAction) {
          case "transfer":
            nextNodeId = this.getNextNodeIdForHandle(node.id, "transfer") || this.getNextNodeId(node.id);
            break;
          case "end_call":
            nextNodeId = this.getNextNodeIdForHandle(node.id, "end") || this.getNextNodeId(node.id);
            break;
          case "escalate":
            nextNodeId = this.getNextNodeIdForHandle(node.id, "escalate") || this.getNextNodeId(node.id);
            break;
          default:
            nextNodeId = this.getNextNodeId(node.id);
        }
      }

      return {
        output: this.substituteVariables(aiResponse),
        nextNodeId,
        variableUpdates,
        action: nextAction,
      };
    } catch (error) {
      console.error("Live AI error:", error);
      const fallbackResponse = error instanceof Error
        ? `[AI Error: ${error.message}]`
        : "I'm having trouble connecting. Please try again.";

      return {
        output: fallbackResponse,
        nextNodeId: this.getNextNodeId(node.id),
        variableUpdates: {},
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private simulateFreeformResponse(config: AIAgentConfig, userInput?: string): string {
    const systemPrompt = config.systemPrompt || config.prompt || "";
    const instructions = config.instructions || "";
    const input = (userInput || "").toLowerCase();

    if (!userInput) {
      return "How can I help you today?";
    }

    // Check for greetings
    const greetings = ["hi", "hello", "hey", "hy", "good morning", "good afternoon"];
    if (greetings.some(g => input === g || input.startsWith(g + " "))) {
      return "Hello! How can I assist you today?";
    }

    // Check for questions about identity
    if (input.includes("your name") || input.includes("who are you")) {
      return "I'm an AI assistant here to help you. What can I do for you today?";
    }

    // Check for "how are you" type questions
    if (input.includes("how are you") || input.includes("how's it going")) {
      return "I'm doing well, thank you for asking! How can I help you today?";
    }

    // Check context from system prompt/instructions for relevant responses
    const context = (systemPrompt + " " + instructions).toLowerCase();

    if (context.includes("medical") || context.includes("healthcare") || context.includes("doctor")) {
      if (input.includes("appointment") || input.includes("schedule") || input.includes("book")) {
        return "I'd be happy to help you schedule an appointment. Could you tell me your name and what type of appointment you need?";
      }
      if (input.includes("sick") || input.includes("pain") || input.includes("symptom")) {
        return "I'm sorry to hear you're not feeling well. Can you describe your symptoms so I can help direct you to the right care?";
      }
    }

    if (context.includes("schedule") || context.includes("appointment") || context.includes("booking")) {
      return "I'd be happy to help with scheduling. Could you tell me what date and time works best for you?";
    }

    if (context.includes("collect") && context.includes("name")) {
      return "Could you please tell me your name?";
    }

    // Default helpful response
    return "I understand. Could you tell me more about what you need help with?";
  }

  /**
   * Execute Condition node
   */
  private executeCondition(node: FlowNode): ExecutionResult {
    const config = node.data.config as ConditionConfig;

    // Evaluate rules in order
    for (const rule of config.rules) {
      const variableValue = this.state.variables[rule.variable];
      const matches = this.evaluateCondition(variableValue, rule.operator, rule.value);

      if (matches) {
        const nextNodeId = this.getNextNodeIdForHandle(node.id, rule.outputHandle);
        return {
          nextNodeId,
          variableUpdates: {},
        };
      }
    }

    // No rule matched, use default
    const defaultNextId = this.getNextNodeIdForHandle(node.id, config.defaultHandle);
    return {
      nextNodeId: defaultNextId,
      variableUpdates: {},
    };
  }

  private evaluateCondition(value: unknown, operator: ConditionOperator, compareValue: unknown): boolean {
    switch (operator) {
      case "equals":
        return value === compareValue;
      case "not_equals":
        return value !== compareValue;
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
        return !value || (Array.isArray(value) && value.length === 0) || value === "";
      case "is_not_empty":
        return !!value && !(Array.isArray(value) && value.length === 0) && value !== "";
      case "matches_regex":
        try {
          return new RegExp(String(compareValue)).test(String(value));
        } catch {
          return false;
        }
      case "sentiment_positive":
        // Simplified sentiment check
        return this.analyzeSentiment(String(value)) === "positive";
      case "sentiment_negative":
        return this.analyzeSentiment(String(value)) === "negative";
      case "sentiment_neutral":
        return this.analyzeSentiment(String(value)) === "neutral";
      default:
        return false;
    }
  }

  private analyzeSentiment(text: string): "positive" | "negative" | "neutral" {
    const lower = text.toLowerCase();
    const positiveWords = ["great", "good", "excellent", "happy", "love", "thank", "yes", "please", "wonderful"];
    const negativeWords = ["bad", "terrible", "hate", "angry", "frustrated", "no", "never", "worst", "awful"];

    let score = 0;
    for (const word of positiveWords) {
      if (lower.includes(word)) score++;
    }
    for (const word of negativeWords) {
      if (lower.includes(word)) score--;
    }

    if (score > 0) return "positive";
    if (score < 0) return "negative";
    return "neutral";
  }

  /**
   * Execute Set Variable node
   */
  private executeSetVariable(node: FlowNode): ExecutionResult {
    const config = node.data.config as SetVariableConfig;
    const variableUpdates: Record<string, unknown> = {};

    for (const assignment of config.assignments) {
      const value = this.substituteVariables(assignment.value);
      const currentValue = this.state.variables[assignment.variable];

      switch (assignment.operation) {
        case "set":
          variableUpdates[assignment.variable] = value;
          break;
        case "append":
          variableUpdates[assignment.variable] = String(currentValue || "") + String(value);
          break;
        case "increment":
          variableUpdates[assignment.variable] = Number(currentValue || 0) + Number(value || 1);
          break;
        case "decrement":
          variableUpdates[assignment.variable] = Number(currentValue || 0) - Number(value || 1);
          break;
      }
    }

    return {
      nextNodeId: this.getNextNodeId(node.id),
      variableUpdates,
    };
  }

  /**
   * Execute API Call node (simulated for testing)
   */
  private async executeAPICall(node: FlowNode): Promise<ExecutionResult> {
    const config = node.data.config as APICallConfig;

    // In test mode, simulate API response
    // In production, this would make actual HTTP requests
    const simulatedResponse = {
      success: true,
      data: {
        slots: ["9:00 AM", "2:00 PM", "4:30 PM"],
        technician: "John Smith",
      },
    };

    const variableUpdates: Record<string, unknown> = {};
    for (const mapping of config.responseMapping) {
      // Simple JSONPath simulation
      const path = mapping.path.replace("$.", "");
      const parts = path.split(".");
      let value: unknown = simulatedResponse.data;
      for (const part of parts) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[part];
        }
      }
      variableUpdates[mapping.variable] = value;
    }

    // Randomly succeed or fail for testing
    const success = Math.random() > 0.2; // 80% success rate
    const handle = success ? "success" : (config.errorHandle || "error");

    return {
      nextNodeId: this.getNextNodeIdForHandle(node.id, handle),
      variableUpdates: success ? variableUpdates : {},
    };
  }

  /**
   * Execute End Call node
   */
  private executeEndCall(node: FlowNode): ExecutionResult {
    const config = node.data.config as EndCallConfig;

    return {
      output: this.substituteVariables(config.message || "Goodbye!"),
      nextNodeId: null,
      variableUpdates: {},
    };
  }

  /**
   * Execute Transfer node
   */
  private executeTransfer(node: FlowNode): ExecutionResult {
    const config = node.data.config as { message?: string };

    return {
      output: this.substituteVariables(config.message || "Transferring you now..."),
      nextNodeId: null,
      variableUpdates: {},
      action: "transfer",
    };
  }

  /**
   * Execute Knowledge Base node (simulated)
   */
  private executeKnowledgeBase(node: FlowNode): ExecutionResult {
    const config = node.data.config as KnowledgeBaseConfig;

    // Simulate knowledge base search
    const query = this.substituteVariables(config.query);

    // Randomly return results or not
    const hasResults = Math.random() > 0.3; // 70% chance of results

    if (hasResults) {
      const variableUpdates: Record<string, unknown> = {
        [config.outputVariable]: [
          { content: `Here's what I found about "${query}"...`, score: 0.85 },
          { content: "Additional relevant information...", score: 0.72 },
        ],
      };
      return {
        nextNodeId: this.getNextNodeIdForHandle(node.id, "found"),
        variableUpdates,
      };
    } else {
      return {
        nextNodeId: this.getNextNodeIdForHandle(node.id, config.noResultsHandle || "no_results"),
        variableUpdates: { [config.outputVariable]: [] },
      };
    }
  }

  /**
   * Execute Function node (sandboxed)
   */
  private executeFunction(node: FlowNode): ExecutionResult {
    const config = node.data.config as FunctionConfig;

    try {
      // Build inputs object
      const inputs: Record<string, unknown> = {};
      for (const varName of config.inputVariables) {
        inputs[varName] = this.state.variables[varName];
      }

      // Execute in sandbox (simplified - in production use vm2 or similar)
      const fn = new Function("inputs", config.code);
      const result = fn(inputs);

      return {
        nextNodeId: this.getNextNodeId(node.id),
        variableUpdates: {
          [config.outputVariable]: result,
        },
      };
    } catch (error) {
      return {
        nextNodeId: this.getNextNodeId(node.id),
        variableUpdates: {
          [config.outputVariable]: null,
        },
        error: error instanceof Error ? error.message : "Function execution failed",
      };
    }
  }

  /**
   * Get next node ID from default output
   */
  private getNextNodeId(nodeId: string): string | null {
    const edge = this.edges.find(
      (e) => e.source === nodeId && (!e.sourceHandle || e.sourceHandle === "default")
    );
    return edge?.target || null;
  }

  /**
   * Get next node ID for specific output handle
   */
  private getNextNodeIdForHandle(nodeId: string, handle: string): string | null {
    const edge = this.edges.find(
      (e) => e.source === nodeId && e.sourceHandle === handle
    );
    return edge?.target || this.getNextNodeId(nodeId);
  }

  /**
   * Substitute variables in template string
   */
  private substituteVariables(template: string): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*(?:\[\d+\])?(?:\.\w+)*)\}\}/g, (match, path) => {
      try {
        const parts = path.split(/\.|\[|\]/).filter(Boolean);
        let value: unknown = this.state.variables;

        for (const part of parts) {
          if (value && typeof value === "object") {
            value = (value as Record<string, unknown>)[part];
          } else {
            return match;
          }
        }

        return value !== undefined && value !== null ? String(value) : match;
      } catch {
        return match;
      }
    });
  }

  /**
   * Add message to conversation
   */
  private addMessage(role: "agent" | "user" | "system", text: string, nodeId?: string): void {
    const message: ExecutionMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      role,
      text,
      timestamp: new Date(),
      nodeId,
    };
    this.state.messages.push(message);
  }
}

// ============================================
// Helper: Create Executor from Flow
// ============================================

export function createExecutor(
  nodes: FlowNode[],
  edges: FlowEdge[],
  variables: FlowVariable[]
): FlowExecutor {
  return new FlowExecutor(nodes, edges, variables);
}
