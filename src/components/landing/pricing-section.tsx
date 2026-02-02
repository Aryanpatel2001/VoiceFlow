"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Zap } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Starter",
    badge: "For Small Teams",
    price: 199,
    annualPrice: 159,
    description: "Perfect for getting started",
    features: [
      "1,500 minutes included",
      "$0.08 per additional minute",
      "5 concurrent calls",
      "2 phone numbers",
      "All AI features included",
      "Google Calendar integration",
      "Basic analytics dashboard",
      "Email support",
      "Call recording & transcripts",
      "14-day free trial",
    ],
    highlighted: false,
    cta: "Start Free Trial",
  },
  {
    name: "Growth",
    badge: "MOST POPULAR",
    price: 499,
    annualPrice: 399,
    description: "For growing businesses",
    features: [
      "Everything in Starter, plus:",
      "5,000 minutes included",
      "$0.06 per additional minute",
      "25 concurrent calls",
      "10 phone numbers",
      "CRM integrations (HubSpot, Salesforce)",
      "Advanced analytics & ROI dashboard",
      "Multi-language support (30+ languages)",
      "Priority support (4-hour response)",
      "Custom voice cloning",
      "API access",
      "Dedicated account manager",
    ],
    highlighted: true,
    cta: "Start Free Trial",
  },
  {
    name: "Business",
    badge: "For Enterprises",
    price: 999,
    annualPrice: 799,
    description: "Maximum power & flexibility",
    features: [
      "Everything in Growth, plus:",
      "15,000 minutes included",
      "$0.05 per additional minute",
      "100 concurrent calls",
      "Unlimited phone numbers",
      "White-label option",
      "Custom integrations (3 per year)",
      "99.9% uptime SLA",
      "Dedicated success manager",
      "Custom AI training on your data",
      "SSO & advanced security",
      "Phone & email support",
      "Priority feature requests",
    ],
    highlighted: false,
    cta: "Contact Sales",
  },
];

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);

  return (
    <section
      id="pricing"
      className="relative overflow-hidden bg-background py-20 lg:py-32"
    >
      {/* Subtle Background */}
      <div className="absolute left-0 right-0 top-0 h-96 bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10"></div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-12 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-6 font-display text-4xl font-bold tracking-tight text-foreground lg:text-5xl"
          >
            Simple, Transparent Pricing
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-8 text-lg text-muted-foreground"
          >
            All-inclusive. No hidden fees. Cancel anytime.
          </motion.p>

          {/* Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary p-1"
          >
            <button
              onClick={() => setIsAnnual(false)}
              className={`rounded-md px-5 py-2 text-sm font-medium transition-all duration-200 ${
                !isAnnual
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`rounded-md px-5 py-2 text-sm font-medium transition-all duration-200 ${
                isAnnual
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="ml-2 text-xs">Save 20%</span>
            </button>
          </motion.div>
        </div>

        {/* Pricing Cards */}
        <div className="grid gap-6 md:grid-cols-3 lg:gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative rounded-2xl border bg-card p-8 transition-all duration-300 ${
                plan.highlighted
                  ? "border-primary shadow-lg md:-mt-4 md:mb-0"
                  : "border-border hover:border-primary/20 hover:shadow-lg"
              }`}
            >
              {/* Badge */}
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">
                    <Zap className="h-3 w-3" />
                    {plan.badge}
                  </div>
                </div>
              )}

              {!plan.highlighted && (
                <div className="mb-4">
                  <span className="text-xs font-medium text-muted-foreground">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan Name */}
              <h3 className="mb-2 text-2xl font-bold text-foreground">
                {plan.name}
              </h3>
              <p className="mb-6 text-sm text-muted-foreground">
                {plan.description}
              </p>

              {/* Price */}
              <div className="mb-8">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-5xl font-bold text-foreground">
                    ${isAnnual ? plan.annualPrice : plan.price}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                {isAnnual && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Billed annually (${plan.annualPrice * 12}/year)
                  </p>
                )}
              </div>

              {/* CTA Button */}
              <Link
                href={plan.cta === "Contact Sales" ? "/contact" : "/signup"}
                className={`mb-8 block w-full rounded-lg py-3 text-center font-medium transition-all duration-200 ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                    : "border border-border text-foreground hover:bg-secondary"
                }`}
              >
                {plan.cta}
              </Link>

              {/* Features List */}
              <ul className="space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="mb-4 text-muted-foreground">Need a custom plan?</p>
          <Link
            href="/contact"
            className="rounded-lg border border-border px-6 py-2.5 font-medium text-foreground transition-all duration-200 hover:bg-accent"
          >
            Talk to Sales
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
