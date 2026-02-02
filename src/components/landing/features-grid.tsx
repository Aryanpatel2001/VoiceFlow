"use client";

import { motion } from "framer-motion";
import { Mic, Route, Globe, BarChart3, Link2, Shield } from "lucide-react";

const features = [
  {
    icon: Mic,
    title: "Crystal-Clear Voice Quality",
    description:
      "Advanced AI voice technology delivers natural, human-like conversations. Your customers won't know they're talking to AI.",
  },
  {
    icon: Route,
    title: "Intelligent Call Routing",
    description:
      "Route emergency calls to on-call staff, send routine inquiries to voicemail, and schedule callbacks based on custom rules you define.",
  },
  {
    icon: Globe,
    title: "Multi-Language Support",
    description:
      "Serve customers in English, Spanish, French, and 30+ other languages. Automatically detect language and respond accordingly.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description:
      "Track calls answered, appointments booked, revenue captured, and customer satisfaction. See your ROI in real-time.",
  },
  {
    icon: Link2,
    title: "Seamless Integrations",
    description:
      "Connect with Google Calendar, HubSpot, Salesforce, Jobber, ServiceTitan, and 50+ other tools you already use.",
  },
  {
    icon: Shield,
    title: "99.9% Uptime SLA",
    description:
      "Enterprise-grade reliability ensures your AI agent is always available when your customers call. Backed by our service guarantee.",
  },
];

export function FeaturesGrid() {
  return (
    <section
      id="features"
      className="relative overflow-hidden bg-background py-20 lg:py-32"
    >
      {/* Subtle Background */}
      <div className="absolute left-0 right-0 top-0 h-96 bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10"></div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-6 font-display text-4xl font-bold tracking-tight text-foreground lg:text-5xl"
          >
            Everything You Need to Succeed
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto max-w-3xl text-lg text-muted-foreground"
          >
            Powerful features designed for small business owners
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:border-primary/20 hover:shadow-lg"
            >
              {/* Icon */}
              <div className="mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
              </div>

              {/* Content */}
              <h3 className="mb-2.5 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
