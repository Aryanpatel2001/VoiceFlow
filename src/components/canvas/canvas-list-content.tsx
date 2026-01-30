/**
 * Canvas List Content
 *
 * Client component for the flows list page.
 * Displays flow cards in a grid, handles creating, duplicating, and deleting flows.
 *
 * @module components/canvas/canvas-list-content
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2, LayoutGrid } from "lucide-react";
import { FlowCard } from "./flow-card";
import { TemplatePicker } from "./template-picker";
import { FLOW_TEMPLATES } from "@/lib/canvas/templates";

interface Flow {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "published";
  nodeCount: number;
  updatedAt: string;
}

export function CanvasListContent() {
  const router = useRouter();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Fetch flows
  useEffect(() => {
    async function fetchFlows() {
      try {
        const response = await fetch("/api/flows");
        if (response.ok) {
          const data = await response.json();
          setFlows(data.flows);
        }
      } catch {
        // Silently fail - empty state shown
      } finally {
        setLoading(false);
      }
    }

    fetchFlows();
  }, []);

  // Create new flow
  const handleCreate = useCallback(
    async (templateId: string | null) => {
      setCreating(true);
      try {
        const template = templateId
          ? FLOW_TEMPLATES.find((t) => t.id === templateId)
          : null;

        const body: Record<string, unknown> = {
          name: template ? template.name : "Untitled Flow",
          description: template?.description || "",
        };

        if (template) {
          body.nodes = template.nodes;
          body.edges = template.edges;
          body.variables = template.variables;
          body.settings = template.settings;
        }

        const response = await fetch("/api/flows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = await response.json();
          router.push(`/dashboard/canvas/${data.flow.id}`);
        }
      } catch {
        // Error handling
      } finally {
        setCreating(false);
      }
    },
    [router]
  );

  // Duplicate flow
  const handleDuplicate = useCallback(async (flowId: string) => {
    try {
      const response = await fetch(`/api/flows/${flowId}/duplicate`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setFlows((prev) => [data.flow, ...prev]);
      }
    } catch {
      // Error handling
    }
  }, []);

  // Delete flow
  const handleDelete = useCallback(async (flowId: string) => {
    if (!confirm("Are you sure you want to delete this flow?")) return;

    try {
      const response = await fetch(`/api/flows/${flowId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setFlows((prev) => prev.filter((f) => f.id !== flowId));
      }
    } catch {
      // Error handling
    }
  }, []);

  const filteredFlows = search
    ? flows.filter(
        (f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.description?.toLowerCase().includes(search.toLowerCase())
      )
    : flows;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agent Flows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build and manage your AI voice agent conversation flows
          </p>
        </div>
        <button
          onClick={() => setTemplatePickerOpen(true)}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          New Flow
        </button>
      </div>

      {/* Search */}
      {flows.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search flows..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-border rounded-md outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && flows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-lg">
          <LayoutGrid className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-sm font-medium text-foreground mb-1">No flows yet</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Create your first agent flow to get started
          </p>
          <button
            onClick={() => setTemplatePickerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Flow
          </button>
        </div>
      )}

      {/* Flow Grid */}
      {!loading && filteredFlows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFlows.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* No search results */}
      {!loading && flows.length > 0 && filteredFlows.length === 0 && (
        <p className="text-center py-10 text-sm text-muted-foreground">
          No flows match &ldquo;{search}&rdquo;
        </p>
      )}

      {/* Template Picker Dialog */}
      <TemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={handleCreate}
      />
    </div>
  );
}
