export const siteConfig = {
  name: "VoiceFlow Pro",
  description: "AI Voice Agents for Home Services",
  url: "https://voiceflowpro.com",
  ogImage: "https://voiceflowpro.com/og-image.png",
  links: {
    twitter: "https://twitter.com/voiceflowpro",
    github: "https://github.com/voiceflowpro",
    linkedin: "https://linkedin.com/company/voiceflowpro",
  },
  creator: "VoiceFlow Pro Team",
};

export const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "FAQ", href: "#faq" },
];

export const footerLinks = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Integrations", href: "#integrations" },
    { label: "Changelog", href: "/changelog" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Careers", href: "/careers" },
    { label: "Contact", href: "/contact" },
  ],
  resources: [
    { label: "Documentation", href: "/docs" },
    { label: "Help Center", href: "/help" },
    { label: "API Reference", href: "/api" },
    { label: "Status", href: "https://status.voiceflowpro.com" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
  ],
};

export const stats = [
  { value: "10K+", label: "Calls Handled Daily" },
  { value: "500+", label: "Happy Customers" },
  { value: "98%", label: "Call Resolution Rate" },
  { value: "<2s", label: "Average Response Time" },
];

export const testimonials = [
  {
    quote:
      "VoiceFlow Pro has transformed how we handle calls. Our after-hours booking rate increased by 340%.",
    author: "Mike Johnson",
    role: "Owner",
    company: "Johnson's HVAC",
    avatar: "/avatars/mike.jpg",
    rating: 5,
  },
  {
    quote:
      "The AI sounds so natural that customers can't tell the difference. It's like having a 24/7 receptionist.",
    author: "Sarah Chen",
    role: "Operations Manager",
    company: "Premier Plumbing",
    avatar: "/avatars/sarah.jpg",
    rating: 5,
  },
  {
    quote:
      "Setup took 10 minutes and the ROI was immediate. We're saving $3,000/month compared to our old answering service.",
    author: "David Martinez",
    role: "CEO",
    company: "Elite Electric",
    avatar: "/avatars/david.jpg",
    rating: 5,
  },
];

export const pricingPlans = [
  {
    name: "Starter",
    description: "Perfect for small businesses just getting started",
    price: 199,
    period: "month",
    features: [
      "1,500 minutes included",
      "2 phone numbers",
      "Basic analytics",
      "Email support",
      "Standard voice quality",
      "5 concurrent calls",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Growth",
    description: "For growing businesses that need more power",
    price: 499,
    period: "month",
    features: [
      "5,000 minutes included",
      "10 phone numbers",
      "Advanced analytics",
      "Priority support",
      "Premium voice quality",
      "25 concurrent calls",
      "Custom voice cloning",
      "API access",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "For large organizations with custom needs",
    price: null,
    period: "month",
    features: [
      "Unlimited minutes",
      "Unlimited phone numbers",
      "Custom integrations",
      "Dedicated success manager",
      "SLA guarantee",
      "White-label option",
      "Custom LLM training",
      "On-premise deployment",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

export const faqs = [
  {
    question: "How long does it take to set up?",
    answer:
      "Most customers are up and running in under 5 minutes. Simply sign up, connect your phone number, customize your greeting, and you're live. No coding required.",
  },
  {
    question: "Can the AI handle complex conversations?",
    answer:
      "Yes! Our AI uses advanced natural language processing to understand context, handle interruptions, and manage multi-turn conversations naturally. It can book appointments, answer FAQs, and qualify leads.",
  },
  {
    question: "What happens if the AI can't handle a call?",
    answer:
      "Our smart transfer system detects when a call needs human attention and seamlessly transfers to your team with a full context summary. You can also set custom rules for when to transfer.",
  },
  {
    question: "Do you integrate with my existing tools?",
    answer:
      "We integrate with popular tools like ServiceTitan, Housecall Pro, Google Calendar, and more. We also offer a REST API and webhooks for custom integrations.",
  },
  {
    question: "Is there a contract or commitment?",
    answer:
      "No long-term contracts. All plans are month-to-month, and you can cancel anytime. We also offer a 14-day free trial with no credit card required.",
  },
  {
    question: "How natural does the AI voice sound?",
    answer:
      "Our AI uses state-of-the-art voice synthesis that sounds remarkably human. Most callers can't tell they're speaking with an AI. You can also customize the voice personality and speaking style.",
  },
];
