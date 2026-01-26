"use client";

import { useState, useEffect } from "react";
import { motion, animate } from "framer-motion";
import { ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";

export function ROICalculator() {
  const [missedCalls, setMissedCalls] = useState(50);
  const [dealValue, setDealValue] = useState(200);
  const [displayValue, setDisplayValue] = useState(0);

  const monthlyLoss = missedCalls * 4 * dealValue;
  const potentialROI = monthlyLoss - 199;

  useEffect(() => {
    const controls = animate(displayValue, monthlyLoss, {
      duration: 1,
      onUpdate: (v) => setDisplayValue(Math.round(v)),
    });

    return () => controls.stop();
  }, [monthlyLoss, displayValue]);

  return (
    <section className="relative overflow-hidden bg-secondary/30 py-20 lg:py-32">
      {/* Subtle Background */}
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl dark:bg-primary/10"></div>
      </div>

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Container Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-2xl border border-border bg-card p-8 shadow-xl lg:p-12"
        >
          {/* Content */}
          <div className="space-y-10">
            {/* Header */}
            <div className="space-y-3 text-center">
              <h2 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
                How Much Revenue Are You Losing?
              </h2>
              <p className="text-muted-foreground">
                Calculate your monthly losses from missed calls
              </p>
            </div>

            {/* Inputs */}
            <div className="grid gap-8 md:grid-cols-2">
              {/* Slider Input */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-foreground">
                  Missed calls per week
                </label>
                <div className="space-y-3">
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={missedCalls}
                    onChange={(e) => setMissedCalls(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-md [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
                    style={{
                      background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${
                        (missedCalls / 200) * 100
                      }%, hsl(var(--secondary)) ${(missedCalls / 200) * 100}%, hsl(var(--secondary)) 100%)`,
                    }}
                  />
                  <div className="text-3xl font-bold text-primary">
                    {missedCalls}
                  </div>
                </div>
              </div>

              {/* Number Input */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-foreground">
                  Average deal/service value
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={dealValue}
                    onChange={(e) => setDealValue(Number(e.target.value))}
                    className="h-12 w-full rounded-lg border border-border bg-secondary pl-10 pr-4 text-lg text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Result Display */}
            <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-8 dark:bg-primary/10">
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>Your Monthly Lost Revenue</span>
                </div>
                <div className="font-display text-5xl font-bold text-foreground lg:text-6xl">
                  ${displayValue.toLocaleString()}
                </div>
                {potentialROI > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Potential monthly savings:{" "}
                    <span className="font-semibold text-foreground">
                      ${potentialROI.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Explanation */}
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Based on {missedCalls} missed calls per week × 4 weeks × $
                {dealValue} average value
              </p>
              <Link href="/signup">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90"
                >
                  Start Recovering Lost Revenue
                  <ArrowRight className="h-5 w-5" />
                </motion.button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
