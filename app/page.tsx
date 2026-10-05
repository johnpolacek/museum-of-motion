import { Fragment } from "react";
import { CollectionMotion } from "@/components/CollectionMotion";
import { Hero } from "@/components/Hero";
import { HomeLanding } from "@/components/HomeLanding";
import { TransitionLink } from "@/components/motion/TransitionLink";
import { EXHIBITS, GROUPS, byGroup, two } from "@/lib/exhibits";

export default function Home() {
  return (
    <main>
      <HomeLanding />
      <Hero />

      <CollectionMotion>
        <header className="coll-head" data-intro>
          <h2 id="coll-h">Collection</h2>
          <span className="lab">{EXHIBITS.length} exhibits</span>
        </header>
        {GROUPS.map((g) => {
          const items = byGroup(g.key);
          return (
            <section className="grp" key={g.key} aria-labelledby={`g-${g.key}`} data-intro>
              <i className="grp-rule" aria-hidden="true"></i>
              <div className="side">
                <span className="lab" id={`g-${g.key}`}>
                  {g.name} · {items.length}
                </span>
                <p>{g.note}</p>
              </div>
              <p className="names">
                {items.map((e, i) => (
                  // Each name holds its trailing slash, so a slash ends a line and never starts one.
                  // The space between items sits outside, where the line may break.
                  <Fragment key={e.slug}>
                  <span className="item">
                    <TransitionLink href={`/exhibits/${e.slug}`}>
                      <span data-flip-id={e.slug}>{e.name}</span>
                      <sup className="num">{two(e.no)}</sup>
                    </TransitionLink>
                    {i < items.length - 1 && (
                      <span className="sep" aria-hidden="true">
                        {" /"}
                      </span>
                    )}
                  </span>{" "}
                  </Fragment>
                ))}
              </p>
            </section>
          );
        })}
      </CollectionMotion>
    </main>
  );
}
