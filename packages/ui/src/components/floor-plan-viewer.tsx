"use client";

import { Download, ZoomIn } from "lucide-react";
import { Button } from "./button";

interface FloorPlanViewerProps {
  name: string;
  imageUrl?: string | null;
  pdfUrl?: string | null;
  bhkType?: string;
  carpetArea?: number;
  amenities?: string[];
}

export function FloorPlanViewer({
  name,
  imageUrl,
  pdfUrl,
  bhkType,
  carpetArea,
  amenities = [],
}: FloorPlanViewerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-gray-900">{name}</h4>
          <p className="text-sm text-gray-500">
            {[bhkType, carpetArea ? `${carpetArea} sqft` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          </a>
        )}
      </div>

      {imageUrl ? (
        <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <img src={imageUrl} alt={name} className="max-h-80 w-full object-contain" />
          {pdfUrl && (
            <div className="absolute bottom-2 right-2">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm">
                  <ZoomIn className="h-4 w-4" />
                  Open PDF
                </Button>
              </a>
            </div>
          )}
        </div>
      ) : pdfUrl ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <iframe
            src={pdfUrl}
            title={`${name} floor plan`}
            className="h-[50vh] w-full md:h-[28rem]"
          />
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-400">No floor plan uploaded yet</p>
        </div>
      )}

      {amenities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {amenities.map((tag) => (
            <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
