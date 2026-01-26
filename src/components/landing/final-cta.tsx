"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { ParticleNetwork } from "./particle-network";
import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-black py-28 lg:py-36">
      {/* BACKGROUND */}
      <div className="pointer-events-none absolute inset-0">
        {/* Dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:28px_28px]" />

        {/* Particle Network */}
        <ParticleNetwork />

        {/* Vignette */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="space-y-10"
        >
          <h2 className="font-display text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
            Ready to Never Miss a Call?
          </h2>

          <p className="mx-auto max-w-2xl text-lg text-white/80 lg:text-xl">
            Join 1,000+ businesses capturing more revenue with AI voice agents
          </p>

          <Link href="/signup">
            <motion.button
              whileHover={{
                scale: 1.05,
                boxShadow: "0 0 50px rgba(255,255,255,0.25)",
              }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-12 py-4 text-lg font-semibold text-black shadow-xl"
            >
              Start Your Free Trial
              <ArrowRight className="h-5 w-5" />
            </motion.button>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/80">
            {["14-day free trial", "No credit card required", "Setup in 5 minutes"].map(
              (text) => (
                <div key={text} className="flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  <span>{text}</span>
                </div>
              )
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
