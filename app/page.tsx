import { CollectionMotion } from "@/components/CollectionMotion";
import { Hero } from "@/components/Hero";
import { TransitionLink } from "@/components/motion/TransitionLink";
import { GROUPS, byGroup, two } from "@/lib/exhibits";

export default function Home() {
  return (
    <main>
      <Hero />

      <CollectionMotion>
        <header className="coll-head" data-intro>
          <h2 id="coll-h">Collection</h2>
          <span className="lab">63 exhibits</span>
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
                  <span key={e.slug}>
                    {i > 0 && (
                      <span className="sep" aria-hidden="true">
                        {" / "}
                      </span>
                    )}
                    <TransitionLink href={`/exhibits/${e.slug}`}>
                      {e.name}
                      <sup className="num">{two(e.no)}</sup>
                    </TransitionLink>
                  </span>
                ))}
              </p>
            </section>
          );
        })}
      </CollectionMotion>
    </main>
  );
}
