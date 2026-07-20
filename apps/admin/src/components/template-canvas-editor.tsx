"use client";

import { useCallback, useRef, useState } from "react";
import { Button, Input, Label } from "@booking/ui";
import {
  defaultPrintLayout,
  mergePrintLayout,
  type PrintBlockId,
  type PrintLayout,
  type PrintLayoutBlock,
} from "@booking/validators";

type DragState =
  | { kind: "move"; id: PrintBlockId; startX: number; startY: number; origX: number; origY: number }
  | { kind: "resize"; id: PrintBlockId; startX: number; origW: number }
  | null;

const PAGE_W = 420;
const PAGE_H = 594; // A4-ish at ~0.5 scale (210×297)

export function TemplateCanvasEditor({
  layout,
  onChange,
  showLandOwners,
  showConsentPage,
}: {
  layout: PrintLayout | undefined;
  onChange: (next: PrintLayout) => void;
  showLandOwners: boolean;
  showConsentPage: boolean;
}) {
  const merged = mergePrintLayout(layout, { showLandOwners, showConsentPage });
  const layoutRef = useRef(merged);
  layoutRef.current = merged;
  const [selected, setSelected] = useState<PrintBlockId | null>(null);
  const drag = useRef<DragState>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const updateBlocks = useCallback(
    (mutator: (blocks: PrintLayoutBlock[]) => PrintLayoutBlock[]) => {
      const cur = layoutRef.current;
      onChange({
        ...cur,
        blocks: mutator(cur.blocks.map((b) => ({ ...b }))),
      });
    },
    [onChange]
  );

  const setMode = (mode: PrintLayout["mode"]) => {
    onChange({ ...merged, mode });
  };

  const patchBlock = (id: PrintBlockId, patch: Partial<PrintLayoutBlock>) => {
    updateBlocks((blocks) => blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const moveOrder = (id: PrintBlockId, dir: -1 | 1) => {
    updateBlocks((blocks) => {
      const sorted = [...blocks].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((b) => b.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= sorted.length) return blocks;
      const a = sorted[idx]!;
      const b = sorted[swap]!;
      const ao = a.order;
      a.order = b.order;
      b.order = ao;
      return sorted;
    });
  };

  const onPointerDownMove = (e: React.PointerEvent, id: PrintBlockId) => {
    if (merged.mode !== "freeform") return;
    e.preventDefault();
    e.stopPropagation();
    const block = merged.blocks.find((b) => b.id === id);
    if (!block) return;
    setSelected(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      kind: "move",
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: block.x,
      origY: block.y,
    };
  };

  const onPointerDownResize = (e: React.PointerEvent, id: PrintBlockId) => {
    if (merged.mode !== "freeform") return;
    e.preventDefault();
    e.stopPropagation();
    const block = merged.blocks.find((b) => b.id === id);
    if (!block) return;
    setSelected(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind: "resize", id, startX: e.clientX, origW: block.w };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    if (d.kind === "move") {
      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = ((e.clientY - d.startY) / rect.height) * 100;
      patchBlock(d.id, {
        x: Math.max(0, Math.min(90, d.origX + dx)),
        y: Math.max(0, d.origY + dy),
      });
    } else {
      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      patchBlock(d.id, { w: Math.max(20, Math.min(100, d.origW + dx)) });
    }
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const maxY = Math.max(100, ...merged.blocks.filter((b) => b.visible).map((b) => b.y + 16));
  const boardHeight = merged.mode === "freeform" ? (PAGE_H * maxY) / 100 : PAGE_H * 2.2;
  const selectedBlock = merged.blocks.find((b) => b.id === selected);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-navy-600">Canvas layout</p>
          <p className="text-xs text-slate-500">
            Drag sections, resize width, reorder, or hide blocks. Freeform uses absolute positions on
            the printable page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={merged.mode === "flow" ? "default" : "outline"}
            onClick={() => setMode("flow")}
          >
            Flow order
          </Button>
          <Button
            type="button"
            size="sm"
            variant={merged.mode === "freeform" ? "default" : "outline"}
            onClick={() => setMode("freeform")}
          >
            Freeform (Canva)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange(
                mergePrintLayout(defaultPrintLayout(), { showLandOwners, showConsentPage })
              )
            }
          >
            Reset layout
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="max-h-[640px] space-y-2 overflow-auto rounded-xl border bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sections
          </p>
          {[...merged.blocks]
            .sort((a, b) => a.order - b.order)
            .map((b) => (
              <div
                key={b.id}
                className={`rounded-lg border px-2 py-2 text-sm ${
                  selected === b.id ? "border-teal-500 bg-teal-50" : "border-slate-200"
                } ${!b.visible ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={b.visible}
                    onChange={(e) => patchBlock(b.id, { visible: e.target.checked })}
                  />
                  <button
                    type="button"
                    className="flex-1 text-left font-medium text-navy-600"
                    onClick={() => setSelected(b.id)}
                  >
                    {b.label}
                  </button>
                  <button
                    type="button"
                    className="rounded px-1 text-xs text-slate-500 hover:bg-slate-100"
                    onClick={() => moveOrder(b.id, -1)}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded px-1 text-xs text-slate-500 hover:bg-slate-100"
                    onClick={() => moveOrder(b.id, 1)}
                    title="Move down"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
        </div>

        <div className="overflow-auto rounded-xl border bg-slate-200/80 p-4">
          <div
            ref={boardRef}
            className="relative mx-auto bg-[linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] shadow-md"
            style={{
              width: PAGE_W,
              height: boardHeight,
              backgroundColor: "#fff",
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onClick={() => setSelected(null)}
          >
            {/* page guides */}
            {Array.from({ length: Math.ceil(boardHeight / PAGE_H) }).map((_, i) => (
              <div
                key={i}
                className="pointer-events-none absolute left-0 right-0 border-b border-dashed border-amber-400/70"
                style={{ top: (i + 1) * PAGE_H }}
              >
                <span className="absolute right-1 top-0 text-[10px] text-amber-700">
                  Page {i + 2}
                </span>
              </div>
            ))}

            {merged.blocks
              .filter((b) => b.visible)
              .sort((a, b) => a.order - b.order)
              .map((b, idx) => {
                const top =
                  merged.mode === "freeform"
                    ? `${b.y}%`
                    : `${8 + idx * 9}%`;
                const left = merged.mode === "freeform" ? `${b.x}%` : "4%";
                const width = merged.mode === "freeform" ? `${b.w}%` : "92%";
                return (
                  <div
                    key={b.id}
                    role="button"
                    tabIndex={0}
                    className={`absolute cursor-grab rounded-md border-2 bg-white/95 px-2 py-2 shadow-sm active:cursor-grabbing ${
                      selected === b.id
                        ? "border-teal-500 ring-2 ring-teal-200"
                        : "border-slate-300 hover:border-teal-400"
                    }`}
                    style={{
                      top,
                      left,
                      width,
                      minHeight: 36,
                      zIndex: selected === b.id ? 20 : 1,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(b.id);
                    }}
                    onPointerDown={(e) => onPointerDownMove(e, b.id)}
                  >
                    <div className="truncate text-xs font-semibold text-navy-600">{b.label}</div>
                    <div className="mt-1 h-1.5 rounded bg-slate-100" />
                    <div className="mt-1 h-1.5 w-2/3 rounded bg-slate-100" />
                    {merged.mode === "freeform" ? (
                      <div
                        className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-tl bg-teal-500"
                        onPointerDown={(e) => onPointerDownResize(e, b.id)}
                      />
                    ) : null}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {selectedBlock ? (
        <div className="grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-4">
          <p className="sm:col-span-4 text-sm font-semibold text-navy-600">
            Selected: {selectedBlock.label}
          </p>
          <div>
            <Label>X %</Label>
            <Input
              className="mt-1"
              type="number"
              value={selectedBlock.x}
              disabled={merged.mode !== "freeform"}
              onChange={(e) => patchBlock(selectedBlock.id, { x: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Y %</Label>
            <Input
              className="mt-1"
              type="number"
              value={selectedBlock.y}
              disabled={merged.mode !== "freeform"}
              onChange={(e) => patchBlock(selectedBlock.id, { y: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Width %</Label>
            <Input
              className="mt-1"
              type="number"
              value={selectedBlock.w}
              disabled={merged.mode !== "freeform"}
              onChange={(e) => patchBlock(selectedBlock.id, { w: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Order</Label>
            <Input
              className="mt-1"
              type="number"
              value={selectedBlock.order}
              onChange={(e) => patchBlock(selectedBlock.id, { order: Number(e.target.value) })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
