import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { SiteShell } from "@/components/layout/site-shell";
import "./globals.css";

const body = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Aurelia Casino Симулятор",
  description: "Мобильный casino-симулятор со слотами, крашем, минами и архитектурой под Supabase.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={`${body.variable} ${body.variable} font-body antialiased`}>
        <SessionProvider>
          <SiteShell>{children}</SiteShell>
        </SessionProvider>
      </body>
    </html>
  );
}