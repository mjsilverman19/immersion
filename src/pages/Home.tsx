import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import "./landing.css";

const CITIES = ["New York", "Boston", "Paris", "London", "Hong Kong", "Tokyo", "Mexico City"];

const PLACES = [
  {
    eyebrow: "Because you loved Four Horsemen",
    name: "Bar Beau",
    intent: "Drink",
    dot: "var(--intent-drink)",
    meta: "Wine bar · Williamsburg · lively but local",
    logger: "Logged by Maya K.",
    heartsOn: "♥♥♥♥♥",
    heartsOff: "",
  },
  {
    eyebrow: "You lean natural wine",
    name: "Le Dive",
    intent: "Drink",
    dot: "var(--intent-drink)",
    meta: "Natural wine · Dimes Square · spills onto the street",
    logger: "Logged by Dan R.",
    heartsOn: "♥♥♥♥",
    heartsOff: "♥",
  },
  {
    eyebrow: "You heart counter seats",
    name: "Cervo's",
    intent: "Eat",
    dot: "var(--intent-eat)",
    meta: "Seafood · Lower East Side · counter seats late",
    logger: "Logged by Maya K.",
    heartsOn: "♥♥♥♥♥",
    heartsOff: "",
  },
  {
    eyebrow: "New for you this week",
    name: "Westlight",
    intent: "Nightlife",
    dot: "var(--intent-nightlife)",
    meta: "Rooftop · Greenpoint edge · best after ten",
    logger: "Logged by Priya S.",
    heartsOn: "♥♥♥♥",
    heartsOff: "♥",
  },
  {
    eyebrow: "You go out for sound",
    name: "Public Records",
    intent: "Nightlife",
    dot: "var(--intent-nightlife)",
    meta: "Listening bar · Gowanus · sound-first",
    logger: "Logged by Dan R.",
    heartsOn: "♥♥♥♥♥",
    heartsOff: "",
  },
] as const;

const INTENT_CARDS = [
  {
    soft: "var(--intent-eat-soft)",
    dot: "var(--intent-eat)",
    label: "Eat",
    title: "Dinner from someone who lives there.",
    logger: "Logged by Maya K.",
    name: "Cervo's",
    meta: (
      <>
        Seafood · Lower East Side · <span style={{ color: "var(--destructive)", letterSpacing: 2 }}>♥♥♥♥♥</span>
      </>
    ),
  },
  {
    soft: "var(--intent-coffee-soft)",
    dot: "var(--intent-coffee)",
    label: "Coffee",
    title: "The café your match works from.",
    logger: "Logged by Dan R.",
    name: "Sey Coffee",
    meta: (
      <>
        Bushwick · <span style={{ color: "var(--destructive)", letterSpacing: 2 }}>♥♥♥♥</span>
      </>
    ),
  },
  {
    soft: "var(--intent-culture-soft)",
    dot: "var(--intent-culture)",
    label: "Culture",
    title: "What made this place special?",
    logger: "Logged by Priya S.",
    name: "The Frick",
    meta: (
      <>
        Upper East Side · <span style={{ color: "var(--destructive)", letterSpacing: 2 }}>♥♥♥♥♥</span>
      </>
    ),
  },
] as const;

const VALUES = [
  {
    eyebrow: "Trust over volume",
    title: "One person you trust beats a thousand reviews.",
  },
  {
    eyebrow: "Locals know best",
    title: "The people who know their city, recognized for it.",
  },
  {
    eyebrow: "Taste is personal",
    title: "Matched to people, not places.",
  },
] as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function useScrollReveal(enabled: boolean) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;

    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    for (const el of els) {
      const delay = Number.parseInt(el.dataset.reveal ?? "0", 10) || 0;
      el.style.setProperty("--reveal-delay", `${delay}ms`);
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) {
        el.classList.add("is-in");
        continue;
      }
      el.classList.add("landing-reveal");
      io.observe(el);
    }

    return () => io.disconnect();
  }, [enabled]);

  return rootRef;
}

