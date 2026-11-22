import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jujuy Pay · Turismo y economías regionales",
  description:
    "Telemetría en vivo de la Quebrada de Humahuaca: ocupación, energía solar y economía local.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-black text-white">{children}</body>
    </html>
  );
}
