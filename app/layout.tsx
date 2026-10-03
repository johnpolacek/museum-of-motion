import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Link from "next/link";
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
    <html lang="en" className={archivo.variable}>
      <body>
        <header className="mast wrap blue">
          <Link className="word" href="/">
            Museum of Motion
          </Link>
          <nav className="lab" aria-label="Main">
            <Link href="/#collection">Collection</Link>
            <Link href="/about">About</Link>
          </nav>
        </header>
        {children}
        <footer className="foot wrap blue">
          <div className="big">Museum of Motion</div>
          <nav className="lab" aria-label="Credits">
            <a href="https://github.com/johnpolacek/animaxxing-skills">Animaxxing skills ↗</a>
            <a href="https://github.com/greensock/gsap-skills">Official GSAP skills ↗</a>
            <a href="https://gsap.com">GSAP ↗</a>
            <span>Type: Archivo</span>
          </nav>
        </footer>
      </body>
    </html>
  );
}
