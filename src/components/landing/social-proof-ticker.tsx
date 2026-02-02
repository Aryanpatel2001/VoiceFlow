"use client";

import { motion } from "framer-motion";

const companies = [
  "Comfort Climate HVAC",
  "Chen Properties",
  "Kimball & Associates",
  "Thompson Dentistry",
  "Green Lawn Care",
  "Summit Legal Group",
  "Precision Plumbing",
  "Elite Real Estate",
  "Metro Healthcare",
  "ProTech Services",
];

export function SocialProofTicker() {
  return (
    <section className="overflow-hidden border-y border-border bg-secondary/30 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Trusted by 1,000+ businesses nationwide
        </p>

        {/* Logo Carousel */}
        <div className="relative">
          <div className="flex overflow-hidden">
            <motion.div
              animate={{
                x: [0, -1920],
              }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 30,
                  ease: "linear",
                },
              }}
              className="flex items-center gap-12"
            >
              {/* First set */}
              {companies.map((company, i) => (
                <div
                  key={`${company}-1-${i}`}
                  className="flex h-12 w-48 flex-shrink-0 items-center justify-center"
                >
                  <span className="text-center text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground">
                    {company}
                  </span>
                </div>
              ))}
              {/* Duplicate for seamless loop */}
              {companies.map((company, i) => (
                <div
                  key={`${company}-2-${i}`}
                  className="flex h-12 w-48 flex-shrink-0 items-center justify-center"
                >
                  <span className="text-center text-sm font-medium text-muted-foreground transition-colors duration-300 hover:text-foreground">
                    {company}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Fade Gradients */}
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-24 bg-gradient-to-r from-background to-transparent"></div>
          <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-24 bg-gradient-to-l from-background to-transparent"></div>
        </div>
      </div>
    </section>
  );
}
