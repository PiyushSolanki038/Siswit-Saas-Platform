export const HeroAnimation = () => {
    return (
        <div className="relative w-full aspect-square max-w-[500px] flex items-center justify-center">
            {/* Background Glows */}
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute inset-0 bg-accent/5 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />

            {/* Animated SVG Art */}
            <svg
                viewBox="0 0 400 400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-full relative z-10"
            >
                <defs>
                    <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.8" />
                    </linearGradient>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* Central Core */}
                <circle
                    cx="200"
                    cy="200"
                    r="40"
                    fill="url(#gradient1)"
                    className="animate-pulse"
                >
                    <animate
                        attributeName="r"
                        values="35;45;35"
                        dur="4s"
                        repeatCount="indefinite"
                    />
                </circle>

                {/* Orbiting Elements */}
                <g className="animate-spin-slow origin-center">
                    {/* Ring 1 */}
                    <circle
                        cx="200"
                        cy="200"
                        r="80"
                        stroke="hsl(var(--primary))"
                        strokeWidth="1"
                        strokeDasharray="10 20"
                        className="opacity-30"
                    />
                    <circle cx="120" cy="200" r="8" fill="hsl(var(--primary))" filter="url(#glow)">
                        <animate
                            attributeName="opacity"
                            values="0.3;1;0.3"
                            dur="3s"
                            repeatCount="indefinite"
                        />
                    </circle>
                </g>

                <g className="animate-reverse-spin-slow origin-center">
                    {/* Ring 2 */}
                    <circle
                        cx="200"
                        cy="200"
                        r="120"
                        stroke="hsl(var(--accent))"
                        strokeWidth="1"
                        strokeDasharray="5 15"
                        className="opacity-20"
                    />
                    <rect
                        x="312"
                        y="192"
                        width="16"
                        height="16"
                        rx="4"
                        fill="hsl(var(--accent))"
                        filter="url(#glow)"
                        transform="rotate(45 320 200)"
                    >
                        <animate
                            attributeName="opacity"
                            values="0.2;0.8;0.2"
                            dur="4s"
                            repeatCount="indefinite"
                        />
                    </rect>
                </g>

                {/* Connection Lines */}
                <g className="opacity-20">
                    <line x1="200" y1="200" x2="120" y2="200" stroke="hsl(var(--primary))" strokeWidth="1">
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0 200 200"
                            to="360 200 200"
                            dur="12s"
                            repeatCount="indefinite"
                        />
                    </line>
                    <line x1="200" y1="200" x2="320" y2="200" stroke="hsl(var(--accent))" strokeWidth="1">
                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="360 200 200"
                            to="0 200 200"
                            dur="15s"
                            repeatCount="indefinite"
                        />
                    </line>
                </g>

                {/* Floating Particles */}
                {[...Array(6)].map((_, i) => (
                    <circle
                        key={i}
                        r="2"
                        fill="hsl(var(--primary))"
                        className="opacity-40"
                    >
                        <animate
                            attributeName="cx"
                            values={`${200 + Math.cos(i) * 150};${200 + Math.cos(i + 1) * 150};${200 + Math.cos(i) * 150}`}
                            dur={`${5 + i}s`}
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="cy"
                            values={`${200 + Math.sin(i) * 150};${200 + Math.sin(i + 1) * 150};${200 + Math.sin(i) * 150}`}
                            dur={`${5 + i}s`}
                            repeatCount="indefinite"
                        />
                    </circle>
                ))}
            </svg>

            {/* CSS for custom animations if not in tailwind */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes reverse-spin-slow {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        .animate-reverse-spin-slow {
          animation: reverse-spin-slow 25s linear infinite;
        }
      `}} />
        </div>
    );
};
