/** Printable booking-form section layout (Canva-style editor). */

export const PRINT_BLOCK_IDS = [
  "header",
  "cover",
  "costSheet",
  "promoter",
  "landOwners",
  "projectDetails",
  "applicant",
  "jointApplicant",
  "geographic",
  "occupation",
  "sourceOfFund",
  "authority",
  "sourceOfEnquiry",
  "agents",
  "earnestDeposit",
  "terms",
  "consent",
  "signatures",
  "footer",
] as const;

export type PrintBlockId = (typeof PRINT_BLOCK_IDS)[number];

export type PrintLayoutBlock = {
  id: PrintBlockId;
  label: string;
  visible: boolean;
  /** Sort order in flow mode (lower first). */
  order: number;
  /** Horizontal position as % of page width (0–100). */
  x: number;
  /** Vertical position as % of one page height; may exceed 100 for later pages. */
  y: number;
  /** Width as % of page width (10–100). */
  w: number;
};

export type PrintLayout = {
  /** flow = document order; freeform = absolute positions on canvas. */
  mode: "flow" | "freeform";
  blocks: PrintLayoutBlock[];
};

const LABELS: Record<PrintBlockId, string> = {
  header: "Header / logos",
  cover: "Cover",
  costSheet: "Cost sheet",
  promoter: "Promoter",
  landOwners: "Land owners",
  projectDetails: "Project details",
  applicant: "First applicant",
  jointApplicant: "Joint applicant",
  geographic: "Geographic info",
  occupation: "Occupation",
  sourceOfFund: "Source of fund",
  authority: "Authority (POA)",
  sourceOfEnquiry: "Source of enquiry",
  agents: "Real estate agents",
  earnestDeposit: "Earnest deposit (READ)",
  terms: "Terms & declaration",
  consent: "Consent page",
  signatures: "Signatures",
  footer: "Footer",
};

/** Default stacked A4 flow layout. */
export function defaultPrintLayout(): PrintLayout {
  const blocks: PrintLayoutBlock[] = PRINT_BLOCK_IDS.map((id, i) => ({
    id,
    label: LABELS[id],
    visible: id !== "landOwners" && id !== "consent" ? true : id === "consent",
    order: i,
    x: 0,
    y: i * 12,
    w: 100,
  }));
  return { mode: "flow", blocks };
}

export function mergePrintLayout(
  partial?: Partial<PrintLayout> | null,
  opts?: { showLandOwners?: boolean; showConsentPage?: boolean }
): PrintLayout {
  const base = defaultPrintLayout();
  const byId = new Map(base.blocks.map((b) => [b.id, { ...b }]));
  for (const b of partial?.blocks ?? []) {
    if (!b?.id || !byId.has(b.id as PrintBlockId)) continue;
    const cur = byId.get(b.id as PrintBlockId)!;
    byId.set(b.id as PrintBlockId, {
      ...cur,
      ...b,
      id: b.id as PrintBlockId,
      label: LABELS[b.id as PrintBlockId] || cur.label,
    });
  }
  if (opts?.showLandOwners != null) {
    const lo = byId.get("landOwners")!;
    lo.visible = opts.showLandOwners;
  }
  if (opts?.showConsentPage != null) {
    const c = byId.get("consent")!;
    c.visible = opts.showConsentPage;
  }
  return {
    mode: partial?.mode === "freeform" ? "freeform" : "flow",
    blocks: Array.from(byId.values()).sort((a, b) => a.order - b.order),
  };
}
