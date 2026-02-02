/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    // Externalize native Node.js modules that can't be bundled by webpack
    serverComponentsExternalPackages: [
      "@livekit/rtc-node",
      "@livekit/rtc-node-darwin-arm64",
      "@livekit/rtc-node-darwin-x64",
      "@livekit/rtc-node-linux-arm64-gnu",
      "@livekit/rtc-node-linux-x64-gnu",
      "@livekit/rtc-node-win32-x64-msvc",
    ],
  },
};

export default nextConfig;
