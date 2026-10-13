import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VibeFull } from "@/components/VibeFull";
import { EXHIBITS } from "@/lib/exhibits";

// A vibe in its own tab: the page from the exhibit's stage window, filling the viewport, with no museum frame.
export const dynamicParams = false;

const VIBES = EXHIBITS.filter((e) => e.group === "vibes");

export function generateStaticParams() {
  return VIBES.map((e) => ({ slug: e.slug }));
}

const find = (slug: string) => VIBES.find((e) => e.slug === slug);

export async function generateMetadata({ params }: PageProps<"/vibes/[slug]">): Promise<Metadata> {
  const e = find((await params).slug);
  return { title: e ? `${e.name}, full page · Museum of Motion` : "Museum of Motion", description: e?.desc };
}

export default async function VibePage({ params }: PageProps<"/vibes/[slug]">) {
  const e = find((await params).slug);
  if (!e) notFound();
  return <VibeFull slug={e.slug} name={e.name} />;
}
