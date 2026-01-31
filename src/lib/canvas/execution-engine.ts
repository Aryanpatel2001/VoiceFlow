/**
 * Flow Execution Engine
 *
 * Executes flow nodes for testing/simulation purposes.
 * Handles variable substitution, node logic, and conversation flow.
 *
 * Node types: start, conversation, function, call_transfer, set_variable, end
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
  StartConfig,
  ConversationConfig,
  FunctionConfig,
  CallTransferConfig,
  SetVariableConfig,
  EndConfig,
  ContentConfig,
  TransitionCondition,
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

    // Store user input in variables and add message
    if (userInput) {
      this.state.variables["user_input"] = userInput;
      this.addMessage("user", userInput, node.id);
      this.conversationHistory.push({ role: "user", content: userInput });
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
        this.conversationHistory.push({ role: "assistant", content: result.output });
      }

      // Advance to next node
      if (result.nextNodeId) {
        this.state.currentNodeId = result.nextNodeId;
        const nextNode = this.nodes.get(result.nextNodeId);

        // Check if next node is terminal
        if (nextNode?.type === "end" || nextNode?.type === "call_transfer") {
          // Execute terminal node immediately
          const terminalResult = await this.executeNode(nextNode);
          if (terminalResult.output) {
            this.addMessage("agent", terminalResult.output, nextNode.id);
            this.conversationHistory.push({ role: "assistant", content: terminalResult.output });
          }
          // Apply any terminal variable updates
          for (const [key, value] of Object.entries(terminalResult.variableUpdates)) {
            this.state.variables[key] = value;
          }
          this.state.status = "completed";
        } else if (nextNode?.type === "set_variable") {
          // Silent nodes auto-advance: execute immediately and keep going
          this.state.status = "running";
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
   * Execute a specific node based on its type
   */
  private async executeNode(node: FlowNode, userInput?: string): Promise<ExecutionResult> {
    switch (node.type) {
      case "start":
        return this.executeStart(node);
      case "conversation":
        return this.executeConversation(node, userInput);
      case "function":
        return this.executeFunction(node);
      case "call_transfer":
        return this.executeCallTransfer(node);
      case "set_variable":
        return this.executeSetVariable(node);
      case "end":
        return this.executeEnd(node);
      default:
        return {
          nextNodeId: this.getNextNodeId(node.id),
          variableUpdates: {},
        };
    }
  }

  // ============================================
  // Node Executors
  // ============================================

  /**
   * Execute Start node
   *
   * If speaksFirst is true, output the greeting content.
   * Static mode outputs content directly; prompt mode simulates a response.
   * Always follows the default output edge.
   */
  private executeStart(node: FlowNode): ExecutionResult {
    const config = node.data.config as StartConfig;

    let output: string | undefined;

    if (config.speaksFirst && config.greeting) {
      output = this.resolveContent(config.greeting);
    }

    return {
      output,
      nextNodeId: this.getNextNodeId(node.id),
      variableUpdates: {},
    };
  }

  /**
   * Execute Conversation node
   *
   * The main dialogue node that handles AI conversation.
   *
   * Flow:
   * 1. If no user input yet, output the node's content (prompt or static) and wait.
   * 2. Once user responds, evaluate transitions:
   *    - Equation transitions first (top-to-bottom)
   *    - Prompt transitions second (top-to-bottom)
   *    - First TRUE transition wins; follow its edge
   *    - If nothing matches, loop back to this node
   * 3. If skipResponse is true, advance immediately without waiting for input.
   */
  private async executeConversation(node: FlowNode, userInput?: string): Promise<ExecutionResult> {
    const config = node.data.config as ConversationConfig;

    // If skipResponse is set, advance immediately without waiting for user input
    if (config.skipResponse) {
      const output = this.resolveContent(config.content);
      const nextNodeId = this.evaluateTransitions(node.id, config.transitions, userInput);
      return {
        output,
        nextNodeId: nextNodeId || this.getNextNodeId(node.id) || node.id,
        variableUpdates: {},
      };
    }

    // No user input yet: output the node's content and wait for input
    if (!userInput) {
      let output: string;

      if (config.content.mode === "static") {
        output = this.substituteVariables(config.content.content);
      } else {
        // Prompt mode
        if (this.mode === "live") {
          output = await this.callChatAPI(config.content.content, config);
        } else {
          output = this.simulatePromptResponse(config.content.content);
        }
      }

      return {
        output,
        nextNodeId: node.id, // Stay on this node, waiting for user input
        variableUpdates: {},
      };
    }

    // User has responded: evaluate transitions to determine where to go next
    const nextNodeId = await this.evaluateTransitionsAsync(node.id, config.transitions, userInput);

    if (nextNodeId) {
      // A transition matched; follow that edge
      return {
        nextNodeId,
        variableUpdates: {},
      };
    }

    // No transition matched: loop back to this node and generate a contextual response
    let output: string;

    if (this.mode === "live") {
      output = await this.callChatAPI(config.content.content, config, userInput);
    } else {
      output = this.simulateConversationResponse(config, userInput);
    }

    return {
      output,
      nextNodeId: node.id, // Stay on current node
      variableUpdates: {},
    };
  }

  /**
   * Execute Function node
   *
   * HTTP mode: simulate response in test, could make actual request in live.
   * Code mode: execute sandboxed JavaScript.
   * If speakDuringExecution is set, output that speech first.
   * After execution, evaluate transitions.
   */
  private async executeFunction(node: FlowNode): Promise<ExecutionResult> {
    const config = node.data.config as FunctionConfig;

    // Output speech during execution if configured
    let output: string | undefined;
    if (config.speakDuringExecution) {
      output = this.resolveContent(config.speakDuringExecution);
    }

    const variableUpdates: Record<string, unknown> = {};

    if (config.executionType === "http") {
      // HTTP execution
      if (this.mode === "live" && config.url) {
        try {
          const url = this.substituteVariables(config.url);
          const headers: Record<string, string> = {};
          if (config.headers) {
            for (const [key, value] of Object.entries(config.headers)) {
              headers[key] = this.substituteVariables(value);
            }
          }

          const fetchOptions: RequestInit = {
            method: config.method || "GET",
            headers,
          };

          if (config.body && config.method !== "GET") {
            fetchOptions.body = this.substituteVariables(config.body);
          }

          const response = await fetch(url, fetchOptions);
          const data = await response.json();

          // Apply response mappings
          if (config.responseMapping) {
            for (const mapping of config.responseMapping) {
              const value = this.extractJsonPath(data, mapping.path);
              variableUpdates[mapping.variable] = value;
            }
          }

          variableUpdates["_function_status"] = response.ok ? "success" : "error";
          variableUpdates["_function_status_code"] = response.status;
        } catch (error) {
          variableUpdates["_function_status"] = "error";
          variableUpdates["_function_error"] = error instanceof Error ? error.message : "HTTP request failed";
        }
      } else {
        // Simulation mode: simulate an HTTP response
        const simulatedData = {
          success: true,
          data: {
            result: "simulated_value",
            items: ["item_1", "item_2", "item_3"],
            count: 3,
          },
        };

        if (config.responseMapping) {
          for (const mapping of config.responseMapping) {
            const value = this.extractJsonPath(simulatedData, mapping.path);
            variableUpdates[mapping.variable] = value;
          }
        }

        variableUpdates["_function_status"] = "success";
      }
    } else if (config.executionType === "code") {
      // Code execution (sandboxed)
      try {
        const inputs: Record<string, unknown> = {};
        if (config.inputVariables) {
          for (const varName of config.inputVariables) {
            inputs[varName] = this.state.variables[varName];
          }
        }

        // Execute in sandbox (simplified - in production use vm2 or similar)
        const fn = new Function("inputs", config.code || "return null;");
        const result = fn(inputs);

        if (config.outputVariable) {
          variableUpdates[config.outputVariable] = result;
        }
        variableUpdates["_function_status"] = "success";
      } catch (error) {
        if (config.outputVariable) {
          variableUpdates[config.outputVariable] = null;
        }
        variableUpdates["_function_status"] = "error";
        variableUpdates["_function_error"] = error instanceof Error ? error.message : "Code execution failed";
      }
    }

    // Evaluate transitions after execution
    const nextNodeId = this.evaluateTransitions(node.id, config.transitions);

    return {
      output,
      nextNodeId: nextNodeId || this.getNextNodeId(node.id),
      variableUpdates,
      error: variableUpdates["_function_error"] as string | undefined,
    };
  }

  /**
   * Execute Call Transfer node
   *
   * Outputs a transfer message and ends the flow.
   */
  private executeCallTransfer(node: FlowNode): ExecutionResult {
    const config = node.data.config as CallTransferConfig;
    const destination = this.substituteVariables(config.destination);

    return {
      output: `Transferring you now...`,
      nextNodeId: null,
      variableUpdates: {
        _transfer_destination: destination,
        _transfer_type: config.transferType,
      },
      action: "transfer",
    };
  }

  /**
   * Execute Set Variable node
   *
   * Applies variable assignments silently, then follows the default output edge.
   * Produces no output.
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
   * Execute End node
   *
   * Outputs an optional farewell message and ends the flow.
   */
  private executeEnd(node: FlowNode): ExecutionResult {
    const config = node.data.config as EndConfig;

    let output: string | undefined;
    if (config.speakDuringExecution) {
      output = this.resolveContent(config.speakDuringExecution);
    }

    return {
      output,
      nextNodeId: null,
      variableUpdates: {},
    };
  }

  // ============================================
  // Content Resolution
  // ============================================

  /**
   * Resolve a ContentConfig to a string.
   * Static mode: substitute variables and return directly.
   * Prompt mode: simulate a response based on the prompt.
   */
  private resolveContent(content: ContentConfig): string {
    if (content.mode === "static") {
      return this.substituteVariables(content.content);
    }

    // Prompt mode: simulate a response
    return this.simulatePromptResponse(content.content);
  }

  /**
   * Simulate a response for prompt-mode content.
   * In simulation mode, generates a plausible response based on the prompt text.
   */
  private simulatePromptResponse(prompt: string): string {
    const lower = prompt.toLowerCase();

    // Try to generate a contextual response based on the prompt content
    if (lower.includes("greet") || lower.includes("welcome") || lower.includes("hello")) {
      return "Hello! How can I help you today?";
    }

    if (lower.includes("name") && (lower.includes("ask") || lower.includes("collect") || lower.includes("get"))) {
      return "Could you please tell me your name?";
    }

    if (lower.includes("appointment") || lower.includes("schedule") || lower.includes("book")) {
      return "I'd be happy to help you schedule an appointment. What date and time work best for you?";
    }

    if (lower.includes("confirm") || lower.includes("verify")) {
      return "Let me confirm those details for you. Is everything correct?";
    }

    if (lower.includes("thank") || lower.includes("goodbye") || lower.includes("farewell")) {
      return "Thank you for your time! Have a great day.";
    }

    if (lower.includes("help") || lower.includes("assist")) {
      return "I'm here to help. What can I do for you?";
    }

    // Default: generate a generic response from the prompt
    return "I understand. How can I assist you further?";
  }

  // ============================================
  // Transition Evaluation
  // ============================================

  /**
   * Evaluate transitions synchronously (for non-prompt or simulation mode).
   *
   * Equation transitions are evaluated FIRST, top-to-bottom.
   * Prompt transitions are evaluated AFTER, top-to-bottom.
   * First TRUE transition wins.
   * Returns the next node ID, or null if no transition matched.
   */
  private evaluateTransitions(
    nodeId: string,
    transitions: TransitionCondition[],
    userInput?: string
  ): string | null {
    // Separate equation and prompt transitions, preserving order within each group
    const equationTransitions = transitions.filter((t) => t.type === "equation");
    const promptTransitions = transitions.filter((t) => t.type === "prompt");

    // Evaluate equation transitions first
    for (const transition of equationTransitions) {
      if (this.evaluateEquationCondition(transition.condition)) {
        const nextNodeId = this.getNextNodeIdForHandle(nodeId, transition.handle);
        if (nextNodeId) return nextNodeId;
      }
    }

    // Evaluate prompt transitions (simulation mode: keyword matching)
    for (const transition of promptTransitions) {
      if (this.evaluatePromptConditionSimulated(transition.condition, userInput)) {
        const nextNodeId = this.getNextNodeIdForHandle(nodeId, transition.handle);
        if (nextNodeId) return nextNodeId;
      }
    }

    return null;
  }

  /**
   * Evaluate transitions asynchronously (supports live mode AI-based prompt evaluation).
   */
  private async evaluateTransitionsAsync(
    nodeId: string,
    transitions: TransitionCondition[],
    userInput?: string
  ): Promise<string | null> {
    // Separate equation and prompt transitions, preserving order within each group
    const equationTransitions = transitions.filter((t) => t.type === "equation");
    const promptTransitions = transitions.filter((t) => t.type === "prompt");

    // Evaluate equation transitions first (synchronous)
    for (const transition of equationTransitions) {
      if (this.evaluateEquationCondition(transition.condition)) {
        const nextNodeId = this.getNextNodeIdForHandle(nodeId, transition.handle);
        if (nextNodeId) return nextNodeId;
      }
    }

    // Evaluate prompt transitions
    for (const transition of promptTransitions) {
      let matched = false;

      if (this.mode === "live" && userInput) {
        matched = await this.evaluatePromptConditionLive(transition.condition, userInput);
      } else {
        matched = this.evaluatePromptConditionSimulated(transition.condition, userInput);
      }

      if (matched) {
        const nextNodeId = this.getNextNodeIdForHandle(nodeId, transition.handle);
        if (nextNodeId) return nextNodeId;
      }
    }

    return null;
  }

  /**
   * Evaluate an equation transition condition.
   *
   * Parses conditions in the format: "{{variable}} operator value"
   * Supported operators: exists, not_exists, equals, not_equals,
   *   contains, not_contains, greater_than, less_than, greater_or_equal, less_or_equal
   */
  private evaluateEquationCondition(condition: string): boolean {
    const substituted = this.substituteVariables(condition);

    // Pattern: "{{variable}} operator value" or just "{{variable}} exists"
    // After substitution, variable refs are replaced with their values.
    // We need to parse the ORIGINAL condition to extract variable name and operator.

    // Try to parse: {{varName}} operator [value]
    const matchFull = condition.match(
      /^\{\{(\w+(?:\.\w+)*)\}\}\s+(equals|not_equals|contains|not_contains|greater_than|less_than|greater_or_equal|less_or_equal)\s+(.+)$/
    );
    if (matchFull) {
      const [, varPath, operator, compareValueRaw] = matchFull;
      const variableValue = this.resolveVariablePath(varPath);
      const compareValue = this.substituteVariables(compareValueRaw.trim());
      return this.evaluateOperator(variableValue, operator, compareValue);
    }

    // Try to parse: {{varName}} exists / not_exists
    const matchExistence = condition.match(
      /^\{\{(\w+(?:\.\w+)*)\}\}\s+(exists|not_exists)$/
    );
    if (matchExistence) {
      const [, varPath, operator] = matchExistence;
      const variableValue = this.resolveVariablePath(varPath);

      if (operator === "exists") {
        return variableValue !== undefined && variableValue !== null && variableValue !== "";
      }
      return variableValue === undefined || variableValue === null || variableValue === "";
    }

    // Fallback: try evaluating the fully substituted string as a simple truthy check
    if (substituted === "true") return true;
    if (substituted === "false") return false;

    return false;
  }

  /**
   * Evaluate a comparison operator between two values.
   */
  private evaluateOperator(value: unknown, operator: string, compareValue: string): boolean {
    switch (operator) {
      case "equals":
        return String(value) === compareValue;
      case "not_equals":
        return String(value) !== compareValue;
      case "contains":
        return String(value).toLowerCase().includes(compareValue.toLowerCase());
      case "not_contains":
        return !String(value).toLowerCase().includes(compareValue.toLowerCase());
      case "greater_than":
        return Number(value) > Number(compareValue);
      case "less_than":
        return Number(value) < Number(compareValue);
      case "greater_or_equal":
        return Number(value) >= Number(compareValue);
      case "less_or_equal":
        return Number(value) <= Number(compareValue);
      default:
        return false;
    }
  }

  /**
   * Resolve a dot-separated variable path from the state variables.
   */
  private resolveVariablePath(path: string): unknown {
    const parts = path.split(".");
    let value: unknown = this.state.variables;
    for (const part of parts) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /**
   * Evaluate a prompt transition condition in simulation mode.
   * Uses keyword matching: checks if the user's input contains keywords
   * from the condition string.
   */
  private evaluatePromptConditionSimulated(condition: string, userInput?: string): boolean {
    if (!userInput) return false;

    const input = userInput.toLowerCase();
    const conditionLower = condition.toLowerCase();

    // Extract meaningful keywords from the condition (skip common words)
    const stopWords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
      "have", "has", "had", "do", "does", "did", "will", "would", "could",
      "should", "may", "might", "shall", "can", "to", "of", "in", "for",
      "on", "with", "at", "by", "from", "as", "into", "through", "during",
      "before", "after", "above", "below", "between", "out", "off", "over",
      "under", "again", "further", "then", "once", "if", "or", "and", "but",
      "not", "no", "nor", "so", "too", "very", "just", "about", "up",
      "that", "this", "these", "those", "it", "its", "user", "wants",
      "want", "says", "said", "asking", "asked", "ask", "they", "their",
      "them", "he", "she", "his", "her", "we", "our", "you", "your",
    ]);

    const keywords = conditionLower
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    if (keywords.length === 0) return false;

    // Check if the user input contains any of the condition keywords
    let matchCount = 0;
    for (const keyword of keywords) {
      if (input.includes(keyword)) {
        matchCount++;
      }
    }

    // Require at least one keyword match, and a reasonable ratio for multi-keyword conditions
    const matchRatio = matchCount / keywords.length;
    return matchCount > 0 && (keywords.length <= 2 ? matchCount >= 1 : matchRatio >= 0.4);
  }

  /**
   * Evaluate a prompt transition condition in live mode.
   * Calls the AI API to determine if the condition is met.
   */
  private async evaluatePromptConditionLive(condition: string, userInput: string): Promise<boolean> {
    try {
      const response = await fetch("/api/canvas/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInput,
          systemPrompt: `You are a transition evaluator. Determine if the user's message satisfies the following condition. Respond with ONLY "true" or "false".\n\nCondition: "${condition}"`,
          conversationHistory: this.conversationHistory,
          variables: this.state.variables,
          temperature: 0.1,
          maxTokens: 10,
          model: "gpt-4o-mini",
        }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      const answer = (data.response || "").toLowerCase().trim();
      return answer === "true" || answer.startsWith("true");
    } catch {
      // On error, fall back to simulation
      return this.evaluatePromptConditionSimulated(condition, userInput);
    }
  }

  // ============================================
  // Conversation Helpers
  // ============================================

  /**
   * Call the chat API for live mode conversation.
   */
  private async callChatAPI(
    prompt: string,
    config: ConversationConfig,
    userInput?: string
  ): Promise<string> {
    try {
      const response = await fetch("/api/canvas/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userInput || "Hello",
          systemPrompt: this.substituteVariables(prompt),
          conversationHistory: this.conversationHistory,
          variables: this.state.variables,
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
      return data.response || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error("Live AI error:", error);
      return error instanceof Error
        ? `[AI Error: ${error.message}]`
        : "I'm having trouble connecting. Please try again.";
    }
  }

  /**
   * Simulate a conversation response in simulation mode.
   * Generates a contextual response based on the node prompt and user input.
   */
  private simulateConversationResponse(config: ConversationConfig, userInput?: string): string {
    const prompt = config.content.content || "";
    const input = (userInput || "").toLowerCase();

    if (!userInput) {
      return "How can I help you today?";
    }

    // Check for greetings
    const greetings = ["hi", "hello", "hey", "good morning", "good afternoon"];
    if (greetings.some((g) => input === g || input.startsWith(g + " "))) {
      return "Hello! How can I assist you today?";
    }

    // Check for identity questions
    if (input.includes("your name") || input.includes("who are you")) {
      return "I'm an AI assistant here to help you. What can I do for you today?";
    }

    // Check context from the node prompt for relevant responses
    const context = prompt.toLowerCase();

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

  // ============================================
  // Utility Helpers
  // ============================================

  /**
   * Get next node ID from default output edge
   */
  private getNextNodeId(nodeId: string): string | null {
    const edge = this.edges.find(
      (e) => e.source === nodeId && (!e.sourceHandle || e.sourceHandle === "default")
    );
    return edge?.target || null;
  }

  /**
   * Get next node ID for a specific output handle
   */
  private getNextNodeIdForHandle(nodeId: string, handle: string): string | null {
    const edge = this.edges.find(
      (e) => e.source === nodeId && e.sourceHandle === handle
    );
    return edge?.target || this.getNextNodeId(nodeId);
  }

  /**
   * Substitute variables in a template string.
   * Replaces {{variableName}} and {{path.to.value}} with their current values.
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
   * Extract a value from a JSON object using a simple path expression.
   * Supports dot notation: "data.items[0].name" or "$.data.count"
   */
  private extractJsonPath(data: unknown, path: string): unknown {
    // Strip leading "$." if present
    const cleanPath = path.startsWith("$.") ? path.slice(2) : path;
    const parts = cleanPath.split(/\.|\[|\]/).filter(Boolean);

    let value: unknown = data;
    for (const part of parts) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /**
   * Add a message to the conversation log
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
  variables: FlowVariable[],
  mode?: TestModeType
): FlowExecutor {
  return new FlowExecutor(nodes, edges, variables, mode);
}
