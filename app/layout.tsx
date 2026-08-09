import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Serif display face for headings — warm, high-contrast, cookbook feel.
// Fraunces is a variable font, so the full weight range is available without
// listing weights explicitly.
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Clean sans for body copy and UI.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Recipe Vault",
    template: "%s · Recipe Vault",
  },
  description: "A private, premium home for your recipes.",
};

export const viewport: Viewport = {
  themeColor: "#22503b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
