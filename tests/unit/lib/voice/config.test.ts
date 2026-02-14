/**
 * Voice Config Tests
 *
 * Unit tests for voice configuration module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getVoiceConfig,
  isVoiceConfigured,
  DEFAULT_VOICE_SETTINGS,
  AGENT_PROMPTS,
} from "@/lib/voice/config";

describe("Voice Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ============================================
  // DEFAULT_VOICE_SETTINGS
  // ============================================
  describe("DEFAULT_VOICE_SETTINGS", () => {
    it("should have valid OpenAI settings", () => {
      expect(DEFAULT_VOICE_SETTINGS.openai).toBeDefined();
      expect(DEFAULT_VOICE_SETTINGS.openai.model).toBe("gpt-4o-mini");
      expect(DEFAULT_VOICE_SETTINGS.openai.maxTokens).toBe(150);
      expect(DEFAULT_VOICE_SETTINGS.openai.temperature).toBe(0.7);
    });

    it("should have valid Deepgram settings", () => {
      expect(DEFAULT_VOICE_SETTINGS.deepgram).toBeDefined();
      expect(DEFAULT_VOICE_SETTINGS.deepgram.model).toBe("nova-2");
      expect(DEFAULT_VOICE_SETTINGS.deepgram.language).toBe("en-US");
      expect(DEFAULT_VOICE_SETTINGS.deepgram.punctuate).toBe(true);
    });

    it("should have valid ElevenLabs settings", () => {
      expect(DEFAULT_VOICE_SETTINGS.elevenlabs).toBeDefined();
      expect(DEFAULT_VOICE_SETTINGS.elevenlabs.model).toBe("eleven_turbo_v2_5");
      expect(DEFAULT_VOICE_SETTINGS.elevenlabs.stability).toBe(0.5);
      expect(DEFAULT_VOICE_SETTINGS.elevenlabs.similarityBoost).toBe(0.75);
    });

    it("should have valid LiveKit settings", () => {
      expect(DEFAULT_VOICE_SETTINGS.livekit).toBeDefined();
      expect(DEFAULT_VOICE_SETTINGS.livekit.roomPrefix).toBe("vfp_");
      expect(DEFAULT_VOICE_SETTINGS.livekit.tokenTtl).toBe(3600);
      expect(DEFAULT_VOICE_SETTINGS.livekit.maxParticipants).toBe(2);
    });
  });

  // ============================================
  // AGENT_PROMPTS
  // ============================================
  describe("AGENT_PROMPTS", () => {
    it("should have default prompt", () => {
      expect(AGENT_PROMPTS.default).toBeDefined();
      expect(AGENT_PROMPTS.default).toContain("helpful AI voice assistant");
    });

    it("should have receptionist prompt", () => {
      expect(AGENT_PROMPTS.receptionist).toBeDefined();
      expect(AGENT_PROMPTS.receptionist).toContain("Alex");
      expect(AGENT_PROMPTS.receptionist).toContain("receptionist");
    });

    it("should have sales prompt", () => {
      expect(AGENT_PROMPTS.sales).toBeDefined();
      expect(AGENT_PROMPTS.sales).toContain("sales");
    });

    it("should have support prompt", () => {
      expect(AGENT_PROMPTS.support).toBeDefined();
      expect(AGENT_PROMPTS.support).toContain("support");
    });

    it("should have appointment prompt", () => {
      expect(AGENT_PROMPTS.appointment).toBeDefined();
      expect(AGENT_PROMPTS.appointment).toContain("scheduling");
    });

    it("should have survey prompt", () => {
      expect(AGENT_PROMPTS.survey).toBeDefined();
      expect(AGENT_PROMPTS.survey).toContain("survey");
    });
  });

  // ============================================
  // getVoiceConfig
  // ============================================
  describe("getVoiceConfig", () => {
    it("should return config when all env vars are set", () => {
      process.env.LIVEKIT_API_KEY = "test_livekit_key";
      process.env.LIVEKIT_API_SECRET = "test_livekit_secret";
      process.env.LIVEKIT_URL = "wss://test.livekit.io";
      process.env.OPENAI_API_KEY = "test_openai_key";
      process.env.DEEPGRAM_API_KEY = "test_deepgram_key";
      process.env.ELEVENLABS_API_KEY = "test_elevenlabs_key";

      const config = getVoiceConfig();

      expect(config.livekit.apiKey).toBe("test_livekit_key");
      expect(config.livekit.apiSecret).toBe("test_livekit_secret");
      expect(config.livekit.url).toBe("wss://test.livekit.io");
      expect(config.openai.apiKey).toBe("test_openai_key");
      expect(config.deepgram.apiKey).toBe("test_deepgram_key");
      expect(config.elevenlabs.apiKey).toBe("test_elevenlabs_key");
    });

    it("should use custom ElevenLabs voice ID when provided", () => {
      process.env.LIVEKIT_API_KEY = "test_livekit_key";
      process.env.LIVEKIT_API_SECRET = "test_livekit_secret";
      process.env.LIVEKIT_URL = "wss://test.livekit.io";
      process.env.OPENAI_API_KEY = "test_openai_key";
      process.env.DEEPGRAM_API_KEY = "test_deepgram_key";
      process.env.ELEVENLABS_API_KEY = "test_elevenlabs_key";
      process.env.ELEVENLABS_VOICE_ID = "custom_voice_id";

      const config = getVoiceConfig();

      expect(config.elevenlabs.voiceId).toBe("custom_voice_id");
    });

    it("should throw error when LIVEKIT_API_KEY is missing", () => {
      process.env.LIVEKIT_API_SECRET = "test";
      process.env.LIVEKIT_URL = "test";
      process.env.OPENAI_API_KEY = "test";
      process.env.DEEPGRAM_API_KEY = "test";
      process.env.ELEVENLABS_API_KEY = "test";

      expect(() => getVoiceConfig()).toThrow("LIVEKIT_API_KEY");
    });

    it("should throw error with all missing env vars listed", () => {
      delete process.env.LIVEKIT_API_KEY;
      delete process.env.LIVEKIT_API_SECRET;
      delete process.env.LIVEKIT_URL;
      delete process.env.OPENAI_API_KEY;
      delete process.env.DEEPGRAM_API_KEY;
      delete process.env.ELEVENLABS_API_KEY;

      expect(() => getVoiceConfig()).toThrow("Missing required environment variables");
    });
  });

  // ============================================
  // isVoiceConfigured
  // ============================================
  describe("isVoiceConfigured", () => {
    it("should return true when all env vars are set", () => {
      process.env.LIVEKIT_API_KEY = "test";
      process.env.LIVEKIT_API_SECRET = "test";
      process.env.LIVEKIT_URL = "test";
      process.env.OPENAI_API_KEY = "test";
      process.env.DEEPGRAM_API_KEY = "test";
      process.env.ELEVENLABS_API_KEY = "test";

      expect(isVoiceConfigured()).toBe(true);
    });

    it("should return false when OPENAI_API_KEY is missing", () => {
      process.env.LIVEKIT_API_KEY = "test";
      process.env.LIVEKIT_API_SECRET = "test";
      process.env.LIVEKIT_URL = "test";
      delete process.env.OPENAI_API_KEY;
      process.env.DEEPGRAM_API_KEY = "test";
      process.env.ELEVENLABS_API_KEY = "test";

      expect(isVoiceConfigured()).toBe(false);
    });

    it("should return false when no env vars are set", () => {
      delete process.env.LIVEKIT_API_KEY;
      delete process.env.LIVEKIT_API_SECRET;
      delete process.env.LIVEKIT_URL;
      delete process.env.OPENAI_API_KEY;
      delete process.env.DEEPGRAM_API_KEY;
      delete process.env.ELEVENLABS_API_KEY;

      expect(isVoiceConfigured()).toBe(false);
    });
  });
});
