"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play, Check } from "lucide-react";
import { AIChatDemo } from "./ai-chat-demo";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
      {/* Subtle Background Effects */}
      <div className="absolute inset-0">
        {/* Gradient Orb - Light */}
        <div className="absolute left-1/2 top-20 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl dark:bg-primary/10"></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:64px_64px] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)]"></div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left Column - Content */}
          <div className="space-y-8 text-center lg:text-left">
            {/* Trust Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 transition-all hover:bg-accent"
            >
              <span className="text-xl">🚀</span>
              <span className="text-xs font-medium text-muted-foreground">
                Trusted by 1,000+ Businesses
              </span>
            </motion.div>

            {/* Main Headline */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-4"
            >
              <h1 className="font-display text-5xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                Never Miss a{" "}
                <span className="bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                  Customer Call
                </span>{" "}
                Again
              </h1>
            </motion.div>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
            >
              AI voice agents that answer, book appointments, and qualify leads
              24/7. Set up in just 5 minutes—no coding required.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start"
            >
              <Link
                href="/signup"
                className="group flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90"
              >
                Start Free Trial
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <button className="flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-8 py-3.5 font-medium text-foreground transition-all duration-200 hover:bg-secondary">
                <Play className="h-5 w-5" />
                Watch Demo
              </button>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground lg:justify-start"
            >
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>Cancel anytime</span>
              </div>
            </motion.div>
          </div>

          {/* Right Column - AI Chat Demo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="relative flex items-center justify-center"
          >
            <AIChatDemo />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
