#!/usr/bin/env bash
# Setup: 3 feature branches, then merge into main.
# Run from project root: bash scripts/setup-git-branches.sh

set -e
cd "$(dirname "$0")/.."

echo "==> 1. Initialize repo and commit base (config + shared code)"
git init
git add .gitignore package.json package-lock.json next.config.mjs tsconfig.json tailwind.config.ts postcss.config.mjs .eslintrc.json .prettierrc .env.example sql/ scripts/
git add src/app/layout.tsx src/app/globals.css src/lib/utils.ts src/lib/db/index.ts src/lib/encryption.ts src/lib/fonts.ts
git add src/components/providers/ src/components/shared/

# Minimal home page so app builds without landing
cat > src/app/page.tsx << 'PAGE'
/** Minimal home for base commit. Replaced on feature/landing. */
export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <h1 className="text-2xl font-bold">VoiceFlow Pro</h1>
    </div>
  );
}
PAGE
git add src/app/page.tsx
git commit -m "chore: initial project setup (config, shared lib, providers)"
git branch -m main

echo "==> 2. Branch feature/landing: landing page + components + config"
git checkout -b feature/landing
# Restore full landing page
cat > src/app/page.tsx << 'PAGE'
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
PAGE
git add src/app/page.tsx src/components/landing/ src/config/
git commit -m "feat: landing page with navigation, hero, pricing, FAQ, CTA"

echo "==> 3. Branch feature/auth: authentication (login, signup, NextAuth)"
git checkout main
git checkout -b feature/auth
git add src/app/\(auth\)/ src/app/api/auth/ src/lib/auth/ src/services/ src/types/
git commit -m "feat: authentication (login, signup, NextAuth, credentials + Google)"

echo "==> 4. Branch feature/dashboard: dashboard + onboarding"
git checkout main
git checkout -b feature/dashboard
git add "src/app/(dashboard)/" src/app/onboarding/ src/app/api/onboarding/ src/components/dashboard/ src/components/onboarding/
git commit -m "feat: dashboard and onboarding (org setup, shell, sidebar)"

echo "==> 5. Merge all 3 branches into main"
git checkout main
git merge feature/landing -m "Merge feature/landing: landing page"
git merge feature/auth -m "Merge feature/auth: authentication"
git merge feature/dashboard -m "Merge feature/dashboard: dashboard and onboarding"

echo "Done. Branches: main, feature/landing, feature/auth, feature/dashboard"
git log --oneline -8
