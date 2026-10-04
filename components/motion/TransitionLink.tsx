"use client";

// next/link with an outro. onNavigate fires only for same-origin client navigation,
// so modified clicks, new tabs, and downloads stay native.
import Link from "next/link";
import { useRef, type ComponentProps } from "react";
import { useTransitionController } from "./TransitionProvider";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function TransitionLink({ href, replace, scroll, onNavigate, onClick, ...rest }: Props) {
  const { navigate } = useTransitionController();
  // onClick runs before onNavigate in the same click: it tells the outro which link was chosen.
  const source = useRef<Element | null>(null);
  return (
    <Link
      href={href}
      replace={replace}
      scroll={scroll}
      onClick={(e) => {
        source.current = e.currentTarget;
        onClick?.(e);
      }}
      onNavigate={(e) => {
        onNavigate?.(e);
        navigate(e, href, { replace, scroll, source: source.current });
        source.current = null;
      }}
      {...rest}
    />
  );
}
