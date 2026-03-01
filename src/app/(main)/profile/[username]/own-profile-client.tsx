"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import CityBoardCard from "@/components/profile/CityBoardCard";
import type { MapPin } from "@/components/profile/ProfileMap";

const ProfileMap = dynamic(() => import("@/components/profile/ProfileMap"), {
  ssr: false,
  loading: () => <div className="w-full h-[200px] rounded-xl bg-cream-dark animate-pulse" />,
});

// ── Types ──

interface ProfileData {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  cityName: string | null;
}

interface StatsData {
  places: number;
  lists: number;
  followers: number;
  following: number;
}

interface CityBoard {
  cityName: string;
  savedCount: number;
  photos: (string | null)[];
}

interface ListData {
  id: string;
  title: string;
  placeCount: number;
  coverPhoto: string | null;
}

interface RecentLog {
  id: string;
  placeId: string;
  name: string;
  neighborhood: string;
  rating: number;
  photoUrl: string | null;
}

interface OwnProfileClientProps {
  profile: ProfileData;
  stats: StatsData;
  mapPins: MapPin[];
  mapCenter?: [number, number];
  logCount: number;
  saveCount: number;
  cityName: string | null;
  vibeTags: string[];
  cityBoards: CityBoard[];
  lists: ListData[];
  recentLogs: RecentLog[];
}

// ── Sub-components ──

function SectionHeader({ children }: { children: string }) {
  return (
    <h3 className="px-4 text-xs font-medium uppercase tracking-[0.15em] text-ink-light leading-none">
      {children}
    </h3>
  );
}

function RatingHearts({ filled, size = 12 }: { filled: number; size?: number }) {
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={i < filled ? "#6B6E8A" : "none"}
          stroke={i < filled ? "#6B6E8A" : "#F0ECE6"}
          strokeWidth={i < filled ? 0 : 2}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      ))}
    </div>
  );
}

// ── Main component ──

export default function OwnProfileClient({
  profile,
  stats,
  mapPins,
  mapCenter,
  logCount,
  saveCount,
  cityName,
  vibeTags,
  cityBoards,
  lists,
  recentLogs,
}: OwnProfileClientProps) {
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* ─── TOP BAR ─── */}
      <div className="sticky top-0 z-20 bg-cream border-b border-cream-dark pt-[env(safe-area-inset-top)] pb-3 px-4 flex items-center justify-between">
        <span className="font-serif text-xl text-ink leading-tight tracking-tight">
          immersion
        </span>
        <Link
          href={`/profile/${profile.username}/edit`}
          className="w-11 h-11 flex items-center justify-center"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6B6B6B"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
      </div>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <div className="flex-1 pb-[88px]">
        {/* ── PROFILE HEADER ── */}
        <div className="pt-5 px-4">
          {/* Avatar + text */}
          <div className="flex items-start gap-3.5">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName || profile.username}
                className="w-16 h-16 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-cream-dark flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-medium text-ink-light uppercase">
                  {(profile.displayName || profile.username).charAt(0)}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-serif text-[22px] text-ink leading-tight">
                {profile.displayName || profile.username}
              </p>
              {profile.cityName && (
                <div className="flex items-center gap-1 mt-1">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6B6B6B"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span className="text-sm text-ink-light">{profile.cityName}</span>
                </div>
              )}
              {profile.bio && (
                <p className="mt-1.5 text-sm text-ink leading-relaxed line-clamp-2">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <span className="text-sm">
              <span className="font-medium text-ink">{stats.places}</span>{" "}
              <span className="text-ink-light">places</span>
            </span>
            <span className="text-sm">
              <span className="font-medium text-ink">{stats.lists}</span>{" "}
              <span className="text-ink-light">lists</span>
            </span>
            <Link href={`/profile/${profile.username}/followers`} className="text-sm">
              <span className="font-medium text-ink">{stats.followers}</span>{" "}
              <span className="text-ink-light">followers</span>
            </Link>
            <Link href={`/profile/${profile.username}/following`} className="text-sm">
              <span className="font-medium text-ink">{stats.following}</span>{" "}
              <span className="text-ink-light">following</span>
            </Link>
          </div>

          {/* Edit Profile button */}
          <Link
            href={`/profile/${profile.username}/edit`}
            className="inline-block mt-3.5 px-5 py-2 text-sm font-medium text-indigo border border-indigo/30 rounded-full leading-none"
          >
            Edit Profile
          </Link>
        </div>

        {/* ── YOUR MAP ── */}
        {mapPins.length > 0 && (
          <div className="mt-7">
            <SectionHeader>YOUR MAP</SectionHeader>
            <div className="mt-3 px-4">
              <ProfileMap pins={mapPins} center={mapCenter} />
              <p className="mt-2 text-xs text-ink-light text-center">
                {logCount} logged{saveCount > 0 ? ` \u00b7 ${saveCount} saved` : ""}
                {cityName ? ` in ${cityName}` : ""}
              </p>
            </div>
          </div>
        )}

        {/* ── TASTE SIGNATURE ── */}
        {vibeTags.length > 0 && (
          <div className="mt-7">
            <SectionHeader>TASTE SIGNATURE</SectionHeader>
            <div className="mt-3 px-4 flex flex-wrap gap-2">
              {vibeTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block text-[13px] font-medium text-indigo bg-cream rounded-full px-2.5 py-1 leading-tight whitespace-nowrap"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── SAVED FROM LOCALS ── */}
        {cityBoards.length > 0 && (
          <div className="mt-7">
            <SectionHeader>SAVED FROM LOCALS</SectionHeader>
            <div className="mt-3 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
              {cityBoards.map((board) => (
                <CityBoardCard
                  key={board.cityName}
                  cityName={board.cityName}
                  savedCount={board.savedCount}
                  photos={board.photos}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── LISTS ── */}
        {lists.length > 0 && (
          <div className="mt-7">
            <SectionHeader>LISTS</SectionHeader>
            <div className="mt-3 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
              {lists.map((list) => (
                <Link
                  key={list.id}
                  href={`/list/${list.id}`}
                  className="flex-shrink-0 w-[160px] bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden snap-start"
                >
                  <div className="w-full h-[100px] bg-cream-dark">
                    {list.coverPhoto ? (
                      <img
                        src={list.coverPhoto}
                        alt={list.title}
                        className="w-full h-full object-cover block"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8 text-ink-light/30">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="px-3 pt-2.5 pb-3">
                    <p className="text-sm font-medium text-ink leading-tight truncate">
                      {list.title}
                    </p>
                    <p className="text-xs text-ink-light mt-0.5 leading-tight">
                      {list.placeCount} places
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── RECENT ── */}
        <div className="mt-7">
          <SectionHeader>RECENT</SectionHeader>
          {recentLogs.length === 0 ? (
            <p className="mt-3 px-4 text-sm text-ink-light">No logs yet</p>
          ) : (
            <div className="mt-3 px-4 grid grid-cols-2 gap-3">
              {recentLogs.map((log) => (
                <Link
                  key={log.id}
                  href={`/place/${log.placeId}`}
                  className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden"
                >
                  <div className="w-full h-[90px] bg-cream-dark">
                    {log.photoUrl ? (
                      <img
                        src={log.photoUrl}
                        alt={log.name}
                        className="w-full h-full object-cover block"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8 text-ink-light/30">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-sm font-medium text-ink leading-tight truncate">
                      {log.name}
                    </p>
                    <p className="text-xs text-ink-light mt-0.5 leading-tight truncate">
                      {log.neighborhood}
                    </p>
                    <div className="mt-1.5">
                      <RatingHearts filled={log.rating} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
