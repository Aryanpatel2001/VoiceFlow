"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Bot } from "lucide-react";

interface Message {
  id: number;
  text: string;
  sender: "customer" | "ai";
  type: "message" | "typing";
}

export function AIChatDemo() {
  const [messages, setMessages] = useState<Message[]>([]);

  const conversationSteps: Message[] = [
    {
      id: 1,
      text: "Hello, I tried calling earlier but couldn't get through.",
      sender: "customer",
      type: "message",
    },
    { id: 2, text: "", sender: "ai", type: "typing" },
    {
      id: 3,
      text: "Thanks for reaching out! I'm an automated voice assistant here to help you.",
      sender: "ai",
      type: "message",
    },
    {
      id: 4,
      text: "I'd like to book a service appointment.",
      sender: "customer",
      type: "message",
    },
    { id: 5, text: "", sender: "ai", type: "typing" },
    {
      id: 6,
      text: "Great! I've scheduled your appointment and sent the details by text.",
      sender: "ai",
      type: "message",
    },
  ];

  useEffect(() => {
    const timings = [0, 1000, 2200, 3800, 4800, 6000, 7200];

    const runConversation = () => {
      setMessages([]);

      conversationSteps.forEach((step, index) => {
        setTimeout(() => {
          if (step.type === "typing") {
            setMessages((prev) => [...prev, step]);
            setTimeout(() => {
              setMessages((prev) => prev.filter((m) => m.id !== step.id));
            }, 1000);
          } else {
            setMessages((prev) => [...prev, step]);
          }
        }, timings[index]);
      });
    };

    runConversation();

    const loopInterval = setInterval(() => {
      runConversation();
    }, 10000);

    return () => clearInterval(loopInterval);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[500px]">
      {/* Chat Container */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-secondary p-6 shadow-2xl sm:p-8">
        {/* Background Glow */}
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl"></div>

        {/* Header */}
        <div className="relative mb-6 flex items-center gap-3 border-b border-border/50 pb-4">
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-lg">
              <Bot className="h-6 w-6 text-primary-foreground" />
            </div>
            {/* Pulsing Ring */}
            <motion.div
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute inset-0 rounded-full border-2 border-primary"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              VoiceFlow AI
            </h3>
            <p className="text-xs text-muted-foreground">Active Call</p>
          </div>
          <div className="ml-auto">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: ["8px", "16px", "8px"],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  className="w-1 rounded-full bg-primary"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="relative min-h-[320px] space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`flex ${message.sender === "ai" ? "justify-end" : "justify-start"}`}
              >
                {message.type === "typing" ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 dark:bg-primary/20">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.5, 1, 0.5],
                        }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.15,
                        }}
                        className="h-2 w-2 rounded-full bg-primary"
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.sender === "ai"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "border border-border/50 bg-secondary text-foreground"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{message.text}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Bottom Indicator */}
        <div className="relative mt-6 flex items-center justify-center gap-2 border-t border-border/50 pt-4">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
          <p className="text-xs text-muted-foreground">
            AI handling call automatically
          </p>
        </div>
      </div>

      {/* Floating Badge */}
      <motion.div
        animate={{
          y: [0, -8, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -right-4 -top-4 rounded-full bg-green-500 px-4 py-2 text-xs font-semibold text-white shadow-lg"
      >
        Live Demo
      </motion.div>
    </div>
  );
}
