"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@booking/ui";
import { ProjectCostConfigPanel } from "@/components/project-cost-config";

export default function ProjectCostConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/projects/${id}`}>
          <Button variant="outline" size="sm">
            Back to project
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Cost Sheet Configuration</h1>
      </div>
      <p className="text-sm text-gray-600">
        Admin can configure every cost sheet field for this project: default ₹/sq.ft, GST, payment
        milestones, other charges, and unit master inventory. Sales and customer booking forms use
        these settings dynamically.
      </p>
      <ProjectCostConfigPanel projectId={id} />
    </div>
  );
}
