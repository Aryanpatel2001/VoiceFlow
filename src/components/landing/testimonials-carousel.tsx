"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Star, TrendingUp } from "lucide-react";
import Image from "next/image";

const testimonials = [
  {
    quote:
      "VoiceFlow Pro has been a game-changer for our HVAC business. We were losing 20+ calls a week during our busy summer season. Now every call is answered instantly, even at 2 AM. Setup took me 10 minutes.",
    name: "Mike Rodriguez",
    role: "Owner",
    company: "Comfort Climate HVAC",
    result: "$12,400 captured in 90 days",
    avatar:
      "https://images.unsplash.com/photo-1662556153586-223039dc8152?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  },
  {
    quote:
      "As a solo real estate agent, I can't answer calls while showing properties. VoiceFlow Pro books showings, qualifies buyers, and even follows up. It's like having a full-time assistant for $199/month.",
    name: "Sarah Chen",
    role: "Licensed Real Estate Agent",
    company: "Chen Properties",
    result: "34 showings booked automatically",
    avatar:
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  },
  {
    quote:
      "Our law firm gets calls 24/7. Before VoiceFlow Pro, we were missing potential clients after hours. Now our AI screens calls, books consultations, and we've seen a 40% increase in qualified leads.",
    name: "David Kimball",
    role: "Managing Partner",
    company: "Kimball & Associates Law",
    result: "$28,000 in new client revenue",
    avatar:
      "https://images.unsplash.com/photo-1658249682516-c7789d418978?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  },
  {
    quote:
      "I was skeptical about AI at first, but the voice quality is incredible. Clients don't realize they're talking to AI until I tell them. It handles scheduling, sends confirmations, and syncs with my calendar perfectly.",
    name: "Dr. Lisa Thompson",
    role: "Dentist",
    company: "Thompson Family Dentistry",
    result: "200+ appointments booked",
    avatar:
      "https://images.unsplash.com/photo-1766338390573-ec092d69cdcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  },
  {
    quote:
      "During our peak season, we get 100+ calls a day. VoiceFlow Pro handles the overflow flawlessly. It's cut our missed call rate to zero and our receptionist can focus on in-person customers.",
    name: "James Park",
    role: "Co-Owner",
    company: "Green Lawn Care Services",
    result: "$8,200 monthly revenue increase",
    avatar:
      "https://images.unsplash.com/photo-1758887261865-a2b89c0f7ac5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200",
  },
];

export function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (isAutoPlaying) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isAutoPlaying]);

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length
    );
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <section
      id="testimonials"
      className="relative overflow-hidden bg-background py-20 lg:py-32"
    >
      {/* Subtle Background */}
      <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl dark:bg-primary/10"></div>

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
            Loved by Business Owners Nationwide
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground"
          >
            Real results from real small businesses
          </motion.p>
        </div>

        {/* Carousel Container */}
        <div className="relative mx-auto max-w-5xl">
          <div className="overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-border bg-card p-8 shadow-lg lg:p-12"
              >
                <div className="grid items-start gap-8 lg:grid-cols-[auto,1fr]">
                  {/* Avatar */}
                  <div className="flex items-center gap-6 lg:flex-col lg:items-start">
                    <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-primary/20 lg:h-24 lg:w-24">
                      <Image
                        src={testimonials[currentIndex].avatar}
                        alt={testimonials[currentIndex].name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="lg:hidden">
                      <h4 className="font-semibold text-foreground">
                        {testimonials[currentIndex].name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {testimonials[currentIndex].role}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {testimonials[currentIndex].company}
                      </p>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-6">
                    {/* Stars */}
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className="h-5 w-5 fill-primary text-primary"
                        />
                      ))}
                    </div>

                    {/* Quote */}
                    <blockquote className="text-lg leading-relaxed text-foreground">
                      &ldquo;{testimonials[currentIndex].quote}&rdquo;
                    </blockquote>

                    {/* Author - Desktop */}
                    <div className="hidden lg:block">
                      <h4 className="font-semibold text-foreground">
                        {testimonials[currentIndex].name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {testimonials[currentIndex].role},{" "}
                        {testimonials[currentIndex].company}
                      </p>
                    </div>

                    {/* Result Badge */}
                    <div className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 dark:bg-primary/20">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        {testimonials[currentIndex].result}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Buttons */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={goToPrevious}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary transition-colors hover:bg-accent"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>

            {/* Dots */}
            <div className="flex gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setCurrentIndex(index);
                  }}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    index === currentIndex
                      ? "w-8 bg-primary"
                      : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={goToNext}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary transition-colors hover:bg-accent"
              aria-label="Next testimonial"
            >
              <ChevronRight className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
