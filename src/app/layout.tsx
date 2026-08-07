import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CP Platform — Collective Perspectives",
  description: "Internal project management platform for Collective Perspectives. Redefining Ability. Reimagining Possibility.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/*
          THESIS: CP Platform as an architect's project binder — each route is a
          numbered sheet with a title block, ruled panels, and revision-mark
          status. Refuses the generic SaaS stat-card dashboard.
          OWN-WORLD: Vellum canvas, ink structure, coral signature accent.
          Bricolage Grotesque display + Spline Sans body. Hairline borders, no
          floating shadows, tabular figures. Sidebar as binder-cover sheet index.
          STORY: The team sees what needs attention, coordinates work, records
          revenue, and reports — with the quiet authority of a well-maintained
          project documentation system.
          FIRST VIEWPORT: Title block header with route identity and context
          metadata, sheet-summary strip with inline metrics, ruled panels for
          content. Primary action sits in the title block.
          FORM: Candidate 7 of 7 grounded directions, seed key b345cf44.
          FINISH: unreviewed and undocumented is unfinished; this build ends
          with the finish review, the verdict, and DESIGN.md
        */}
        {children}
      </body>
    </html>
  );
}
