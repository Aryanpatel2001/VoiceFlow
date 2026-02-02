/**
 * Flow Card
 *
 * Card component for the flow list page.
 * Shows flow name, status, node count, and actions.
 *
 * @module components/canvas/flow-card
 */

"use client";

import { useRouter } from "next/navigation";
import { MoreVertical, Edit, Copy, Trash2, CheckCircle2, FileEdit } from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface FlowCardProps {
  flow: {
    id: string;
    name: string;
    description?: string;
    status: "draft" | "published";
    nodeCount: number;
    updatedAt: string;
  };
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function FlowCard({ flow, onDuplicate, onDelete }: FlowCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  const handleEdit = useCallback(() => {
    router.push(`/dashboard/canvas/${flow.id}`);
  }, [router, flow.id]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      onClick={handleEdit}
      className="group border border-border rounded-lg bg-card hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
    >
      {/* Preview Area */}
      <div className="h-32 bg-muted/30 rounded-t-lg flex items-center justify-center border-b border-border">
        <div className="flex items-center gap-1.5 text-muted-foreground/50">
          <div className="h-6 w-12 border border-dashed border-muted-foreground/30 rounded text-[8px] flex items-center justify-center">
            Start
          </div>
          <div className="h-px w-4 bg-muted-foreground/30" />
          <div className="h-6 w-12 border border-dashed border-muted-foreground/30 rounded text-[8px] flex items-center justify-center">
            AI
          </div>
          <div className="h-px w-4 bg-muted-foreground/30" />
          <div className="h-6 w-12 border border-dashed border-muted-foreground/30 rounded text-[8px] flex items-center justify-center">
            End
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-medium text-foreground truncate flex-1">{flow.name}</h3>
          <div className="relative ml-2" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-10 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[140px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit();
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
                >
                  <Edit className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(flow.id);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-accent"
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(flow.id);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {flow.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            {flow.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
              flow.status === "published"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
            )}
          >
            {flow.status === "published" ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <FileEdit className="h-3 w-3" />
            )}
            {flow.status === "published" ? "Published" : "Draft"}
          </span>
          <span>{flow.nodeCount} nodes</span>
          <span>{formatDate(flow.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}
