"use client";

import { useRef, useMemo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { UnitCard } from "./unit-card";
import type { UnitCardData } from "../lib/utils";
import { useGridColumns } from "../hooks/use-grid-columns";

interface UnitGridProps {
  units: UnitCardData[];
  currentUserId?: string;
  onUnitClick?: (unit: UnitCardData) => void;
  selectedUnitIds?: string[];
  columns?: number;
  maxColumns?: number;
  showHeatmap?: boolean;
  heatmapData?: Record<string, number>;
  blockingAllowed?: boolean;
  selectionMode?: "sales" | "admin";
}

function estimateRowHeight(rowUnits: UnitCardData[]): number {
  const hasBlockDetails = rowUnits.some(
    (u) => (u.status === "BLOCKED" && u.block) || u.pendingApproval
  );
  // Blocked cards add block owner label + countdown timer below the fold.
  return hasBlockDetails ? 224 : 152;
}

export function UnitGrid({
  units,
  currentUserId,
  onUnitClick,
  selectedUnitIds = [],
  columns: columnsProp,
  maxColumns = 4,
  showHeatmap,
  heatmapData = {},
  blockingAllowed = true,
  selectionMode = "sales",
}: UnitGridProps) {
  const autoColumns = useGridColumns(maxColumns);
  const columns = columnsProp ?? autoColumns;
  const parentRef = useRef<HTMLDivElement>(null);
  const rowCount = Math.ceil(units.length / columns);

  const rows = useMemo(() => {
    const result: UnitCardData[][] = [];
    for (let i = 0; i < rowCount; i++) {
      result.push(units.slice(i * columns, (i + 1) * columns));
    }
    return result;
  }, [units, columns, rowCount]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateRowHeight(rows[index] ?? []),
    overscan: 5,
  });

  // Re-measure when unit data changes (e.g. block status / timer section appears).
  useEffect(() => {
    virtualizer.measure();
  }, [units, columns, rowCount]); // virtualizer.measure is stable enough; omit virtualizer from deps

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowUnits = rows[virtualRow.index] ?? [];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="grid gap-3 px-1 pb-3"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              }}
            >
              {rowUnits.map((unit) => (
                <UnitCard
                  key={unit.id}
                  unit={unit}
                  currentUserId={currentUserId}
                  onClick={onUnitClick}
                  selected={selectedUnitIds.includes(unit.id)}
                  showHeatmap={showHeatmap}
                  heatLevel={heatmapData[unit.towerCode] ?? 0}
                  blockingAllowed={blockingAllowed}
                  selectionMode={selectionMode}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
