"use client";

import { motion } from "framer-motion";
import { Check, Play } from "lucide-react";
import Image from "next/image";

const features = [
  "Natural conversation flow",
  "Appointment booking with calendar sync",
  "Lead qualification questions",
  "Emergency call routing",
  "Voicemail transcription",
  "CRM automatic updates",
  "Multi-language support",
  "Call recording & analytics",
];

export function ProductDemo() {
  return (
    <section className="bg-secondary/30 py-20 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left - Demo Visual */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="group relative overflow-hidden rounded-2xl border border-border shadow-xl">
              {/* Video Thumbnail */}
              <div className="relative aspect-video bg-card">
                <Image
                  src="https://images.unsplash.com/photo-1715321835688-831f4767cf93?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBzbWFydHBob25lJTIwaW50ZXJmYWNlfGVufDF8fHx8MTc2ODgxMjUzNHww&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Product Demo"
                  fill
                  className="object-cover opacity-80"
                />

                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-background/5">
                  <button className="flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-lg transition-all duration-300 hover:scale-110 hover:bg-primary/90">
                    <Play className="ml-0.5 h-7 w-7 text-primary-foreground" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right - Content */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                SEE IT IN ACTION
              </span>
              <h2 className="mb-6 mt-4 font-display text-4xl font-bold tracking-tight text-foreground lg:text-5xl">
                Watch Your AI Agent Handle Real Calls
              </h2>
              <p className="text-lg leading-relaxed text-muted-foreground">
                See how VoiceFlow Pro answers calls, books appointments, and
                qualifies leads—just like a human receptionist.
              </p>
            </div>

            {/* Features List */}
            <div className="grid gap-4 sm:grid-cols-2">
              {features.map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{feature}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <div className="pt-4">
              <button className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90">
                Watch Full Demo
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
