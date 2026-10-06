import type { Metadata } from "next";
import { Archivo, Cormorant_Garamond, Jost } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Masthead } from "@/components/Masthead";
import { TransitionProvider } from "@/components/motion/TransitionProvider";
import { BOOT_SCRIPT } from "@/lib/motion/boot";
import { COUNT_WORDS } from "@/lib/exhibits";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// The vibes' own faces. Not preloaded: a browser fetches them only on the pages that use them.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  preload: false,
});
const jost = Jost({ variable: "--font-jost", subsets: ["latin"], weight: ["400", "500"], preload: false });

export const metadata: Metadata = {
  title: "Museum of Motion",
  description:
    `${COUNT_WORDS} web animation effects, each shown on its own: what it does, what drives it, and how it handles touch, keyboard, and reduced motion.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${cormorant.variable} ${jost.variable}`} suppressHydrationWarning>
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
