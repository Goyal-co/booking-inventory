"use client";

import { use } from "react";
import Link from "next/link";
import { Button } from "@booking/ui";
import { ProjectBookingFormTemplatePanel } from "@/components/project-booking-form-template";

export default function ProjectBookingFormTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/projects/${id}`}>
          <Button variant="outline" size="sm">
            ← Back to Project
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Booking Form Template</h1>
      </div>
      <p className="text-sm text-gray-600">
        Configure the customer booking form from Template Example 1 or Example 2. Every project can
        customize logos, project/RERA details, promoter, land owners, collection account, KYC copy,
        terms, and the consent page.
      </p>
      <ProjectBookingFormTemplatePanel projectId={id} />
    </div>
  );
}
