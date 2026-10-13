import type { Metadata } from "next";
import { AboutMotion } from "@/components/AboutMotion";

export const metadata: Metadata = { title: "About · Museum of Motion" };

export default function About() {
  return (
    <AboutMotion>
      <section className="about wrap" aria-labelledby="about-h">
        <h1 id="about-h" className="lab" style={{ margin: 0 }} data-intro>
          About
        </h1>
        <div>
          <p data-intro>
            Museum of Motion is a fictional museum. Its exhibits are the effect recipes in{" "}
            <a href="https://github.com/johnpolacek/animaxxing-skills">Animaxxing skills</a>.
          </p>
          <p data-intro>
            It is the demo for “Animating with Agents,” an article on{" "}
            <a href="https://tympanus.net/codrops/">Codrops</a>.
          </p>
        </div>
      </section>
    </AboutMotion>
  );
}
