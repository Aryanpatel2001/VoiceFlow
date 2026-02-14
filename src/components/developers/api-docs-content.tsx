/**
 * API Documentation Content
 *
 * Developer documentation and API reference.
 */

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Code,
  Key,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Zap,
  Shield,
  Terminal,
  Webhook,
  Phone,
  GitBranch,
  BarChart3,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EndpointDoc {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  tag: string;
}

const endpoints: EndpointDoc[] = [
  // Flows
  { method: "GET", path: "/api/flows", description: "List all flows", tag: "Flows" },
  { method: "POST", path: "/api/flows", description: "Create a new flow", tag: "Flows" },
  { method: "GET", path: "/api/flows/{id}", description: "Get flow by ID", tag: "Flows" },
  { method: "PATCH", path: "/api/flows/{id}", description: "Update flow", tag: "Flows" },
  { method: "DELETE", path: "/api/flows/{id}", description: "Delete flow", tag: "Flows" },
  { method: "POST", path: "/api/flows/{id}/publish", description: "Publish flow", tag: "Flows" },
  { method: "GET", path: "/api/flows/{id}/versions", description: "List flow versions", tag: "Flows" },
  // Calls
  { method: "GET", path: "/api/calls", description: "List calls", tag: "Calls" },
  { method: "GET", path: "/api/calls/{id}", description: "Get call by ID", tag: "Calls" },
  // Phone Numbers
  { method: "GET", path: "/api/phone-numbers", description: "List phone numbers", tag: "Phone Numbers" },
  { method: "POST", path: "/api/phone-numbers", description: "Purchase phone number", tag: "Phone Numbers" },
  // Campaigns
  { method: "GET", path: "/api/campaigns", description: "List campaigns", tag: "Campaigns" },
  { method: "POST", path: "/api/campaigns", description: "Create campaign", tag: "Campaigns" },
  { method: "POST", path: "/api/campaigns/{id}/start", description: "Start campaign", tag: "Campaigns" },
  // Analytics
  { method: "GET", path: "/api/analytics", description: "Get analytics data", tag: "Analytics" },
  // Export
  { method: "GET", path: "/api/export/calls", description: "Export calls to CSV/JSON", tag: "Export" },
  { method: "GET", path: "/api/export/analytics", description: "Export analytics", tag: "Export" },
  { method: "GET", path: "/api/export/flows", description: "Export flows", tag: "Export" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export function ApiDocsContent() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-success/10 text-success";
      case "POST":
        return "bg-primary/10 text-primary";
      case "PATCH":
        return "bg-warning/10 text-warning";
      case "DELETE":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const tags = Array.from(new Set(endpoints.map((e) => e.tag)));
  const filteredEndpoints = selectedTag
    ? endpoints.filter((e) => e.tag === selectedTag)
    : endpoints;

  const exampleCode = {
    curl: `curl -X GET "https://api.voiceflowpro.com/api/flows" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`,
    javascript: `const response = await fetch('https://api.voiceflowpro.com/api/flows', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data.flows);`,
    python: `import requests

response = requests.get(
    'https://api.voiceflowpro.com/api/flows',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    }
)

data = response.json()
print(data['flows'])`,
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-foreground">API Documentation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Integrate VoiceFlow Pro into your applications
        </p>
      </motion.div>

      {/* Quick Links */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <a
          href="/openapi.yaml"
          target="_blank"
          className="card-premium p-4 flex items-center gap-3 hover:border-primary/50 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">OpenAPI Spec</p>
            <p className="text-xs text-muted-foreground">Download YAML</p>
          </div>
        </a>

        <div className="card-premium p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
            <Shield className="h-5 w-5 text-success" />
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">Authentication</p>
            <p className="text-xs text-muted-foreground">Bearer tokens</p>
          </div>
        </div>

        <div className="card-premium p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
            <Zap className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">Rate Limits</p>
            <p className="text-xs text-muted-foreground">100 req/min</p>
          </div>
        </div>

        <div className="card-premium p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
            <Webhook className="h-5 w-5 text-info" />
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">Webhooks</p>
            <p className="text-xs text-muted-foreground">Real-time events</p>
          </div>
        </div>
      </motion.div>

      {/* Authentication */}
      <motion.div variants={itemVariants} className="card-premium p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Key className="h-5 w-5" />
          Authentication
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          All API requests require authentication using a Bearer token. Include your API key
          in the Authorization header of every request.
        </p>
        <div className="rounded-lg bg-muted p-4 relative">
          <pre className="text-sm font-mono text-foreground overflow-x-auto">
            Authorization: Bearer YOUR_API_KEY
          </pre>
          <button
            onClick={() => copyToClipboard("Authorization: Bearer YOUR_API_KEY", "auth")}
            className="absolute top-2 right-2 p-2 rounded-md hover:bg-background/50 transition-colors"
          >
            {copiedCode === "auth" ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </motion.div>

      {/* Code Examples */}
      <motion.div variants={itemVariants} className="card-premium p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Terminal className="h-5 w-5" />
          Quick Start
        </h2>
        <div className="space-y-4">
          {/* cURL */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">cURL</span>
              <button
                onClick={() => copyToClipboard(exampleCode.curl, "curl")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {copiedCode === "curl" ? (
                  <>
                    <Check className="h-3 w-3" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy
                  </>
                )}
              </button>
            </div>
            <pre className="rounded-lg bg-muted p-4 text-xs font-mono text-foreground overflow-x-auto">
              {exampleCode.curl}
            </pre>
          </div>

          {/* JavaScript */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">JavaScript</span>
              <button
                onClick={() => copyToClipboard(exampleCode.javascript, "js")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {copiedCode === "js" ? (
                  <>
                    <Check className="h-3 w-3" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy
                  </>
                )}
              </button>
            </div>
            <pre className="rounded-lg bg-muted p-4 text-xs font-mono text-foreground overflow-x-auto">
              {exampleCode.javascript}
            </pre>
          </div>

          {/* Python */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Python</span>
              <button
                onClick={() => copyToClipboard(exampleCode.python, "python")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {copiedCode === "python" ? (
                  <>
                    <Check className="h-3 w-3" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy
                  </>
                )}
              </button>
            </div>
            <pre className="rounded-lg bg-muted p-4 text-xs font-mono text-foreground overflow-x-auto">
              {exampleCode.python}
            </pre>
          </div>
        </div>
      </motion.div>

      {/* Endpoints */}
      <motion.div variants={itemVariants} className="card-premium p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Code className="h-5 w-5" />
          API Endpoints
        </h2>

        {/* Tag Filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedTag(null)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors",
              !selectedTag
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                selectedTag === tag
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Endpoints List */}
        <div className="space-y-2">
          {filteredEndpoints.map((endpoint, index) => (
            <div
              key={`${endpoint.method}-${endpoint.path}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
            >
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-semibold min-w-[60px] text-center",
                  getMethodColor(endpoint.method)
                )}
              >
                {endpoint.method}
              </span>
              <code className="text-sm font-mono text-foreground flex-1">
                {endpoint.path}
              </code>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {endpoint.description}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Rate Limits */}
      <motion.div variants={itemVariants} className="card-premium p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Rate Limits
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium text-muted-foreground">Endpoint Type</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Limit</th>
                <th className="text-left py-2 font-medium text-muted-foreground">Window</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-2 text-foreground">Auth endpoints</td>
                <td className="py-2 text-foreground">5 requests</td>
                <td className="py-2 text-muted-foreground">per minute</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 text-foreground">Read endpoints</td>
                <td className="py-2 text-foreground">100 requests</td>
                <td className="py-2 text-muted-foreground">per minute</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 text-foreground">Write endpoints</td>
                <td className="py-2 text-foreground">30 requests</td>
                <td className="py-2 text-muted-foreground">per minute</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-2 text-foreground">Voice endpoints</td>
                <td className="py-2 text-foreground">10 requests</td>
                <td className="py-2 text-muted-foreground">per minute</td>
              </tr>
              <tr>
                <td className="py-2 text-foreground">Webhook endpoints</td>
                <td className="py-2 text-foreground">1000 requests</td>
                <td className="py-2 text-muted-foreground">per minute</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Rate limit headers are included in all responses: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
        </p>
      </motion.div>
    </motion.div>
  );
}
