import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/lib/toast/context";
import { ToastContainer } from "@/components/ui/toast";

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
      <body className="antialiased" suppressHydrationWarning>
        <ToastProvider>
          {children}
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  );
}
