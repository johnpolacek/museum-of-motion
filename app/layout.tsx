import type { Metadata } from "next";
import { Archivo, Bowlby_One, Bricolage_Grotesque, Caveat, Cormorant_Garamond, Fraunces, Geist, Geist_Mono, IBM_Plex_Mono, Instrument_Serif, JetBrains_Mono, Jost, Manrope, Space_Grotesk, Unbounded, VT323 } from "next/font/google";
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
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["SOFT", "opsz"], style: ["normal", "italic"], preload: false });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], preload: false });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], axes: ["wdth", "opsz"], preload: false });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], preload: false });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], preload: false });
const vt323 = VT323({ variable: "--font-vt323", subsets: ["latin"], weight: "400", preload: false });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], preload: false });
const bowlby = Bowlby_One({ variable: "--font-bowlby", subsets: ["latin"], weight: "400", preload: false });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"], preload: false });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], preload: false });
const unbounded = Unbounded({ variable: "--font-unbounded", subsets: ["latin"], preload: false });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space", subsets: ["latin"], preload: false });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"], preload: false });

export const metadata: Metadata = {
  title: "Museum of Motion",
  description:
    `${COUNT_WORDS} web animation effects, each shown on its own: what it does, what drives it, and how it handles touch, keyboard, and reduced motion.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${cormorant.variable} ${jost.variable} ${fraunces.variable} ${manrope.variable} ${bricolage.variable} ${geist.variable} ${geistMono.variable} ${vt323.variable} ${jetbrains.variable} ${bowlby.variable} ${plexMono.variable} ${caveat.variable} ${unbounded.variable} ${instrument.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
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
