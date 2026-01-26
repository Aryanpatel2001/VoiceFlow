import {
  Navigation,
  HeroSection,
  SocialProofTicker,
  ValuePropositions,
  ProductDemo,
  FeaturesGrid,
  ROICalculator,
  TestimonialsCarousel,
  PricingSection,
  FAQSection,
  FinalCTA,
  Footer,
} from "@/components/landing";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Navigation />
      <main>
        <HeroSection />
        <SocialProofTicker />
        <ValuePropositions />
        <ProductDemo />
        <FeaturesGrid />
        <ROICalculator />
        <TestimonialsCarousel />
        <PricingSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
