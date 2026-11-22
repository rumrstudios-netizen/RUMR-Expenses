import type { Metadata } from "next";
import "./globals.css";
import "./ledger.css";

export const metadata: Metadata = {
  title: "Rumr Shoot Ledger",
  description: "Every shoot. Every expense.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
