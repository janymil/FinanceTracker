import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  tone: number;
  phase: number;
  twinkle: number;
};

type Theme = "light" | "dark";

/**
 * Futuristic, animated backdrop for the landing hero.
 *
 * Visual stack (back to front):
 *  1. Atmospheric radial washes
 *  2. Slow drifting aurora blobs
 *  3. Orbital rings that draw themselves in around the headline
 *  4. A receding perspective grid floor ("digital horizon")
 *  5. A constellation particle canvas with a one-time reveal + pointer parallax
 *  6. A slow scan sweep and film grain
 *
 * The scene plays a short intro on mount and then stays behind the hero content,
 * drifting gently forever. Motion freezes for users who prefer reduced motion,
 * and the canvas pauses when it scrolls out of view or the tab is hidden.
 */
export function FuturisticHeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReduced = Boolean(reduceMotion);
    const palette = getCanvasPalette(theme);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frameId = 0;
    let inView = true;
    let startedAt = performance.now();

    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const build = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(rect.width, 320);
      height = Math.max(rect.height, 420);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(90, Math.max(32, Math.round((width * height) / 19000)));
      particles = Array.from({ length: count }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.6 + 0.9,
        tone: index % palette.dots.length,
        phase: Math.random() * Math.PI * 2,
        twinkle: 0.6 + Math.random() * 0.9,
      }));
    };

    const draw = (now: number) => {
      frameId = 0;
      ctx.clearRect(0, 0, width, height);

      const revealProgress = prefersReduced
        ? 1
        : Math.min(Math.max((now - startedAt - 200) / 1600, 0), 1);
      // Smoothstep so the constellation eases in instead of popping.
      const reveal = revealProgress * revealProgress * (3 - 2 * revealProgress);

      pointer.x += (pointer.targetX - pointer.x) * 0.05;
      pointer.y += (pointer.targetY - pointer.y) * 0.05;

      if (!prefersReduced) {
        for (const particle of particles) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < -30) particle.x = width + 30;
          if (particle.x > width + 30) particle.x = -30;
          if (particle.y < -30) particle.y = height + 30;
          if (particle.y > height + 30) particle.y = -30;
        }
      }

      const linkDistance = width < 640 ? 92 : 124;
      ctx.lineWidth = 0.6;
      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        const ax = a.x + pointer.x * (a.r / 2.4);
        const ay = a.y + pointer.y * (a.r / 2.4);
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const bx = b.x + pointer.x * (b.r / 2.4);
          const by = b.y + pointer.y * (b.r / 2.4);
          const distance = Math.hypot(ax - bx, ay - by);
          if (distance < linkDistance) {
            ctx.strokeStyle = `${palette.line}${(1 - distance / linkDistance) * 0.22 * reveal})`;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
      }

      const seconds = now / 1000;
      for (const particle of particles) {
        const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(seconds * particle.twinkle + particle.phase));
        const alpha = twinkle * reveal;
        const px = particle.x + pointer.x * (particle.r / 2.4);
        const py = particle.y + pointer.y * (particle.r / 2.4);
        const color = palette.dots[particle.tone];

        if (particle.r > 2.05) {
          ctx.fillStyle = `${color}${alpha * 0.16})`;
          ctx.beginPath();
          ctx.arc(px, py, particle.r * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `${color}${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, particle.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (inView && !document.hidden) {
        frameId = requestAnimationFrame(draw);
      }
    };

    function ensureLoop() {
      if (prefersReduced) return;
      if (!frameId && inView && !document.hidden) {
        frameId = requestAnimationFrame(draw);
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      pointer.targetX = (event.clientX / window.innerWidth - 0.5) * 26;
      pointer.targetY = (event.clientY / window.innerHeight - 0.5) * 22;
    };

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      } else {
        ensureLoop();
      }
    };

    build();
    startedAt = performance.now();

    if (prefersReduced) {
      draw(startedAt);
    } else {
      frameId = requestAnimationFrame(draw);
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
    }

    document.addEventListener("visibilitychange", handleVisibility);

    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          inView = entry.isIntersecting;
          if (inView) {
            ensureLoop();
          } else {
            cancelAnimationFrame(frameId);
            frameId = 0;
          }
        },
        { threshold: 0 }
      );
      observer.observe(host);
    }

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        build();
        if (prefersReduced) draw(performance.now());
        else ensureLoop();
      });
      resizeObserver.observe(host);
    } else {
      window.addEventListener("resize", build);
    }

    return () => {
      cancelAnimationFrame(frameId);
      frameId = 0;
      observer?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", build);
    };
  }, [reduceMotion, theme]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* 1. Atmospheric wash */}
      <motion.div
        className="hero-atmosphere absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />
      <div className="bg-grid absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_70%_58%_at_50%_28%,black,transparent)] dark:opacity-60" />

      {/* 2. Drifting aurora */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.8, delay: 0.15, ease: "easeOut" }}
      >
        <div className="aurora-blob absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 blur-3xl dark:from-blue-500/25 dark:via-indigo-500/20 dark:to-purple-500/25" />
        <div className="aurora-blob absolute -left-44 top-52 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl [animation-delay:-8s] dark:bg-cyan-500/10" />
        <div className="aurora-blob absolute -right-44 top-24 h-[420px] w-[420px] rounded-full bg-purple-400/20 blur-3xl [animation-delay:-14s] dark:bg-purple-500/15" />
      </motion.div>

      {/* 3. Orbital rings behind the headline */}
      <div className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2">
        <div className="hero-halo absolute left-1/2 top-1/2 h-[520px] w-[840px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" />
        <motion.div
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative h-[620px] w-[620px] sm:h-[760px] sm:w-[760px] lg:h-[920px] lg:w-[920px]"
        >
          <div className="hero-orbit absolute inset-0">
            <svg viewBox="0 0 400 400" fill="none" className="h-full w-full">
              <defs>
                <linearGradient id="heroRingArc" x1="40" y1="200" x2="360" y2="200" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                  <stop offset="45%" stopColor="#6366f1" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle cx="200" cy="200" r="197" strokeWidth="1" strokeDasharray="2 11" className="stroke-indigo-500/25 dark:stroke-indigo-300/25" />
              <circle cx="200" cy="200" r="168" strokeWidth="1" className="stroke-indigo-500/15 dark:stroke-indigo-300/20" />
              <circle cx="200" cy="200" r="168" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="96 960" stroke="url(#heroRingArc)" />
              <circle cx="200" cy="200" r="132" strokeWidth="1" strokeDasharray="4 18" className="stroke-purple-500/25 dark:stroke-purple-300/25" />
            </svg>
          </div>
          <div className="hero-orbit-reverse absolute inset-0">
            <svg viewBox="0 0 400 400" fill="none" className="h-full w-full">
              <circle cx="200" cy="200" r="104" strokeWidth="0.9" strokeDasharray="3 13" className="stroke-cyan-500/30 dark:stroke-cyan-300/30" />
              <circle cx="200" cy="96" r="6" className="fill-indigo-400/25 dark:fill-indigo-300/30" />
              <circle cx="200" cy="96" r="2.6" className="fill-indigo-500/80 dark:fill-indigo-300" />
            </svg>
          </div>
        </motion.div>
      </div>

      {/* 4. Receding one-point perspective grid floor */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.2, delay: 0.15, ease: "easeOut" }}
        className="hero-floor absolute inset-x-0 bottom-0 h-[52%]"
      >
        <svg viewBox="0 0 1200 420" preserveAspectRatio="none" fill="none" className="h-full w-full">
          <g className="stroke-indigo-500/40 dark:stroke-indigo-300/30" strokeWidth="1">
            {[0, 6, 14, 25, 40, 60, 87, 122, 166, 220, 285, 360, 420].map((y) => (
              <line key={`h-${y}`} x1="0" y1={y} x2="1200" y2={y} />
            ))}
            {[-1200, -760, -470, -260, -100, 100, 260, 470, 760, 1200].map((offset) => (
              <line key={`v-${offset}`} x1="600" y1="0" x2={600 + offset} y2="420" />
            ))}
          </g>
        </svg>
      </motion.div>
      <div className="hero-horizon-glow absolute bottom-[52%] left-1/2 h-48 w-[min(900px,90vw)] -translate-x-1/2 translate-y-1/2 blur-2xl" />
      <div className="absolute inset-x-0 bottom-[52%] h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />

      {/* 5. Constellation field */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* 6. Scan sweep + film grain */}
      <div className="hero-scan-beam absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-transparent via-indigo-400/[0.07] to-transparent dark:via-indigo-300/[0.09]" />
      <div className="hero-grain absolute inset-0" />

      {/* Blend into the page */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#f7f8fc] dark:to-[#07080f]" />
    </div>
  );
}

function getCanvasPalette(theme: Theme) {
  if (theme === "dark") {
    return {
      dots: ["rgba(165,180,252,", "rgba(196,181,253,", "rgba(125,211,252,"],
      line: "rgba(129,140,248,",
    };
  }

  return {
    dots: ["rgba(99,102,241,", "rgba(139,92,246,", "rgba(14,165,233,"],
    line: "rgba(99,102,241,",
  };
}
