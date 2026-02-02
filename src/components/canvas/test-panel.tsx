/**
 * Test Panel
 *
 * Conversation simulator for testing flows.
 * Displays messages, highlights current node, and accepts user input.
 * Supports both Simulation mode (pattern matching) and Live AI mode (OpenAI).
 *
 * @module components/canvas/test-panel
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Send, RotateCcw, X, Cpu, Sparkles } from "lucide-react";
import { useTestMode } from "@/stores/canvas.store";
import { cn } from "@/lib/utils";

interface TestPanelProps {
  onClose: () => void;
}

export function TestPanel({ onClose }: TestPanelProps) {
  const {
    testState,
    testModeType,
    sendTestMessage,
    stopTest,
    startTest,
    setTestModeType,
  } = useTestMode();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = testState?.messages || [];
  const isWaiting = testState?.status === "waiting_input";
  const isRunning = testState?.status === "running";
  const isCompleted = testState?.status === "completed";
  const isError = testState?.status === "error";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !isWaiting) return;
    const msg = input.trim();
    setInput("");
    await sendTestMessage(msg);
  }, [input, isWaiting, sendTestMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleRestart = useCallback(() => {
    stopTest();
    startTest();
  }, [stopTest, startTest]);

  const handleModeChange = useCallback(
    (newMode: "simulation" | "live") => {
      if (newMode !== testModeType) {
        setTestModeType(newMode);
        // Restart test with new mode
        stopTest();
        setTimeout(() => startTest(), 50);
      }
    },
    [testModeType, setTestModeType, stopTest, startTest]
  );

  return (
    <div className="w-80 bg-card border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              isRunning && "bg-yellow-500 animate-pulse",
              isWaiting && "bg-green-500",
              isCompleted && "bg-blue-500",
              isError && "bg-red-500"
            )}
          />
          <h2 className="text-sm font-semibold text-foreground">Test Mode</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRestart}
            className="p-1.5 rounded hover:bg-accent"
            title="Restart"
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-accent"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-1 p-0.5 bg-muted rounded-md">
          <button
            onClick={() => handleModeChange("simulation")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded transition-colors",
              testModeType === "simulation"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Cpu className="h-3 w-3" />
            Simulation
          </button>
          <button
            onClick={() => handleModeChange("live")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded transition-colors",
              testModeType === "live"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-3 w-3" />
            Live AI
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          {testModeType === "simulation"
            ? "Pattern matching (free, instant)"
            : "Real OpenAI responses"}
        </p>
      </div>

      {/* Variables State */}
      {testState && Object.keys(testState.variables).length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-muted/50">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Variables
          </p>
          <div className="space-y-0.5">
            {Object.entries(testState.variables).map(([key, value]) => (
              <div key={key} className="flex items-center gap-1.5 text-[11px]">
                <code className="text-primary font-mono">{key}</code>
                <span className="text-muted-foreground">=</span>
                <code className="text-foreground font-mono truncate">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : message.role === "system"
                  ? "bg-muted text-muted-foreground italic text-xs"
                  : "bg-muted text-foreground"
              )}
            >
              {message.text}
              {message.nodeId && (
                <p className="text-[10px] opacity-60 mt-1">
                  Node: {message.nodeId}
                </p>
              )}
            </div>
          </div>
        ))}

        {isRunning && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.15s]" />
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}

        {isCompleted && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Flow completed</p>
          </div>
        )}

        {isError && (
          <div className="text-center">
            <p className="text-xs text-destructive">
              Error: {testState?.error || "Unknown error"}
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isWaiting ? "Type a message..." : "Waiting..."}
            disabled={!isWaiting}
            className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !isWaiting}
            className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
