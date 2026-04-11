export interface StaticEntry {
  id: string;
  title: string;
  description: string;
  date: string;
  priority?: "high" | "medium" | "low";
}

// ─── MANUALLY MAINTAINED ISSUES ───────────────────────────────────────────────
// Add or remove entries here to update what appears on the Dashboard.
export const STATIC_ISSUES: StaticEntry[] = [
  {
    id: "i1",
    title: "Low attendance compliance in South region",
    description:
      "Several FSEs in South region have repeated attendance lapses. Needs follow-up from regional manager.",
    date: "2026-03-10",
    priority: "high",
  },
  {
    id: "i2",
    title: "Incomplete EOD picture submissions",
    description:
      "EOD picture lapses reported for 5 FSEs across Central and West zones in Feb 2026.",
    date: "2026-03-05",
    priority: "medium",
  },
  {
    id: "i3",
    title: "Product knowledge gaps - Tineco range",
    description:
      "Customer complaints about incorrect product demos for Tineco range. Training refresher recommended.",
    date: "2026-02-28",
    priority: "medium",
  },
];

// ─── MANUALLY MAINTAINED SUGGESTIONS ─────────────────────────────────────────
// Add or remove entries here to update what appears on the Dashboard.
export const STATIC_SUGGESTIONS: StaticEntry[] = [
  {
    id: "s1",
    title: "Introduce weekly performance check-ins",
    description:
      "Brief weekly calls between TLs and FSEs to review targets and address blockers early.",
    date: "2026-03-12",
  },
  {
    id: "s2",
    title: "Gamify top performer recognition",
    description:
      "Add monthly leaderboard updates shared over WhatsApp group to boost motivation.",
    date: "2026-03-08",
  },
  {
    id: "s3",
    title: "Standardise demo visit reporting format",
    description:
      "Create a uniform template for demo visit reports across all regions to ease data consolidation.",
    date: "2026-02-25",
  },
];
