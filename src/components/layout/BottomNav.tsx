"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/supabase/auth-provider";

function ExploreIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      {active ? (
        <path fill="currentColor" stroke="none" fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 0 13.5 6.75 6.75 0 0 0 0-13.5ZM2.25 10.5a8.25 8.25 0 1 1 14.59 5.28l4.69 4.69a.75.75 0 1 1-1.06 1.06l-4.69-4.69A8.25 8.25 0 0 1 2.25 10.5Z" clipRule="evenodd" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      )}
    </svg>
  );
}

function MapIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={active ? 0 : 1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0-8.25a1.5 1.5 0 1 1 3 0m-3 0a1.5 1.5 0 1 0 3 0m3-3v17.25m0 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h17.25" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={active ? 0 : 1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function BookmarkIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={active ? 0 : 1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();

  const tabs = [
    { href: "/explore", label: "Explore", Icon: ExploreIcon },
    { href: "/map", label: "Map", Icon: MapIcon },
    { href: "/log", label: "Log", Icon: null },
    {
      href: profile ? `/profile/${profile.username}` : "/profile",
      label: "Profile",
      Icon: ProfileIcon,
    },
    { href: "/saved", label: "Saved", Icon: BookmarkIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-cream-dark bg-white/95 backdrop-blur-sm pb-safe">
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/log"
              ? false
              : pathname.startsWith(tab.href.split("/").slice(0, 2).join("/"));

          if (tab.href === "/log") {
            return (
              <Link
                key={tab.label}
                href="/log"
                className="flex min-h-[48px] min-w-[48px] flex-col items-center justify-center py-1.5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-cream">
                  <PlusIcon />
                </span>
                <span className="mt-0.5 text-[10px] text-ink-light">{tab.label}</span>
              </Link>
            );
          }

          const { Icon } = tab;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`flex min-h-[48px] min-w-[48px] flex-col items-center justify-center py-1.5 ${
                isActive ? "text-rust" : "text-ink-light"
              }`}
            >
              {Icon && <Icon active={isActive} />}
              <span className="mt-0.5 text-[10px]">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
