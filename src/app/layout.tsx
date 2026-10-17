import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/AppProvider";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "LinguaQuest AI — English from A0 toward B2",
  description: "Adaptive English learning for Uzbek speakers: speaking, listening, reading, writing and contextual vocabulary.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#141b30" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
