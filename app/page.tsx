import Link from "next/link";
import { GROUPS, byGroup, two } from "@/lib/exhibits";

export default function Home() {
  return (
    <main>
      <section className="hero wrap blue" aria-labelledby="h">
        {/* Each word is caught mid-effect. The number is its exhibit. */}
        <h1 id="h" aria-label="Every way a page can move.">
          <span className="w" aria-hidden="true">
            <span className="ch">E</span>
            <span className="ch">v</span>
            <span className="ch" style={{ transform: "translateY(-10%)", opacity: 0.85 }}>e</span>
            <span className="ch" style={{ transform: "translateY(-26%)", opacity: 0.55 }}>r</span>
            <span className="ch" style={{ transform: "translateY(-46%)", opacity: 0.25 }}>y</span>
            <sup>02</sup>
          </span>{" "}
          <span className="w us" aria-hidden="true">
            way<i></i>
            <sup>39</sup>
          </span>{" "}
          <span className="w" aria-hidden="true">a</span>{" "}
          <span className="w pw" aria-hidden="true">
            <span style={{ fontWeight: 900 }}>p</span>
            <span style={{ fontWeight: 560 }}>a</span>
            <span style={{ fontWeight: 200 }}>g</span>
            <span style={{ fontWeight: 560 }}>e</span>
            <sup>06</sup>
          </span>{" "}
          <span className="w" aria-hidden="true">
            <span className="sk">can</span>
            <sup>29</sup>
          </span>{" "}
          <span className="w" aria-hidden="true">
            <span className="mk">
              <span style={{ transform: "translateY(22%)" }}>move.</span>
            </span>
            <sup>01</sup>
          </span>
        </h1>
        <div className="under">
          <p>
            Sixty-three web animation effects, each shown on its own: what it does, what drives it, and how it handles
            touch, keyboard, and reduced motion.
          </p>
          <ol className="lab" aria-label="In this headline">
            <li>01 Line mask</li>
            <li>02 Characters</li>
            <li>06 Weight wave</li>
            <li>29 Velocity skew</li>
            <li>39 Underline sweep</li>
          </ol>
        </div>
      </section>

      <section className="coll wrap" id="collection" aria-labelledby="coll-h">
        <header>
          <h2 id="coll-h">Collection</h2>
          <span className="lab">63 exhibits</span>
        </header>
        {GROUPS.map((g) => {
          const items = byGroup(g.key);
          return (
            <section className="grp" key={g.key} aria-labelledby={`g-${g.key}`}>
              <div className="side">
                <span className="lab" id={`g-${g.key}`}>
                  {g.name} · {items.length}
                </span>
                <p>{g.note}</p>
              </div>
              <p className="names">
                {items.map((e, i) => (
                  <span key={e.slug}>
                    {i > 0 && (
                      <span className="sep" aria-hidden="true">
                        {" / "}
                      </span>
                    )}
                    <Link href={`/exhibits/${e.slug}`}>
                      {e.name}
                      <sup className="num">{two(e.no)}</sup>
                    </Link>
                  </span>
                ))}
              </p>
            </section>
          );
        })}
      </section>
    </main>
  );
}
