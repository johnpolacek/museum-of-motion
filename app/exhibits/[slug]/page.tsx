import type { Metadata } from "next";
import { ExhibitMotion } from "@/components/ExhibitMotion";
import { ExhibitStage } from "@/components/ExhibitStage";
import { TransitionLink } from "@/components/motion/TransitionLink";
import { notFound } from "next/navigation";
import { EXHIBITS, SPECS, groupName, recipeUrl, two } from "@/lib/exhibits";
import { MOTION_EXHIBITS } from "@/lib/motion/ready";

export const dynamicParams = false;

export function generateStaticParams() {
  return EXHIBITS.map((e) => ({ slug: e.slug }));
}

const find = (slug: string) => EXHIBITS.find((e) => e.slug === slug);

export async function generateMetadata({ params }: PageProps<"/exhibits/[slug]">): Promise<Metadata> {
  const e = find((await params).slug);
  return { title: e ? `${two(e.no)} ${e.name} · Museum of Motion` : "Museum of Motion" };
}

export default async function ExhibitPage({ params }: PageProps<"/exhibits/[slug]">) {
  const e = find((await params).slug);
  if (!e) notFound();

  const total = EXHIBITS.length;
  const prev = EXHIBITS[(e.no - 2 + total) % total];
  const next = EXHIBITS[e.no % total];
  const specs: [string, string][] = SPECS[e.slug] ?? [
    ["Builders", e.builders],
    ["Group", groupName(e.group)],
  ];

  return (
    <ExhibitMotion slug={e.slug}>
      <div className="bar lab" data-intro>
        <span>
          {groupName(e.group)} · {two(e.no)} of {total}
        </span>
        <nav aria-label="Exhibits">
          <TransitionLink href={`/exhibits/${prev.slug}`}>← {prev.name}</TransitionLink>
          <TransitionLink href={`/exhibits/${next.slug}`}>{next.name} →</TransitionLink>
        </nav>
      </div>
      <h1 id="ex-h" data-intro>
        <span className="n num">{two(e.no)}</span>
        <span className="t" data-flip-id={e.slug}>
          {e.name}
        </span>
      </h1>
      {MOTION_EXHIBITS.has(e.slug) ? (
        <ExhibitStage desc={e.desc} labels={[e.name, ...(e.vars ?? [])]} />
      ) : (
        <>
          <div className="stage" data-intro>
            <p>
              Every way a page
              <br />
              can move.
            </p>
          </div>
          <div className="row" data-intro>
            <p>{e.desc}</p>
            {e.vars && (
              <ul className="tabs" aria-label="Variations">
                {[e.name, ...e.vars].map((v, i) => (
                  <li key={v} className={i === 0 ? "on" : undefined}>
                    {v}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      <dl className="specs" data-intro>
        {specs.map(([k, v]) => (
          <div key={k}>
            <dt className="lab">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="row" data-intro>
        <span></span>
        <a className="src lab" href={recipeUrl(e)}>
          View the recipe ↗
        </a>
      </div>
    </ExhibitMotion>
  );
}
