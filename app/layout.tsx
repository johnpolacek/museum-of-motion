import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Masthead } from "@/components/Masthead";
import { TransitionProvider } from "@/components/motion/TransitionProvider";
import { BOOT_SCRIPT } from "@/lib/motion/boot";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Museum of Motion",
  description:
    "Sixty-three web animation effects, each shown on its own: what it does, what drives it, and how it handles touch, keyboard, and reduced motion.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={archivo.variable} suppressHydrationWarning>
      <body>
        {/* Sets the motion marker before content paints. The marker itself is never in server HTML. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        <TransitionProvider>
          <Masthead />
          {children}
          <Footer />
        </TransitionProvider>
      </body>
    </html>
  );
}
