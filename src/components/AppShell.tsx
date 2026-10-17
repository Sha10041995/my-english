"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { t, type TKey } from "@/lib/i18n";
import { levelFromXp } from "@/lib/gamification/rewards";
import { useApp } from "./AppProvider";
import { Bar, Notice } from "./ui";

const NAV: { href: string; key: TKey; icon: string }[] = [
  { href: "/", key: "nav.dashboard", icon: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" },
  { href: "/learn", key: "nav.learn", icon: "M3 6l9-3 9 3v6c0 5-4 8-9 9-5-1-9-4-9-9z" },
  { href: "/speaking", key: "nav.speaking", icon: "M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zm-7 9a7 7 0 0014 0m-7 7v3" },
  { href: "/reading", key: "nav.reading", icon: "M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2zm0 14a2 2 0 012-2h12" },
  { href: "/listening", key: "nav.listening", icon: "M4 14v-2a8 8 0 0116 0v2m-16 0h3v5H4zm13 0h3v5h-3z" },
  { href: "/writing", key: "nav.writing", icon: "M4 20l4-1 11-11-3-3L5 16zm10-14l3 3" },
  { href: "/vocabulary", key: "nav.vocabulary", icon: "M5 4h10a4 4 0 014 4v12H9a4 4 0 01-4-4zm4 4h6" },
  { href: "/exam", key: "nav.exam", icon: "M9 3h6v3H9zM6 5h12v16H6zm3 7h6m-6 4h4" },
  { href: "/progress", key: "nav.progress", icon: "M4 20V10m6 10V4m6 16v-7m4 7H2" },
  { href: "/settings", key: "nav.settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zm7-3l2-1-2-4-2 1a7 7 0 00-2-1l-.5-2h-5L9 7a7 7 0 00-2 1l-2-1-2 4 2 1a7 7 0 000 2l-2 1 2 4 2-1a7 7 0 002 1l.5 2h5l.5-2a7 7 0 002-1l2 1 2-4-2-1a7 7 0 000-2z" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state, ready, lang, toasts, saveFailed, recovered } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const needsOnboarding = ready && !state.profile.onboarded && pathname !== "/onboarding";
  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);

  const lvl = levelFromXp(state.xp);

  if (pathname === "/onboarding") {
    return (
      <div className="min-h-screen">
        <main id="main" className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        <Toasts toasts={toasts} />
      </div>
    );
  }

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active ? "bg-white/15 text-white" : "text-[#b9c2dc] hover:bg-white/10 hover:text-white"}`}
          >
            <Icon d={n.icon} />
            {t(n.key, lang)}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <a href="#main" className="skip-link">Skip to content</a>

      <aside className="hidden bg-night p-4 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6">
        <Brand />
        {nav}
        <XpBox lang={lang} xp={state.xp} level={lvl.level} into={lvl.into} needed={lvl.needed} streak={state.streak.current} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-night px-4 py-3 text-white lg:hidden">
          <Brand compact />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/20"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
        </header>
        {open && (
          <div id="mobile-nav" className="z-20 bg-night p-4 text-white lg:hidden">
            {nav}
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {recovered && <div className="mb-4"><Notice tone="warn">Saved data could not be read, so a fresh profile was started. The old data was kept in a backup key in your browser.</Notice></div>}
          {saveFailed && <div className="mb-4"><Notice tone="error">Your browser blocked saving progress (private mode or storage full). Export your data from Settings to avoid losing it.</Notice></div>}
          {!ready ? <p className="text-sm text-muted">{t("common.loading", lang)}</p> : needsOnboarding ? null : children}
        </main>
      </div>
      <Toasts toasts={toasts} />
    </div>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 px-1">
      <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-black">LQ</span>
      <span>
        <span className="block text-base font-extrabold leading-tight">LinguaQuest AI</span>
        {!compact && <span className="block text-xs text-[#9fa9c6]">A0 → B2</span>}
      </span>
    </Link>
  );
}

function XpBox({ lang, xp, level, into, needed, streak }: { lang: "uz" | "en"; xp: number; level: number; into: number; needed: number; streak: number }) {
  return (
    <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{lang === "uz" ? `${level}-daraja` : `Level ${level}`}</span>
        <span className="text-[#c7cff0]">{xp} XP</span>
      </div>
      <div className="my-2"><Bar value={into / needed} label="XP progress" tone="sun" /></div>
      <p className="text-xs text-[#9fa9c6]">{lang === "uz" ? `Seriya: ${streak} kun` : `Streak: ${streak} day(s)`}</p>
    </div>
  );
}

function Toasts({ toasts }: { toasts: { id: number; text: string }[] }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((x) => (
        <div key={x.id} className="pop-in rounded-xl bg-night px-4 py-3 text-sm font-medium text-white shadow-lg">{x.text}</div>
      ))}
    </div>
  );
}
