/**
 * LiveKit Service
 *
 * Room management and token generation for LiveKit.
 * Handles WebRTC room creation for voice calls.
 *
 * @module lib/voice/livekit
 */

import {
  AccessToken,
  RoomServiceClient,
  Room,
  ParticipantInfo,
} from "livekit-server-sdk";
import { DEFAULT_VOICE_SETTINGS } from "./config";

// Types
export interface TokenOptions {
  roomName: string;
  participantName: string;
  participantIdentity?: string;
  isAgent?: boolean;
  metadata?: string;
  ttl?: number;
}

export interface RoomOptions {
  name: string;
  emptyTimeout?: number;
  maxParticipants?: number;
  metadata?: string;
}

export interface RoomInfo {
  name: string;
  sid: string;
  numParticipants: number;
  maxParticipants: number;
  createdAt: Date;
  metadata?: string;
}

export interface ParticipantDetails {
  identity: string;
  name: string;
  sid: string;
  state: string;
  joinedAt: Date;
  isAgent: boolean;
  metadata?: string;
}

/**
 * Get LiveKit configuration from environment
 */
function getConfig() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !url) {
    throw new Error(
      "LiveKit configuration missing: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL"
    );
  }

  return { apiKey, apiSecret, url };
}

/**
 * Get RoomServiceClient for room management
 */
function getRoomService(): RoomServiceClient {
  const { url, apiKey, apiSecret } = getConfig();
  // Convert wss:// to https:// for REST API
  const httpUrl = url.replace("wss://", "https://").replace("ws://", "http://");
  return new RoomServiceClient(httpUrl, apiKey, apiSecret);
}

/**
 * Generate a LiveKit access token for a participant
 */
export async function generateToken(options: TokenOptions): Promise<string> {
  const { apiKey, apiSecret } = getConfig();

  const token = new AccessToken(apiKey, apiSecret, {
    identity: options.participantIdentity || options.participantName,
    name: options.participantName,
    metadata: options.metadata,
    ttl: options.ttl || DEFAULT_VOICE_SETTINGS.livekit.tokenTtl,
  });

  // Grant permissions based on role
  if (options.isAgent) {
    // Agent has full permissions
    token.addGrant({
      room: options.roomName,
      roomJoin: true,
      roomCreate: true,
      roomAdmin: true,
      roomRecord: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      canUpdateOwnMetadata: true,
    });
  } else {
    // Regular participant (user)
    token.addGrant({
      room: options.roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      canUpdateOwnMetadata: true,
    });
  }

  return await token.toJwt();
}

/**
 * Create a new LiveKit room
 */
export async function createRoom(options: RoomOptions): Promise<RoomInfo> {
  const roomService = getRoomService();

  const room = await roomService.createRoom({
    name: options.name,
    emptyTimeout: options.emptyTimeout || 300, // 5 minutes
    maxParticipants:
      options.maxParticipants || DEFAULT_VOICE_SETTINGS.livekit.maxParticipants,
    metadata: options.metadata,
  });

  return {
    name: room.name,
    sid: room.sid,
    numParticipants: room.numParticipants,
    maxParticipants: room.maxParticipants,
    createdAt: new Date(Number(room.creationTime) * 1000),
    metadata: room.metadata,
  };
}

/**
 * Get room information
 */
export async function getRoom(roomName: string): Promise<RoomInfo | null> {
  const roomService = getRoomService();

  try {
    const rooms = await roomService.listRooms([roomName]);
    const room = rooms.find((r: Room) => r.name === roomName);

    if (!room) return null;

    return {
      name: room.name,
      sid: room.sid,
      numParticipants: room.numParticipants,
      maxParticipants: room.maxParticipants,
      createdAt: new Date(Number(room.creationTime) * 1000),
      metadata: room.metadata,
    };
  } catch {
    return null;
  }
}

/**
 * List all active rooms
 */
export async function listRooms(): Promise<RoomInfo[]> {
  const roomService = getRoomService();
  const rooms = await roomService.listRooms();

  return rooms.map((room: Room) => ({
    name: room.name,
    sid: room.sid,
    numParticipants: room.numParticipants,
    maxParticipants: room.maxParticipants,
    createdAt: new Date(Number(room.creationTime) * 1000),
    metadata: room.metadata,
  }));
}

/**
 * Delete a room
 */
export async function deleteRoom(roomName: string): Promise<void> {
  const roomService = getRoomService();
  await roomService.deleteRoom(roomName);
}

/**
 * Get participants in a room
 */
export async function getParticipants(
  roomName: string
): Promise<ParticipantDetails[]> {
  const roomService = getRoomService();
  const participants = await roomService.listParticipants(roomName);

  return participants.map((p: ParticipantInfo) => ({
    identity: p.identity,
    name: p.name,
    sid: p.sid,
    state: p.state === 0 ? "joining" : p.state === 1 ? "joined" : "disconnected",
    joinedAt: new Date(Number(p.joinedAt) * 1000),
    isAgent: p.metadata?.includes('"isAgent":true') || false,
    metadata: p.metadata,
  }));
}

/**
 * Remove a participant from a room
 */
export async function removeParticipant(
  roomName: string,
  identity: string
): Promise<void> {
  const roomService = getRoomService();
  await roomService.removeParticipant(roomName, identity);
}

/**
 * Generate a unique room name for an organization
 */
export function generateRoomName(organizationId: string): string {
  const prefix = DEFAULT_VOICE_SETTINGS.livekit.roomPrefix;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}${organizationId}_${timestamp}_${random}`;
}

/**
 * Get LiveKit WebSocket URL for clients
 */
export function getServerUrl(): string {
  const { url } = getConfig();
  return url;
}
