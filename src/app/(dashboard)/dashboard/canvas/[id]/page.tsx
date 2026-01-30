/**
 * Canvas Editor Page
 *
 * Full-featured visual flow builder.
 * Loads flow data, provides autosave, keyboard shortcuts,
 * and renders the canvas with all panels.
 *
 * @module app/(dashboard)/dashboard/canvas/[id]/page
 */

import { Suspense } from "react";
import { CanvasEditor } from "@/components/canvas/canvas-editor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CanvasEditorPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading canvas...</p>
          </div>
        </div>
      }
    >
      <CanvasEditor flowId={id} />
    </Suspense>
  );
}
