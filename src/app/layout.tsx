import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenCreative",
  description: "A creative hub with an infinite canvas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
