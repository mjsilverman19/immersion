"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FollowButton from "@/components/ui/FollowButton";
import AlignmentPlaceCard from "@/components/profile/AlignmentPlaceCard";
import type { MapPin } from "@/components/profile/ProfileMap";

const ProfileMap = dynamic(() => import("@/components/profile/ProfileMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[220px] rounded-xl bg-cream-dark animate-pulse" />
  ),
});

// ── Types ──

interface ProfileData {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  cityName: string | null;
  firstName: string;
}

interface StatsData {
  places: number;
  lists: number;
  followers: number;
  following: number;
}

interface AlignmentPlace {
  placeId: string;
  name: string;
  neighborhood: string | null;
  category: string;
  rating: number;
  review: string | null;
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

interface VisitorProfileClientProps {
  profile: ProfileData;
  stats: StatsData;
  mapPins: MapPin[];
  alignmentScore: number | null;
  sharedTags: string[];
  alignmentPlaces: AlignmentPlace[];
  vibeTags: string[];
  lists: ListData[];
  recentLogs: RecentLog[];
  savedPlaceIds: string[];
  isFollowing: boolean;
}

// ── Sub-components ──

function SectionHeader({ children }: { children: React.ReactNode }) {
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

export default function VisitorProfileClient({
  profile,
  stats,
  mapPins,
  alignmentScore,
  sharedTags,
  alignmentPlaces,
  vibeTags,
  lists,
  recentLogs,
  savedPlaceIds,
  isFollowing,
}: VisitorProfileClientProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* ─── TOP BAR ─── */}
      <div className="sticky top-0 z-20 bg-cream border-b border-cream-dark pt-[env(safe-area-inset-top)] pb-3 px-4 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center -ml-2"
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
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <button className="w-11 h-11 flex items-center justify-center -mr-2">
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
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
                  <span className="text-sm text-ink-light">
                    {profile.cityName}
                  </span>
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
            <Link
              href={`/profile/${profile.username}/followers`}
              className="text-sm"
            >
              <span className="font-medium text-ink">{stats.followers}</span>{" "}
              <span className="text-ink-light">followers</span>
            </Link>
            <Link
              href={`/profile/${profile.username}/following`}
              className="text-sm"
            >
              <span className="font-medium text-ink">{stats.following}</span>{" "}
              <span className="text-ink-light">following</span>
            </Link>
          </div>

          {/* Follow + Match buttons */}
          <div className="flex gap-3 mt-3.5">
            <FollowButton
              userId={profile.id}
              variant="indigo"
              className="flex-1 h-10"
              initialFollowing={isFollowing}
            />
            <Link
              href={`/alignment/${profile.id}`}
              className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-full bg-cream text-indigo text-sm font-medium border border-cream-dark"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="#6B6E8A"
                stroke="none"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {alignmentScore !== null
                ? `${alignmentScore}% match`
                : "New local"}
            </Link>
          </div>
        </div>

        {/* ── NAME'S MAP ── */}
        {mapPins.length > 0 && (
          <div className="mt-8">
            <SectionHeader>
              {profile.firstName.toUpperCase()}&apos;S MAP
            </SectionHeader>
            <div className="mt-3 px-4">
              <ProfileMap
                pins={mapPins}
                interactive
                sourceUserId={profile.id}
                savedPlaceIds={savedPlaceIds}
                height={220}
              />
              <p className="mt-2 text-xs text-ink-light text-center">
                Tap a pin to see details
              </p>
            </div>
          </div>
        )}

        {/* ── YOUR ALIGNMENT ── */}
        {(sharedTags.length > 0 || alignmentPlaces.length > 0) && (
          <div className="mt-8">
            <SectionHeader>YOUR ALIGNMENT</SectionHeader>
            <p className="px-4 mt-3 text-sm text-ink-light leading-relaxed">
              You and {profile.firstName} share a sense for what makes a place
              worth it.
            </p>

            {/* Shared taste pills */}
            {sharedTags.length > 0 && (
              <div className="mt-3 px-4 flex flex-wrap gap-2">
                {sharedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block text-[13px] font-medium text-indigo bg-cream rounded-full px-3.5 py-1.5 leading-tight whitespace-nowrap"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Alignment place cards */}
            {alignmentPlaces.length > 0 && (
              <>
                <p className="px-4 mt-4 text-[13px] text-ink-light">
                  Places you&apos;d both love
                </p>
                <div className="mt-3 px-4 flex flex-col gap-3">
                  {alignmentPlaces.map((place) => (
                    <AlignmentPlaceCard
                      key={place.placeId}
                      placeId={place.placeId}
                      name={place.name}
                      neighborhood={place.neighborhood}
                      category={place.category}
                      rating={place.rating}
                      review={place.review}
                      sourceUserName={profile.firstName}
                      sourceUserId={profile.id}
                      initialSaved={savedPlaceIds.includes(place.placeId)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── TASTE SIGNATURE ── */}
        {vibeTags.length > 0 && (
          <div className="mt-8">
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

        {/* ── RECENT ── */}
        <div className="mt-8">
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
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1}
                          stroke="currentColor"
                          className="w-8 h-8 text-ink-light/30"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                          />
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

        {/* ── LISTS ── */}
        {lists.length > 0 && (
          <div className="mt-8">
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
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1}
                          stroke="currentColor"
                          className="w-8 h-8 text-ink-light/30"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                          />
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
      </div>
    </div>
  );
}
