import { Inter, DM_Sans, JetBrains_Mono } from "next/font/google";

// Primary font - Clean, modern, highly readable
export const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Display font - For headlines and emphasis
export const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

// Monospace font - For numbers, stats, code
export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
  weight: ["400", "500", "600", "700"],
});

// Combined font variables for className
export const fontVariables = `${inter.variable} ${dmSans.variable} ${jetbrainsMono.variable}`;
