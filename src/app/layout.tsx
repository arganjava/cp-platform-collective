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
        {children}
      </body>
    </html>
  );
}
