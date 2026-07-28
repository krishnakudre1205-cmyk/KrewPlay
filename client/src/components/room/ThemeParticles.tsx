import { useEffect, useState } from "react";

interface ThemeParticlesProps {
  type?: 'hearts' | 'fire' | 'snow' | 'stars' | 'cherry' | 'grid' | 'confetti' | 'fog';
}

export default function ThemeParticles({ type }: ThemeParticlesProps) {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [elements, setElements] = useState<number[]>([]);

  useEffect(() => {
    if (!type || prefersReducedMotion) {
      setElements([]);
      return;
    }

    let count = 0;
    if (type === "hearts") count = 15;
    else if (type === "fire") count = 30;
    else if (type === "stars") count = 50;
    else if (type === "cherry") count = 25;
    else if (type === "confetti") count = 40;
    else if (type === "fog") count = 5;
    
    setElements(Array.from({ length: count }, (_, i) => i));
  }, [type, prefersReducedMotion]);

  if (!type || prefersReducedMotion) return null;

  if (type === "grid") {
    return (
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none perspective-[1000px]">
        <div className="absolute bottom-0 left-[-50%] right-[-50%] h-[150%] origin-bottom bg-[linear-gradient(transparent_95%,rgba(0,150,255,0.3)_100%),linear-gradient(90deg,transparent_95%,rgba(0,150,255,0.3)_100%)] bg-[length:40px_40px] transform rotateX(75deg) animate-[gridMove_20s_linear_infinite]" style={{
          animationName: 'gridMove',
          animationDuration: '20s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite'
        }}></div>
        <style>{`
          @keyframes gridMove {
            0% { transform: rotateX(75deg) translateY(0); }
            100% { transform: rotateX(75deg) translateY(40px); }
          }
        `}</style>
      </div>
    );
  }

  if (type === "fog") {
    return (
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40 mix-blend-screen">
        {elements.map((i) => (
          <div
            key={i}
            className="absolute rounded-full bg-green-500/10 blur-[100px]"
            style={{
              width: `${Math.random() * 400 + 200}px`,
              height: `${Math.random() * 400 + 200}px`,
              left: `${Math.random() * 120 - 10}%`,
              top: `${Math.random() * 120 - 10}%`,
              animationName: 'fogDrift',
              animationDuration: `${Math.random() * 20 + 20}s`,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
              animationDirection: 'alternate'
            }}
          />
        ))}
        <style>{`
          @keyframes fogDrift {
            0% { transform: translate(0, 0) scale(1); }
            100% { transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px) scale(1.2); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {elements.map((i) => {
        const left = Math.random() * 100;
        const animationDuration = Math.random() * 5 + 5;
        const animationDelay = Math.random() * -10;
        const size = type === "stars" ? Math.random() * 3 + 1 : Math.random() * 10 + 5;
        
        let bgColor = "bg-white";
        let animationName = "fallDown";
        let opacity = Math.random() * 0.5 + 0.2;
        let borderRadius = "50%";

        if (type === "hearts") {
          bgColor = "bg-pink-500";
          animationName = "floatUp";
          borderRadius = "0"; // Using CSS heart shape instead if needed, or simple square rotated
        } else if (type === "fire") {
          bgColor = "bg-orange-500";
          animationName = "floatUp";
        } else if (type === "cherry") {
          bgColor = "bg-pink-300";
          animationName = "driftDiagonal";
        } else if (type === "confetti") {
          const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-500", "bg-purple-500"];
          bgColor = colors[Math.floor(Math.random() * colors.length)];
          borderRadius = "0";
        }

        return (
          <div
            key={i}
            className={`absolute ${bgColor}`}
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${type === "hearts" ? size : type === "confetti" ? size * 2 : size}px`,
              opacity,
              borderRadius,
              bottom: animationName === "floatUp" ? "-20px" : undefined,
              top: animationName !== "floatUp" ? "-20px" : undefined,
              animationName,
              animationDuration: `${animationDuration}s`,
              animationDelay: `${animationDelay}s`,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              transform: type === "hearts" ? 'rotate(45deg)' : undefined,
              filter: type === "fire" ? 'blur(2px)' : undefined,
            }}
          />
        );
      })}
      
      <style>{`
        @keyframes fallDown {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        @keyframes floatUp {
          0% { transform: translateY(20px) scale(0.5); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(-100vh) scale(1.5); opacity: 0; }
        }
        @keyframes driftDiagonal {
          0% { transform: translate(0, -20px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translate(20vw, 100vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
