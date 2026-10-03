import type { Metadata } from "next";

export const metadata: Metadata = { title: "About · Museum of Motion" };

export default function About() {
  return (
    <main>
      <section className="about wrap" aria-labelledby="about-h">
        <h1 id="about-h" className="lab" style={{ margin: 0 }}>
          About
        </h1>
        <div>
          <p>
            Museum of Motion is a fictional museum. Its exhibits are the effect recipes in{" "}
            <a href="https://github.com/johnpolacek/animaxxing-skills">Animaxxing skills</a>.
          </p>
          <p>
            It is the demo for “Animating with Agents,” an article on{" "}
            <a href="https://tympanus.net/codrops/">Codrops</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
