"use client";

// next/link with an outro. onNavigate fires only for same-origin client navigation,
// so modified clicks, new tabs, and downloads stay native.
import Link from "next/link";
import type { ComponentProps } from "react";
import { useTransitionController } from "./TransitionProvider";

type Props = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

export function TransitionLink({ href, replace, scroll, onNavigate, ...rest }: Props) {
  const { navigate } = useTransitionController();
  return (
    <Link
      href={href}
      replace={replace}
      scroll={scroll}
      onNavigate={(e) => {
        onNavigate?.(e);
        navigate(e, href, { replace, scroll });
      }}
      {...rest}
    />
  );
}
