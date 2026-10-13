import { Footer } from "@/components/Footer";
import { Masthead } from "@/components/Masthead";
import { TransitionProvider } from "@/components/motion/TransitionProvider";
import { BOOT_SCRIPT } from "@/lib/motion/boot";

// The museum's frame: the masthead and footer persist across its pages, and only the page content performs.
export default function MuseumLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Sets the motion marker before content paints. The marker itself is never in server HTML. */}
      <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      <TransitionProvider>
        <Masthead />
        {children}
        <Footer />
      </TransitionProvider>
    </>
  );
}
