"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

const faqs = [
  {
    question: "How quickly can I get started?",
    answer:
      "You can set up your AI voice agent in as little as 5 minutes. Simply sign up, connect your phone number, choose your industry template, and customize your agent's responses. No coding or technical knowledge required. We also offer guided setup assistance if needed.",
  },
  {
    question: "What happens if my AI agent can't answer a question?",
    answer:
      "Your AI agent is trained to handle 90%+ of common inquiries. For questions it can't answer, it can take a message, schedule a callback, or immediately transfer to your team based on rules you define. You have complete control over escalation protocols.",
  },
  {
    question: "Can I customize what my AI agent says?",
    answer:
      "Absolutely. You can customize greetings, responses, qualifying questions, and even your agent's personality. Use our visual workflow builder to create custom conversation paths without any coding. Changes go live instantly.",
  },
  {
    question: "Does it integrate with my existing tools?",
    answer:
      "Yes. VoiceFlow Pro integrates with 50+ popular tools including Google Calendar, HubSpot, Salesforce, Jobber, ServiceTitan, Slack, and more. We also offer Zapier integration for thousands of additional connections and a full API for custom integrations.",
  },
  {
    question: "What if I exceed my plan's minutes?",
    answer:
      "Overage is simple and transparent. Starter: $0.08/minute, Growth: $0.06/minute, Business: $0.05/minute. You'll receive alerts at 80% and 100% usage. You can upgrade your plan anytime for better rates, and there are no surprise bills.",
  },
  {
    question: "How does billing work?",
    answer:
      'All plans are billed monthly or annually (save 20% with annual). Your 14-day free trial includes full access to all features—no credit card required. After your trial, you\'ll only be charged if you decide to continue. Cancel anytime, no contracts.',
  },
  {
    question: "Is my customer data secure?",
    answer:
      "Yes. We're SOC 2 Type II certified and HIPAA compliant. All calls are encrypted, data is stored securely, and we never share your information with third parties. We also offer GDPR-compliant data processing for international customers.",
  },
  {
    question: "What kind of support do you offer?",
    answer:
      "All plans include email support with 24-hour response time. Growth plans get priority support (4-hour response) and a dedicated account manager. Business plans include phone support and a dedicated success manager. We also have extensive documentation and video tutorials.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-background py-20 lg:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-6 font-display text-4xl font-bold tracking-tight text-foreground lg:text-5xl"
          >
            Frequently Asked Questions
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground"
          >
            Everything you need to know about VoiceFlow Pro
          </motion.p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between px-6 py-5 text-left transition-colors hover:bg-accent"
              >
                <span className="pr-8 font-semibold text-foreground">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="mb-4 text-muted-foreground">Still have questions?</p>
          <Link
            href="/contact"
            className="rounded-lg border border-border px-6 py-2.5 font-medium text-foreground transition-all duration-200 hover:bg-accent"
          >
            Contact Support
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
