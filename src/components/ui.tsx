"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "success";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-brand-soft",
  ghost: "bg-transparent text-brand hover:bg-brand-soft",
  success: "bg-leaf text-white hover:opacity-90",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 min-h-11";

export function Button({ variant = "primary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}

export function LinkButton({ href, variant = "primary", className = "", children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "", as: Tag = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`rounded-(--radius-card) border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(27,34,54,0.04)] ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function Pill({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "sun" | "leaf" | "berry" | "neutral" }) {
  const tones = {
    brand: "bg-brand-soft text-brand-strong",
    sun: "bg-sun-soft text-[#7a4b00]",
    leaf: "bg-leaf-soft text-[#146342]",
    berry: "bg-berry-soft text-berry",
    neutral: "bg-[#efece4] text-muted",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Bar({ value, label, tone = "brand" }: { value: number; label: string; tone?: "brand" | "leaf" | "sun" }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const color = { brand: "bg-brand", leaf: "bg-leaf", sun: "bg-sun" }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2.5 w-full overflow-hidden rounded-full bg-[#ece8de]">
      <div className={`h-full rounded-full ${color} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-widest text-muted">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const tones = {
    info: "border-brand/25 bg-brand-soft text-ink",
    warn: "border-sun/50 bg-sun-soft text-ink",
    error: "border-berry/40 bg-berry-soft text-ink",
    ok: "border-leaf/30 bg-leaf-soft text-ink",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function SourceBadge({ source, lang }: { source: "demo" | "ai" | "rule-based" | "auto-graded"; lang: "uz" | "en" }) {
  if (source === "ai") return <Pill tone="brand">{lang === "uz" ? "AI tomonidan yaratilgan" : "AI-generated"}</Pill>;
  if (source === "auto-graded") return <Pill tone="neutral">{lang === "uz" ? "Avto-tekshiruv" : "Auto-graded"}</Pill>;
  return <Pill tone="sun">{lang === "uz" ? "Demo: qoidaga asoslangan, AI emas" : "Demo: rule-based, not AI"}</Pill>;
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none" />
      {label}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-(--radius-card) border border-dashed border-line bg-surface/60 p-8 text-center">
      <p className="text-lg font-bold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
