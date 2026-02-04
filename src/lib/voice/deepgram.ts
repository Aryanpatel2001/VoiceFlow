/**
 * Deepgram Speech-to-Text Service
 *
 * Real-time and batch transcription using Deepgram Nova-2.
 * Optimized for low-latency voice conversations.
 *
 * @module lib/voice/deepgram
 */

import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import { DEFAULT_VOICE_SETTINGS } from "./config";

// Types
export interface TranscriptResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export interface DeepgramStreamOptions {
  model?: string;
  language?: string;
  punctuate?: boolean;
  interimResults?: boolean;
  utteranceEndMs?: number;
  vadEvents?: boolean;
  encoding?: string;
  sampleRate?: number;
}

type TranscriptCallback = (result: TranscriptResult) => void;
type ErrorCallback = (error: Error) => void;

/**
 * Create a Deepgram client
 */
function getClient() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }
  return createClient(apiKey);
}

/**
 * Create a real-time transcription stream
 * Returns a connection that can receive audio buffers
 */
export async function createTranscriptionStream(
  onTranscript: TranscriptCallback,
  onError?: ErrorCallback,
  options?: DeepgramStreamOptions
) {
  console.log(`[Deepgram] Creating transcription stream...`);
  console.log(`[Deepgram] Options:`, JSON.stringify(options || {}));

  const client = getClient();

  const settings = {
    model: options?.model || DEFAULT_VOICE_SETTINGS.deepgram.model,
    language: options?.language || DEFAULT_VOICE_SETTINGS.deepgram.language,
    punctuate: options?.punctuate ?? DEFAULT_VOICE_SETTINGS.deepgram.punctuate,
    interim_results:
      options?.interimResults ?? DEFAULT_VOICE_SETTINGS.deepgram.interimResults,
    utterance_end_ms:
      options?.utteranceEndMs ?? DEFAULT_VOICE_SETTINGS.deepgram.utteranceEndMs,
    vad_events: options?.vadEvents ?? DEFAULT_VOICE_SETTINGS.deepgram.vadEvents,
    encoding: options?.encoding || "linear16",
    sample_rate: options?.sampleRate || 16000,
    channels: 1,
    smart_format: true,
    filler_words: false,
  };

  console.log(`[Deepgram] Settings: encoding=${settings.encoding}, sample_rate=${settings.sample_rate}`);

  const connection = client.listen.live(settings);

  // Handle transcription results
  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript = data.channel?.alternatives?.[0];
    if (transcript && transcript.transcript) {
      console.log(`[Deepgram] Transcript: "${transcript.transcript}" (final: ${data.is_final})`);
      onTranscript({
        text: transcript.transcript || "",
        confidence: transcript.confidence || 0,
        isFinal: data.is_final || false,
        words: transcript.words?.map((w: Record<string, unknown>) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence,
        })),
      });
    }
  });

  // Handle errors
  connection.on(LiveTranscriptionEvents.Error, (error) => {
    console.error("Deepgram error:", error);
    onError?.(error instanceof Error ? error : new Error(String(error)));
  });

  // Handle connection close
  connection.on(LiveTranscriptionEvents.Close, () => {
    console.log("Deepgram connection closed");
  });

  // Wait for connection to open
  await new Promise<void>((resolve, reject) => {
    connection.on(LiveTranscriptionEvents.Open, () => {
      console.log("Deepgram connection opened");
      resolve();
    });

    // Timeout after 10 seconds
    setTimeout(() => reject(new Error("Deepgram connection timeout")), 10000);
  });

  return {
    /**
     * Send audio data to be transcribed
     * @param audioData - PCM audio buffer (16-bit, 16kHz, mono)
     */
    send: (audioData: Buffer | ArrayBuffer) => {
      const payload =
        audioData instanceof ArrayBuffer ? audioData : audioData.buffer;
      connection.send(payload);
    },

    /**
     * Close the transcription stream
     */
    close: () => {
      connection.finish();
    },

    /**
     * Check if connection is open
     */
    isOpen: () => {
      return connection.getReadyState() === 1; // WebSocket.OPEN
    },
  };
}

/**
 * Transcribe audio file or buffer (non-streaming)
 * Good for transcribing recordings
 */
export async function transcribeAudio(
  audioSource: Buffer | string,
  options?: {
    model?: string;
    language?: string;
    punctuate?: boolean;
  }
): Promise<TranscriptResult> {
  const client = getClient();

  const settings = {
    model: options?.model || DEFAULT_VOICE_SETTINGS.deepgram.model,
    language: options?.language || DEFAULT_VOICE_SETTINGS.deepgram.language,
    punctuate: options?.punctuate ?? true,
    smart_format: true,
  };

  let response;

  if (typeof audioSource === "string") {
    // URL source
    response = await client.listen.prerecorded.transcribeUrl(
      { url: audioSource },
      settings
    );
  } else {
    // Buffer source
    response = await client.listen.prerecorded.transcribeFile(
      audioSource,
      settings
    );
  }

  const result = response.result?.results?.channels?.[0]?.alternatives?.[0];

  return {
    text: result?.transcript || "",
    confidence: result?.confidence || 0,
    isFinal: true,
    words: result?.words?.map(
      (w: { word: string; start: number; end: number; confidence: number }) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        confidence: w.confidence,
      })
    ),
  };
}
