import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VoiceFlow Pro - AI Voice Agents for Home Services",
    template: "%s | VoiceFlow Pro",
  },
  description:
    "Never miss a customer call again. AI voice agents that answer, book appointments, and qualify leads 24/7. Set up in just 5 minutes.",
  keywords: [
    "AI voice agent",
    "phone answering service",
    "home services",
    "HVAC",
    "plumbing",
    "appointment booking",
    "AI receptionist",
  ],
  authors: [{ name: "VoiceFlow Pro" }],
  creator: "VoiceFlow Pro",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://voiceflowpro.com",
    title: "VoiceFlow Pro - AI Voice Agents for Home Services",
    description:
      "Never miss a customer call again. AI voice agents that answer, book appointments, and qualify leads 24/7.",
    siteName: "VoiceFlow Pro",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VoiceFlow Pro",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VoiceFlow Pro - AI Voice Agents for Home Services",
    description:
      "Never miss a customer call again. AI voice agents that answer, book appointments, and qualify leads 24/7.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontVariables} font-sans antialiased`}>
        <ThemeProvider defaultTheme="light" enableSystem>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                color: "hsl(var(--foreground))",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
