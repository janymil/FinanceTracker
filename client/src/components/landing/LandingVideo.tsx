import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";

interface LandingVideoProps {
  name: string; // e.g. "kaptia-front", "1", "2", etc.
  className?: string;
  aspectRatio?: "video" | "square" | "auto";
  title?: string;
  autoPlay?: boolean;
}

export function LandingVideo({
  name,
  className = "",
  aspectRatio = "video",
  title = "Kaptia Feature Demo",
  autoPlay = true,
}: LandingVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Use IntersectionObserver to play only when visible to save CPU/battery
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {});
            setIsPlaying(true);
          } else {
            video.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const aspectClass =
    aspectRatio === "video"
      ? "aspect-video"
      : aspectRatio === "square"
      ? "aspect-square"
      : "";

  return (
    <div
      onClick={togglePlay}
      className={`relative group overflow-hidden rounded-2xl bg-slate-900/40 border border-gray-200/60 dark:border-white/10 shadow-lg cursor-pointer ${className}`}
    >
      <video
        ref={videoRef}
        autoPlay={autoPlay}
        muted={isMuted}
        loop
        playsInline
        preload="metadata"
        poster={`/videos/${name}_poster.webp`}
        onLoadedData={() => setIsLoaded(true)}
        className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02] ${aspectClass}`}
        aria-label={title}
      >
        <source src={`/videos/${name}.webm`} type="video/webm" />
        <source src={`/videos/${name}_web.mp4`} type="video/mp4" />
        <source src={`/videos/${name}.mp4`} type="video/mp4" />
      </video>

      {/* Subtle overlay controls */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Floating sound button */}
      <button
        onClick={toggleSound}
        className="absolute bottom-3 right-3 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-all duration-200 hover:scale-110 focus:outline-none"
        title={isMuted ? "Unmute audio" : "Mute audio"}
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
      </button>

      {/* Center play/pause indicator when paused */}
      {!isPlaying && isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
          <div className="p-3.5 rounded-full bg-white/90 text-gray-900 shadow-xl backdrop-blur">
            <Play className="h-6 w-6 ml-0.5 fill-current" />
          </div>
        </div>
      )}
    </div>
  );
}
export default LandingVideo;

