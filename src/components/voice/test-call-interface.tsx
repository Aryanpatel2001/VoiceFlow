/**
 * Test Call Interface
 *
 * Client component for testing voice calls with the AI agent.
 * Supports two modes:
 *   1. Browser Call - Uses Web Speech API for recognition and ElevenLabs for TTS
 *   2. Phone Call - Initiates outbound Twilio call to a real phone number
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneOff,
  PhoneOutgoing,
  Mic,
  MicOff,
  Loader2,
  Volume2,
  User,
  Bot,
  Monitor,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CallMode = "browser" | "phone";

interface TranscriptEntry {
  id: string;
  speaker: "user" | "agent";
  text: string;
  timestamp: Date;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface PhoneNumber {
  id: string;
  number: string;
  friendlyName: string;
  assignedFlowId?: string;
}

export function TestCallInterface() {
  // Mode selection
  const [callMode, setCallMode] = useState<CallMode>("browser");

  // Phone call state
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedFromNumber, setSelectedFromNumber] = useState("");
  const [toNumber, setToNumber] = useState("");
  const [phoneCallId, setPhoneCallId] = useState<string | null>(null);
  const [phoneCallStatus, setPhoneCallStatus] = useState<string>("");

  // Shared state
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [interimText, setInterimText] = useState("");

  // Browser call refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const conversationRef = useRef<ConversationMessage[]>([]);
  const callStartRef = useRef<Date | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch phone numbers on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchPhoneNumbers() {
      try {
        const res = await fetch("/api/phone-numbers");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setPhoneNumbers(data.numbers || []);
          if (data.numbers?.length > 0) {
            setSelectedFromNumber(data.numbers[0].number);
          }
        }
      } catch (err) {
        console.error("Failed to fetch phone numbers:", err);
      }
    }
    fetchPhoneNumbers();

    return () => { cancelled = true; };
  }, []);

  // Initialize audio element for browser mode
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => {
      setIsSpeaking(false);
      if (isConnected && !isMuted && recognitionRef.current && callMode === "browser") {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch {
          // Already started
        }
      }
    };
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isConnected, isMuted, callMode]);

  // Call duration timer
  useEffect(() => {
    if (isConnected && callStartRef.current) {
      timerRef.current = setInterval(() => {
        const duration = Math.floor(
          (Date.now() - callStartRef.current!.getTime()) / 1000
        );
        setCallDuration(duration);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isConnected]);

  // Add transcript entry
  const addTranscript = useCallback((speaker: "user" | "agent", text: string) => {
    const entry: TranscriptEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      speaker,
      text,
      timestamp: new Date(),
    };
    setTranscript((prev) => [...prev, entry]);

    if (callMode === "browser") {
      conversationRef.current.push({
        role: speaker === "user" ? "user" : "assistant",
        content: text,
      });
    }
  }, [callMode]);

  // ============================================
  // Browser Call Functions
  // ============================================

  const processUserInput = useCallback(async (userText: string) => {
    if (!userText.trim() || isProcessing) return;

    setIsProcessing(true);
    addTranscript("user", userText);

    try {
      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          conversationHistory: conversationRef.current.slice(-10),
          includeAudio: true,
        }),
      });

      if (!res.ok) throw new Error("Failed to get AI response");

      const data = await res.json();

      if (data.response) {
        addTranscript("agent", data.response);

        if (data.audio && audioRef.current) {
          setIsSpeaking(true);
          audioRef.current.src = `data:${data.audioMimeType};base64,${data.audio}`;
          await audioRef.current.play();
        }
      }
    } catch (err) {
      console.error("Error processing:", err);
      setError("Failed to get AI response");
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, addTranscript]);

  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition not supported. Try Chrome.");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setInterimText(interimTranscript);

      if (finalTranscript) {
        setInterimText("");
        recognition.stop();
        setIsListening(false);
        processUserInput(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Microphone access denied.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (isConnected && !isMuted && !isProcessing && !isSpeaking && callMode === "browser") {
        try {
          recognition.start();
          setIsListening(true);
        } catch {}
      }
    };

    return recognition;
  }, [isConnected, isMuted, isProcessing, isSpeaking, callMode, processUserInput]);

  const handleStartBrowserCall = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const recognition = initSpeechRecognition();
      if (!recognition) {
        setIsLoading(false);
        return;
      }

      recognitionRef.current = recognition;
      callStartRef.current = new Date();
      conversationRef.current = [];
      setTranscript([]);
      setCallDuration(0);
      setIsConnected(true);

      recognition.start();
      setIsListening(true);

      // Greeting
      setTimeout(async () => {
        const greeting = "Hello! This is Alex from VoiceFlow Pro. How can I help you today?";
        addTranscript("agent", greeting);

        try {
          const res = await fetch("/api/voice/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: "Generate a greeting",
              conversationHistory: [],
              includeAudio: true,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.audio && audioRef.current) {
              setIsSpeaking(true);
              audioRef.current.src = `data:${data.audioMimeType};base64,${data.audio}`;
              audioRef.current.play().catch(() => {});
            }
          }
        } catch {}
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call");
    } finally {
      setIsLoading(false);
    }
  }, [initSpeechRecognition, addTranscript]);

  // ============================================
  // Phone Call Functions
  // ============================================

  const handleStartPhoneCall = useCallback(async () => {
    if (!selectedFromNumber || !toNumber) {
      setError("Please select a from number and enter a destination number");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/voice/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromNumber: selectedFromNumber,
          toNumber: toNumber.startsWith("+") ? toNumber : `+1${toNumber.replace(/\D/g, "")}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to initiate call");
      }

      const data = await res.json();
      setPhoneCallId(data.callId);
      setPhoneCallStatus("ringing");
      setIsConnected(true);
      callStartRef.current = new Date();
      setTranscript([]);
      setCallDuration(0);

      // Connect to SSE for live transcript
      const eventSource = new EventSource(`/api/voice/stream?callId=${data.callId}`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("transcript", (event) => {
        const { speaker, text } = JSON.parse(event.data);
        addTranscript(speaker, text);
      });

      eventSource.addEventListener("status", (event) => {
        const { status } = JSON.parse(event.data);
        setPhoneCallStatus(status);
        if (status === "in_progress") {
          setIsListening(true);
        }
      });

      eventSource.addEventListener("ended", () => {
        setIsConnected(false);
        setIsListening(false);
        eventSource.close();
      });

      eventSource.onerror = () => {
        console.error("SSE connection error");
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate call");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFromNumber, toNumber, addTranscript]);

  // ============================================
  // End Call
  // ============================================

  const handleEndCall = useCallback(async () => {
    if (callMode === "browser") {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }

      // Save call
      if (transcript.length > 0) {
        try {
          await fetch("/api/calls/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              duration: callDuration,
              transcript: transcript.map((t) => ({ speaker: t.speaker, text: t.text })),
            }),
          });
        } catch {}
      }
    } else {
      // End phone call
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      // TODO: API call to hang up Twilio call
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessing(false);
    setInterimText("");
    setPhoneCallId(null);
    setPhoneCallStatus("");
    callStartRef.current = null;
  }, [callMode, transcript, callDuration]);

  // Toggle mute (browser only)
  const handleToggleMute = useCallback(() => {
    if (callMode !== "browser") return;

    setIsMuted((prev) => {
      const newMuted = !prev;
      if (recognitionRef.current) {
        if (newMuted) {
          recognitionRef.current.stop();
          setIsListening(false);
        } else if (isConnected && !isProcessing && !isSpeaking) {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch {}
        }
      }
      return newMuted;
    });
  }, [callMode, isConnected, isProcessing, isSpeaking]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatPhoneNumber = (num: string) => {
    const cleaned = num.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return num;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Test Call</h1>
        <p className="text-sm text-muted-foreground">
          Test your AI voice agent via browser or phone call.
        </p>
      </div>

      {/* Mode Selector */}
      {!isConnected && (
        <div className="card-premium">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-medium text-foreground">Call Mode</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCallMode("browser")}
              className={cn(
                "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                callMode === "browser"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <Monitor className={cn("h-5 w-5", callMode === "browser" ? "text-primary" : "text-muted-foreground")} />
              <div className="text-left">
                <p className={cn("font-medium", callMode === "browser" ? "text-foreground" : "text-muted-foreground")}>
                  Browser Call
                </p>
                <p className="text-xs text-muted-foreground">Use microphone in browser</p>
              </div>
            </button>

            <button
              onClick={() => setCallMode("phone")}
              className={cn(
                "flex items-center gap-3 p-4 rounded-lg border-2 transition-all",
                callMode === "phone"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              )}
            >
              <Smartphone className={cn("h-5 w-5", callMode === "phone" ? "text-primary" : "text-muted-foreground")} />
              <div className="text-left">
                <p className={cn("font-medium", callMode === "phone" ? "text-foreground" : "text-muted-foreground")}>
                  Phone Call
                </p>
                <p className="text-xs text-muted-foreground">Call a real phone number</p>
              </div>
            </button>
          </div>

          {/* Phone Call Settings */}
          {callMode === "phone" && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  From Number (Twilio)
                </label>
                <select
                  value={selectedFromNumber}
                  onChange={(e) => setSelectedFromNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md outline-none focus:border-primary"
                >
                  {phoneNumbers.length === 0 ? (
                    <option value="">No phone numbers available</option>
                  ) : (
                    phoneNumbers.map((pn) => (
                      <option key={pn.id} value={pn.number}>
                        {formatPhoneNumber(pn.number)}
                      </option>
                    ))
                  )}
                </select>
                {phoneNumbers.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Add a phone number in Phone Numbers page first
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  To Number (Destination)
                </label>
                <input
                  type="tel"
                  value={toNumber}
                  onChange={(e) => setToNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md outline-none focus:border-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The phone number to call for testing
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Call Panel */}
        <div className="card-premium flex flex-col items-center justify-center min-h-[400px]">
          <AnimatePresence mode="wait">
            {!isConnected && !isLoading ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center"
              >
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                  {callMode === "browser" ? (
                    <Phone className="h-10 w-10 text-primary" />
                  ) : (
                    <PhoneOutgoing className="h-10 w-10 text-primary" />
                  )}
                </div>
                <h2 className="mb-2 text-xl font-semibold text-foreground">
                  Ready to Test
                </h2>
                <p className="mb-6 text-sm text-muted-foreground max-w-xs">
                  {callMode === "browser"
                    ? "Click to start speaking with your AI agent via browser."
                    : "Click to call your phone and test the AI agent."}
                </p>
                {error && (
                  <p className="mb-4 text-sm text-destructive">{error}</p>
                )}
                <button
                  onClick={callMode === "browser" ? handleStartBrowserCall : handleStartPhoneCall}
                  disabled={isLoading || (callMode === "phone" && (!selectedFromNumber || !toNumber))}
                  className="btn-primary"
                >
                  {callMode === "browser" ? (
                    <>
                      <Phone className="h-4 w-4" />
                      Start Browser Call
                    </>
                  ) : (
                    <>
                      <PhoneOutgoing className="h-4 w-4" />
                      Call {toNumber ? formatPhoneNumber(toNumber) : "Phone"}
                    </>
                  )}
                </button>
              </motion.div>
            ) : isLoading ? (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                </div>
                <h2 className="mb-2 text-xl font-semibold text-foreground">
                  {callMode === "phone" ? "Calling..." : "Connecting..."}
                </h2>
                {callMode === "phone" && (
                  <p className="text-sm text-muted-foreground">
                    Dialing {formatPhoneNumber(toNumber)}
                  </p>
                )}
              </motion.div>
            ) : isConnected ? (
              <motion.div
                key="connected"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full text-center"
              >
                {/* Status */}
                <div className="mb-4 flex items-center justify-center gap-2">
                  <span className="live-dot" />
                  <span className="text-sm font-medium text-success">
                    {callMode === "phone" && phoneCallStatus === "ringing" ? "Ringing" : "Connected"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    &middot; {formatDuration(callDuration)}
                  </span>
                </div>

                {callMode === "phone" && (
                  <p className="mb-4 text-sm text-muted-foreground">
                    {formatPhoneNumber(selectedFromNumber)} → {formatPhoneNumber(toNumber)}
                  </p>
                )}

                {/* Status indicators */}
                <div className="mb-6 h-16 flex items-center justify-center">
                  {isProcessing ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  ) : isSpeaking ? (
                    <div className="flex items-center gap-2 text-success">
                      <Volume2 className="h-5 w-5 animate-pulse" />
                      <span className="text-sm">Agent speaking...</span>
                    </div>
                  ) : isListening ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 text-primary">
                        <Mic className="h-5 w-5 animate-pulse" />
                        <span className="text-sm">Listening...</span>
                      </div>
                      {interimText && (
                        <p className="text-xs text-muted-foreground italic max-w-xs truncate">
                          {interimText}
                        </p>
                      )}
                    </div>
                  ) : isMuted ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MicOff className="h-5 w-5" />
                      <span className="text-sm">Muted</span>
                    </div>
                  ) : phoneCallStatus === "ringing" ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-5 w-5 animate-bounce" />
                      <span className="text-sm">Waiting for answer...</span>
                    </div>
                  ) : null}
                </div>

                {/* Speaking indicators */}
                <div className="mb-6 flex items-center justify-center gap-8">
                  <div className={cn("flex flex-col items-center gap-1 transition-opacity", isListening && !isMuted ? "opacity-100" : "opacity-40")}>
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors", isListening && !isMuted ? "border-primary bg-primary/10" : "border-border bg-muted")}>
                      <User className="h-5 w-5" />
                    </div>
                    <span className="text-xs text-muted-foreground">{callMode === "phone" ? "Caller" : "You"}</span>
                  </div>

                  <div className={cn("flex flex-col items-center gap-1 transition-opacity", isSpeaking ? "opacity-100" : "opacity-40")}>
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors", isSpeaking ? "border-success bg-success/10" : "border-border bg-muted")}>
                      <Bot className="h-5 w-5" />
                    </div>
                    <span className="text-xs text-muted-foreground">Agent</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-4">
                  {callMode === "browser" && (
                    <button
                      onClick={handleToggleMute}
                      className={cn("flex h-12 w-12 items-center justify-center rounded-full transition-colors", isMuted ? "bg-destructive text-destructive-foreground" : "bg-muted hover:bg-muted/80")}
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </button>
                  )}

                  <button
                    onClick={handleEndCall}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                    title="End Call"
                  >
                    <PhoneOff className="h-6 w-6" />
                  </button>

                  <button className="flex h-12 w-12 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors" title="Speaker">
                    <Volume2 className="h-5 w-5" />
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Transcript Panel */}
        <div className="card-premium !p-0 flex flex-col min-h-[400px]">
          <div className="border-b border-border px-6 py-4">
            <h3 className="font-semibold text-foreground">Live Transcript</h3>
            <p className="text-xs text-muted-foreground">Real-time conversation transcript</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {transcript.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center text-muted-foreground">
                  <Mic className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">
                    {isConnected ? "Listening... Say something!" : "Start a call to see the transcript"}
                  </p>
                </div>
              </div>
            ) : (
              transcript.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex gap-3", entry.speaker === "user" ? "flex-row-reverse" : "")}
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", entry.speaker === "user" ? "bg-primary/10" : "bg-success/10")}>
                    {entry.speaker === "user" ? <User className="h-4 w-4 text-primary" /> : <Bot className="h-4 w-4 text-success" />}
                  </div>
                  <div className={cn("flex-1 rounded-lg px-4 py-2 max-w-[80%]", entry.speaker === "user" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted")}>
                    <p className="text-sm">{entry.text}</p>
                    <p className={cn("text-xs mt-1", entry.speaker === "user" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {entry.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="card-premium">
        <h3 className="mb-3 font-semibold text-foreground">How It Works</h3>
        {callMode === "browser" ? (
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">1</span>
              <span>Click &quot;Start Browser Call&quot; and allow microphone access</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">2</span>
              <span>Speak naturally - your speech will be transcribed in real-time</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">3</span>
              <span>The AI agent will respond with voice using ElevenLabs</span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">1</span>
              <span>Select your Twilio phone number (From) and enter destination number (To)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">2</span>
              <span>Click &quot;Call Phone&quot; - Twilio will dial the destination</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">3</span>
              <span>Answer your phone and speak with the AI agent - transcript appears live</span>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
