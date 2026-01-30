/**
 * Custom Next.js Server with WebSocket Support
 *
 * Adds WebSocket handling for Twilio Media Streams alongside
 * standard Next.js HTTP request handling.
 *
 * WebSocket endpoint: /api/voice/twilio-stream?callId=xxx&webhookId=yyy
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // WebSocket server for Twilio Media Streams
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (req, socket, head) => {
    console.log(`[WebSocket] Upgrade request: ${req.url}`);

    const { pathname, searchParams } = new URL(
      req.url!,
      `http://${req.headers.host}`
    );

    console.log(`[WebSocket] Pathname: ${pathname}`);

    if (pathname === "/api/voice/twilio-stream") {
      console.log(`[WebSocket] Twilio stream connection attempt`);

      // Note: Query params may not be available (Cloudflare strips them)
      // We'll get the actual params from Twilio's "start" event customParameters
      console.log(`[WebSocket] Upgrading connection (params will come from Twilio start event)`);

      wss.handleUpgrade(req, socket, head, async (ws: WebSocket) => {
        console.log(`[WebSocket] Connection upgraded successfully`);
        wss.emit("connection", ws, req);

        try {
          // Dynamic import to use Next.js path aliases
          console.log(`[WebSocket] Loading twilio-media-stream handler...`);
          const { handleTwilioMediaStream } = await import(
            "./src/lib/voice/twilio-media-stream"
          );

          console.log(`[WebSocket] Handler loaded, initializing stream...`);
          // Pass empty config - actual params come from Twilio's start event customParameters
          handleTwilioMediaStream(ws, {
            callId: "",
            webhookId: "",
          });

          console.log(`[WebSocket] Twilio media stream handler attached`);
        } catch (error) {
          console.error("[WebSocket] Failed to initialize media stream handler:", error);
          ws.close();
        }
      });
    } else {
      // Not a recognized WebSocket path, destroy the socket
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(
      `> Server ready on http://${hostname}:${port} (${dev ? "development" : "production"})`
    );
    console.log(`> WebSocket endpoint: ws://${hostname}:${port}/api/voice/twilio-stream`);
  });
});