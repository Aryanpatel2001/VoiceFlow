"use client";

import { motion } from "framer-motion";
import { Zap, Moon, Target, Check } from "lucide-react";

const cards = [
  {
    icon: Zap,
    title: "5-Minute Setup",
    description:
      "No technical expertise required. Connect your phone number, customize your AI agent, and go live in minutes. Our guided setup walks you through every step.",
    features: [
      "Pre-built industry templates",
      "Visual workflow builder",
      "One-click integrations",
    ],
  },
  {
    icon: Moon,
    title: "24/7 Availability",
    description:
      "Your AI agent never sleeps, takes breaks, or misses calls. Handle customer inquiries, emergency requests, and appointment bookings around the clock—even on holidays.",
    features: ["After-hours coverage", "Peak season scaling", "Holiday support"],
  },
  {
    icon: Target,
    title: "Industry-Specific AI",
    description:
      "Pre-trained for your business type. Whether you're in HVAC, legal, real estate, or healthcare, our AI understands your industry terminology and customer needs.",
    features: [
      "HVAC emergency routing",
      "Legal intake forms",
      "Real estate showing scheduling",
    ],
  },
];

export function ValuePropositions() {
  return (
    <section
      id="product"
      className="relative overflow-hidden bg-background py-20 lg:py-32"
    >
      {/* Subtle Background */}
      <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl dark:bg-primary/10"></div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-4"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              WHY VOICEFLOW PRO
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 font-display text-4xl font-bold tracking-tight text-foreground lg:text-5xl"
          >
            Built for Small Businesses
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto max-w-3xl text-lg text-muted-foreground"
          >
            Everything you need to never miss a revenue opportunity
          </motion.p>
        </div>

        {/* Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {cards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:border-primary/20 hover:shadow-lg"
            >
              {/* Icon */}
              <div className="mb-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20">
                  <card.icon className="h-7 w-7 text-primary" />
                </div>
              </div>

              {/* Content */}
              <h3 className="mb-3 text-xl font-semibold text-foreground">
                {card.title}
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                {card.description}
              </p>

              {/* Features */}
              <div className="space-y-2.5">
                {card.features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Check className="h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