function useCityTypewriter(reducedMotion: boolean) {
  const [typed, setTyped] = useState(CITIES[0]);
  const [caret, setCaret] = useState(true);
  const cityIndexRef = useRef(0);

  useEffect(() => {
    if (reducedMotion) {
      setTyped(CITIES[0]);
      setCaret(false);
      return;
    }

    let typeTimer: ReturnType<typeof setTimeout> | undefined;
    const caretTimer = setInterval(() => setCaret((c) => !c), 500);

    const erase = (current: string) => {
      if (current.length > 0) {
        const next = current.slice(0, -1);
        setTyped(next);
        typeTimer = setTimeout(() => erase(next), 45);
      } else {
        cityIndexRef.current = (cityIndexRef.current + 1) % CITIES.length;
        typeTimer = setTimeout(() => type(CITIES[cityIndexRef.current], ""), 350);
      }
    };

    const type = (target: string, current: string) => {
      if (current.length < target.length) {
        const next = target.slice(0, current.length + 1);
        setTyped(next);
        typeTimer = setTimeout(() => type(target, next), 85);
      } else {
        typeTimer = setTimeout(() => erase(target), 2400);
      }
    };

    typeTimer = setTimeout(() => erase(CITIES[0]), 2400);

    return () => {
      clearInterval(caretTimer);
      if (typeTimer) clearTimeout(typeTimer);
    };
  }, [reducedMotion]);

  return { typed, caret };
}

function LandingButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "invert";
  size?: "md" | "lg";
}) {
  return (
    <button
      type="button"
      className={cn("landing-btn", `landing-btn--${variant}`, `landing-btn--${size}`, className)}
      {...props}
    >
      {children}
    </button>
  );
}

function LandingLinkButton({
  to = "/map",
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  to?: string;
  variant?: "primary" | "secondary" | "ghost" | "invert";
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn("landing-btn", `landing-btn--${variant}`, `landing-btn--${size}`, className)}>
      {children}
    </Link>
  );
}

function HeroCity({ typed, caret }: { typed: string; caret: boolean }) {
  return (
    <span style={{ color: "var(--primary)", whiteSpace: "nowrap" }}>
      {typed}
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 3,
          height: "0.9em",
          marginLeft: 3,
          verticalAlign: "-0.08em",
          borderRadius: 2,
          background: "var(--primary)",
          opacity: caret ? 1 : 0,
          transition: "opacity 120ms",
        }}
      />
    </span>
  );
}

const Home = () => {
  const reducedMotion = usePrefersReducedMotion();
  const rootRef = useScrollReveal(!reducedMotion);
  const { typed, caret } = useCityTypewriter(reducedMotion);
  const carouselRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;
    const play = () => {
      void video.play().catch(() => {});
    };
    if (video.readyState >= 2) play();
    else video.addEventListener("loadeddata", play, { once: true });
  }, [reducedMotion]);

  useEffect(() => {
    const sc = carouselRef.current;
    if (!sc) return;

    const update = () => {
      const mid = sc.scrollLeft + sc.clientWidth / 2;
      for (const slide of Array.from(sc.children) as HTMLElement[]) {
        const center = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.min(Math.abs(center - mid) / (slide.offsetWidth + 24), 1);
        if (reducedMotion) {
          slide.style.transform = "none";
          slide.style.opacity = "1";
        } else {
          slide.style.transform = `scale(${(1 - distance * 0.1).toFixed(3)})`;
          slide.style.opacity = (1 - distance * 0.4).toFixed(3);
        }
      }
    };

    sc.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    window.addEventListener("resize", update);
    requestAnimationFrame(update);
    return () => window.removeEventListener("resize", update);
  }, [reducedMotion]);

  const scrollCarousel = (dir: -1 | 1) => {
    carouselRef.current?.scrollBy({ left: dir * 404, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <div className="landing" ref={rootRef as RefObject<HTMLDivElement>}>
      <nav
        aria-label="Primary"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--paper-75)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid var(--glass-hairline)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "0 24px",
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <Link
            to="/"
            className="type-logo"
            style={{ color: "var(--text)", fontSize: 24, fontWeight: 500, fontVariationSettings: '"opsz" 96' }}
          >
            immersion
          </Link>
          <div className="landing-nav-links" style={{ display: "flex", gap: 32 }}>
            <a href="#map" className="landing-nav-link">
              The map
            </a>
            <a href="#how" className="landing-nav-link">
              How it works
            </a>
            <a href="#taste" className="landing-nav-link">
              Taste
            </a>
            <a href="#places" className="landing-nav-link">
              Places
            </a>
          </div>
          <LandingLinkButton to="/map" variant="ghost" size="md">
            Open map
          </LandingLinkButton>
        </div>
      </nav>

      <header
        style={{
          position: "relative",
          overflow: "hidden",
          textAlign: "center",
          padding: "clamp(72px, 12vw, 128px) 24px clamp(64px, 10vw, 104px)",
        }}
      >
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {!reducedMotion && (
            <video
              ref={videoRef}
              src="https://videos.pexels.com/video-files/5796436/5796436-uhd_2560_1440_30fps.mp4"
              autoPlay
              muted
              playsInline
              loop
              poster=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: reducedMotion
                ? "linear-gradient(180deg, rgba(220,234,246,0.55) 0%, var(--paper) 70%)"
                : "linear-gradient(rgba(250,248,245,0.94) 0%, rgba(250,248,245,0.8) 45%, var(--paper) 97%)",
            }}
          />
        </div>
        <div style={{ position: "relative" }}>
          <h1
            data-reveal="0"
            className="landing-hero-title"
            style={{
              margin: "0 auto",
              maxWidth: "15ch",
              fontFamily: "var(--font-display)",
              fontSize: 88,
              fontWeight: 400,
              fontVariationSettings: '"opsz" 96',
              letterSpacing: "-0.01em",
              lineHeight: 1.04,
              textWrap: "balance",
            }}
          >
            That friend who knows <HeroCity typed={typed} caret={caret} />.
          </h1>
          <p
            data-reveal="140"
            style={{
              margin: "26px auto 40px",
              maxWidth: "44ch",
              fontSize: 18,
              color: "var(--muted)",
              fontVariationSettings: '"opsz" 12',
              textWrap: "pretty",
            }}
          >
            Immersion is a new way to explore a city. Log the places you love, find the people who love them too, and
            borrow their taste anywhere you go.
          </p>
          <div data-reveal="220" style={{ display: "flex", justifyContent: "center" }}>
            <LandingLinkButton to="/map" variant="primary" size="lg">
              Open map
            </LandingLinkButton>
          </div>
        </div>
      </header>

      <section id="how" style={{ padding: "0 24px 104px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ textAlign: "center", margin: "0 0 48px" }}>
            <p
              data-reveal="0"
              style={{
                margin: "0 0 14px",
                fontSize: 12,
                fontWeight: 500,
                fontVariationSettings: '"opsz" 12',
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Our values
            </p>
            <h2
              data-reveal="60"
              className="landing-section-title"
              style={{
                margin: "0 auto",
                maxWidth: "22ch",
                fontFamily: "var(--font-display)",
                fontSize: 46,
                fontWeight: 400,
                fontVariationSettings: '"opsz" 96',
                letterSpacing: "-0.01em",
                lineHeight: 1.06,
                textWrap: "balance",
              }}
            >
              What Immersion believes.
            </h2>
          </div>
          <div className="landing-values-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {VALUES.map((value, index) => (
              <article
                key={value.eyebrow}
                data-reveal={String(index * 80)}
                className="brand-card landing-card-lift landing-values-card"
                style={{
                  borderRadius: 24,
                  padding: 36,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 500,
                    fontVariationSettings: '"opsz" 12',
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--primary)",
                  }}
                >
                  {value.eyebrow}
                </p>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontSize: 25,
                    fontWeight: 500,
                    fontVariationSettings: '"opsz" 40',
                    letterSpacing: "-0.005em",
                    lineHeight: 1.18,
                    textWrap: "pretty",
                  }}
                >
                  {value.title}
                </h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="map" style={{ padding: "0 24px 104px" }}>
        <div
          data-reveal="0"
          style={{
            position: "relative",
            overflow: "hidden",
            maxWidth: 1120,
            margin: "0 auto",
            borderRadius: 28,
            color: "#fff",
            background: "radial-gradient(120% 130% at 100% 100%, #DCEAF6 0%, #2E7CCB 24%, #1D4ED8 62%)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "-12%",
              top: "-30%",
              width: "55%",
              height: "80%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 70%)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: "30%",
              bottom: "-40%",
              width: "45%",
              height: "80%",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255,184,77,0.22) 0%, rgba(255,184,77,0) 70%)",
              pointerEvents: "none",
            }}
          />
          <svg
            viewBox="0 0 1120 620"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.14, pointerEvents: "none" }}
            aria-hidden
          >
            <g stroke="#FFFFFF" strokeWidth="1">
              <line x1="80" y1="0" x2="20" y2="620" />
              <line x1="240" y1="0" x2="180" y2="620" />
              <line x1="400" y1="0" x2="340" y2="620" />
              <line x1="560" y1="0" x2="500" y2="620" />
              <line x1="720" y1="0" x2="660" y2="620" />
              <line x1="880" y1="0" x2="820" y2="620" />
              <line x1="1040" y1="0" x2="980" y2="620" />
              <line x1="0" y1="140" x2="1120" y2="100" />
              <line x1="0" y1="330" x2="1120" y2="290" />
              <line x1="0" y1="520" x2="1120" y2="480" />
            </g>
            <path
              d="M140 470 C 320 380 520 430 700 300 S 1000 180 1060 140"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeDasharray="3 9"
              opacity="0.8"
            />
          </svg>

          <div
            className="landing-blue-band"
            style={{
              position: "relative",
              padding: "64px 56px",
              display: "grid",
              gridTemplateColumns: "1.05fr 0.95fr",
              gap: 56,
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative" }}>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: 12,
                  fontWeight: 500,
                  fontVariationSettings: '"opsz" 12',
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                Taste match
              </p>
              <h2
                className="landing-section-title"
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: 46,
                  fontWeight: 400,
                  fontVariationSettings: '"opsz" 96',
                  letterSpacing: "-0.01em",
                  lineHeight: 1.06,
                  textWrap: "balance",
                }}
              >
                Land with the research already done.
              </h2>
              <p style={{ margin: "20px 0 0", maxWidth: "36ch", fontSize: 17, opacity: 0.92, textWrap: "pretty" }}>
                People who rate the same spots the way you do, surfaced city by city. Follow them, and their cities become
                yours.
              </p>
            </div>

            <div className="landing-map-preview" style={{ position: "relative", height: 500 }}>
            <div
              className="landing-map-frame"
              style={{
                position: "absolute",
                inset: "0 0 0 8%",
                borderRadius: 20,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.4)",
                boxShadow: "0 32px 80px rgba(15,23,42,0.35)",
                transform: "rotate(1.5deg)",
                background: "var(--paper)",
              }}
            >
              <iframe
                src="https://mjsilverman19.github.io/immersion/map"
                title="Immersion map"
                loading="lazy"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "200%",
                  height: "200%",
                  transform: "scale(0.5)",
                  transformOrigin: "0 0",
                  border: "none",
                  pointerEvents: "none",
                  background: "var(--paper)",
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                left: -18,
                top: 42,
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.7)",
                borderRadius: 9999,
                padding: "9px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "var(--text)",
                boxShadow: "0 12px 32px rgba(15,23,42,0.22)",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "var(--intent-drink)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                M
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, fontVariationSettings: '"opsz" 12' }}>Maya K. · 92%</span>
            </div>
            <div
              style={{
                position: "absolute",
                left: -34,
                bottom: 96,
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.7)",
                borderRadius: 9999,
                padding: "9px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "var(--text)",
                boxShadow: "0 12px 32px rgba(15,23,42,0.22)",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "var(--intent-eat)",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                D
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, fontVariationSettings: '"opsz" 12' }}>Dan R. · 88%</span>
            </div>
            <div
              style={{
                position: "absolute",
                left: "8%",
                right: 0,
                bottom: 16,
                margin: "0 16px",
                background: "rgba(255,255,255,0.82)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.6)",
                borderRadius: 14,
                padding: "14px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                color: "var(--text)",
                boxShadow: "0 12px 32px rgba(15,23,42,0.22)",
              }}
            >
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, fontVariationSettings: '"opsz" 12' }}>
                  Bar Beau · Greenpoint
                </div>
                <div style={{ marginTop: 2, fontSize: 12, color: "var(--muted)" }}>Logged by Maya K. · 92% match</div>
              </div>
              <span style={{ color: "var(--destructive)", fontSize: 13, letterSpacing: 2, whiteSpace: "nowrap" }}>
                ♥♥♥♥♥
              </span>
            </div>
          </div>
          </div>
        </div>
      </section>

      <section id="taste" style={{ padding: "0 24px 104px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <h2
            data-reveal="0"
            className="landing-section-title"
            style={{
              margin: "0 auto 20px",
              maxWidth: "20ch",
              textAlign: "center",
              fontFamily: "var(--font-display)",
              fontSize: 46,
              fontWeight: 400,
              fontVariationSettings: '"opsz" 96',
              letterSpacing: "-0.01em",
              lineHeight: 1.06,
              textWrap: "balance",
            }}
          >
            Logged, not reviewed.
          </h2>
          <p
            data-reveal="60"
            style={{
              margin: "0 auto 48px",
              maxWidth: "52ch",
              textAlign: "center",
              fontSize: 17,
              color: "var(--muted)",
              fontVariationSettings: '"opsz" 12',
              textWrap: "pretty",
            }}
          >
            Stop sifting through thousands of anonymous reviews. Start finding places from people you trust.
          </p>
          <div className="landing-intent-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
            {INTENT_CARDS.map((card, index) => (
              <article
                key={card.label}
                data-reveal={String(index * 80)}
                className="landing-card-lift"
                style={{
                  background: card.soft,
                  borderRadius: 24,
                  padding: 36,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  minHeight: 340,
                }}
              >
                <span
                  style={{
                    alignSelf: "flex-start",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12.5,
                    color: "var(--text)",
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: card.dot }} />
                  {card.label}
                </span>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontSize: 26,
                    fontWeight: 500,
                    fontVariationSettings: '"opsz" 40',
                    letterSpacing: "-0.005em",
                    lineHeight: 1.15,
                    textWrap: "pretty",
                  }}
                >
                  {card.title}
                </h3>
                <div style={{ marginTop: "auto", background: "#fff", borderRadius: 16, padding: 20 }}>
                  <div style={{ fontSize: 13, color: "var(--muted)" }}>{card.logger}</div>
                  <div
                    style={{
                      marginTop: 4,
                      fontFamily: "var(--font-display)",
                      fontSize: 21,
                      fontWeight: 500,
                      fontVariationSettings: '"opsz" 96',
                      letterSpacing: "-0.005em",
                    }}
                  >
                    {card.name}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>{card.meta}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="places" style={{ padding: "0 0 112px", overflow: "hidden" }}>
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto 40px",
            padding: "0 24px",
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div data-reveal="0">
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                fontWeight: 500,
                fontVariationSettings: '"opsz" 12',
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--muted)",
              }}
            >
              Your map learns
            </p>
            <h2
              className="landing-section-title"
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 46,
                fontWeight: 400,
                fontVariationSettings: '"opsz" 96',
                letterSpacing: "-0.01em",
                lineHeight: 1.06,
              }}
            >
              A map that gets to know you.
            </h2>
            <p style={{ margin: "14px 0 0", maxWidth: "46ch", fontSize: 16, color: "var(--muted)", textWrap: "pretty" }}>
              Every place you log sharpens what surfaces next — the more you love, the more it feels like yours.
            </p>
          </div>
          <div data-reveal="80" style={{ display: "flex", gap: 10 }}>
            <LandingButton
              variant="secondary"
              size="md"
              aria-label="Previous place"
              onClick={() => scrollCarousel(-1)}
              style={{ width: 44, padding: 0 }}
            >
              <ChevronLeft className="h-4 w-4" />
            </LandingButton>
            <LandingButton
              variant="secondary"
              size="md"
              aria-label="Next place"
              onClick={() => scrollCarousel(1)}
              style={{ width: 44, padding: 0 }}
            >
              <ChevronRight className="h-4 w-4" />
            </LandingButton>
          </div>
        </div>

        <div
          ref={carouselRef}
          data-carousel
          className="landing-carousel"
          style={{
            display: "flex",
            gap: 24,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            padding: "12px calc(50% - 190px) 24px",
            scrollbarWidth: "none",
          }}
        >
          {PLACES.map((place) => (
            <article
              key={place.name}
              className="landing-carousel-card"
              style={{
                scrollSnapAlign: "center",
                flex: "0 0 380px",
                borderRadius: 24,
                border: "1px solid var(--glass-hairline-strong)",
                background: "var(--paper-64)",
                boxShadow: "var(--shadow-glass)",
                backdropFilter: "blur(24px) saturate(1.12)",
                WebkitBackdropFilter: "blur(24px) saturate(1.12)",
                padding: 28,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                willChange: "transform, opacity",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    fontVariationSettings: '"opsz" 12',
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--primary)",
                  }}
                >
                  {place.eyebrow}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 9999,
                    background: "var(--surface)",
                    color: "var(--muted)",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: place.dot }} />
                  {place.intent}
                </span>
              </div>
              <h3
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: 27,
                  fontWeight: 500,
                  fontVariationSettings: '"opsz" 96',
                  letterSpacing: "-0.005em",
                  lineHeight: 1.1,
                }}
              >
                {place.name}
              </h3>
              <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>{place.meta}</p>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: "1px solid var(--border)",
                  paddingTop: 14,
                }}
              >
                <span style={{ fontSize: 13, color: "var(--muted)" }}>{place.logger}</span>
                <span style={{ fontSize: 14, letterSpacing: 2, whiteSpace: "nowrap" }}>
                  <span style={{ color: "var(--destructive)" }}>{place.heartsOn}</span>
                  <span style={{ color: "var(--border)" }}>{place.heartsOff}</span>
                </span>
              </div>
            </article>
          ))}
        </div>
        <p
          style={{
            margin: "16px auto 0",
            maxWidth: 1120,
            padding: "0 24px",
            textAlign: "center",
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          Log a few places you love to start — your map gets sharper with every heart.
        </p>
      </section>

      <footer style={{ borderTop: "1px solid var(--border)", padding: "40px 24px" }}>
        <div
          className="landing-footer-inner"
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 24,
            color: "var(--muted)",
            fontSize: 14,
          }}
        >
          <Link to="/" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, fontVariationSettings: '"opsz" 96', color: "var(--text)" }}>
            immersion
          </Link>
          <span>Where should you go? Ask someone whose taste you trust.</span>
          <Link to="/methodology" className="landing-nav-link" style={{ fontSize: 14 }}>
            Methodology
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Home;
