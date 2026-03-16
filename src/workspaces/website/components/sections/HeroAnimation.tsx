import { Calculator, FileText, Users, Database, Zap } from "lucide-react";

export const HeroAnimation = () => {
    const nodes = [
        { id: 'cpq', label: 'CPQ', icon: Calculator, color: 'hsl(var(--primary))', angle: 0 },
        { id: 'clm', label: 'CLM', icon: FileText, color: 'hsl(200, 100%, 50%)', angle: 90 },
        { id: 'erp', label: 'ERP', icon: Database, color: 'hsl(210, 100%, 50%)', angle: 180 },
        { id: 'crm', label: 'CRM', icon: Users, color: 'hsl(280, 100%, 60%)', angle: 270 },
    ];

    return (
        <div className="relative w-full aspect-square max-w-[600px] flex items-center justify-center overflow-visible">

            {/* Dynamic Background Mesh */}
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary/30" />
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Animated Lines connecting random points (Neural Mesh) */}
                <g className="animate-pulse-slow">
                    {[...Array(15)].map((_, i) => (
                        <line
                            key={i}
                            x1={Math.random() * 400 + 100}
                            y1={Math.random() * 400 + 100}
                            x2={200}
                            y2={200}
                            stroke="currentColor"
                            strokeWidth="0.5"
                            className="text-primary/20"
                        >
                            <animate attributeName="opacity" values="0;0.5;0" dur={`${3 + i}s`} repeatCount="indefinite" />
                        </line>
                    ))}
                </g>
            </svg>

            {/* Central Intelligence Core */}
            <div className="relative z-20 group">
                <div className="relative w-32 h-32 flex items-center justify-center">
                    {/* Spinning Rings */}
                    <div className="absolute inset-0 border-2 border-primary/30 border-dashed rounded-full animate-spin-slow" />
                    <div className="absolute inset-2 border-2 border-accent/20 border-dotted rounded-full animate-reverse-spin-slow" />

                    {/* The Core Orb */}
                    <div className="w-20 h-20 bg-gradient-to-br from-primary via-primary/80 to-accent rounded-full shadow-[0_0_40px_rgba(var(--primary),0.5)] flex items-center justify-center overflow-hidden border border-white/20 backdrop-blur-md">
                        <Zap size={32} className="text-white animate-bounce-slow" />
                        {/* Internal Scanline */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-white/10 animate-scanline pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Product Satellite Cards */}
            {nodes.map((node) => {
                const x = Math.cos((node.angle * Math.PI) / 180) * 160;
                const y = Math.sin((node.angle * Math.PI) / 180) * 160;

                return (
                    <div
                        key={node.id}
                        className="absolute z-30"
                        style={{
                            transform: `translate(${x}px, ${y}px)`,
                            animation: `orbit-${node.id} 40s linear infinite`
                        }}
                    >
                        <div
                            className="relative p-4 rounded-2xl bg-card/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:border-primary/50 transition-all duration-300 group cursor-default"
                            style={{ transform: 'rotate(0deg)' }} // Keep it upright
                        >
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center mb-2 shadow-inner"
                                style={{ backgroundColor: `${node.color}20` }}
                            >
                                <node.icon size={20} color={node.color} className="group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="text-[11px] font-bold text-foreground/80 tracking-widest">{node.label}</div>

                            {/* Glow bar at bottom */}
                            <div
                                className="mt-2 h-0.5 w-0 group-hover:w-full transition-all duration-500 rounded-full"
                                style={{ backgroundColor: node.color }}
                            />
                        </div>

                        {/* Connection Line to Core */}
                        <svg className="absolute top-1/2 left-1/2 w-80 h-80 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[-1] overflow-visible">
                            <path
                                d={`M 160 160 Q ${160 + x / 2} ${160 + y / 2} ${160 + x} ${160 + y}`}
                                fill="none"
                                stroke={node.color}
                                strokeWidth="1"
                                className="opacity-10"
                            />
                            <circle r="4" fill={node.color} className="blur-[2px]">
                                <animateMotion
                                    path={`M 160 160 Q ${160 + x / 2} ${160 + y / 2} ${160 + x} ${160 + y}`}
                                    dur="3s"
                                    repeatCount="indefinite"
                                    begin={`${node.angle / 10}s`}
                                />
                                <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" />
                            </circle>
                        </svg>
                    </div>
                );
            })}

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
        @keyframes scanline {
          0% { top: -10%; }
          100% { top: 110%; }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes fade-in-out {
          0%, 100% { opacity: 0.5; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-5px); }
        }
        
        .animate-spin-slow { animation: spin-slow 30s linear infinite; }
        .animate-reverse-spin-slow { animation: reverse-spin-slow 20s linear infinite; }
        .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
        .animate-scanline { animation: scanline 4s linear infinite; }
        .animate-fade-in-out { animation: fade-in-out 4s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse 6s ease-in-out infinite; }

        /* Smooth Orbital Paths */
        ${nodes.map(node => `
            @keyframes orbit-${node.id} {
                from { transform: rotate(0deg) translate(${Math.cos((node.angle * Math.PI) / 180) * 160}px, ${Math.sin((node.angle * Math.PI) / 180) * 160}px) rotate(0deg); }
                to { transform: rotate(360deg) translate(${Math.cos((node.angle * Math.PI) / 180) * 160}px, ${Math.sin((node.angle * Math.PI) / 180) * 160}px) rotate(-360deg); }
            }
        `).join('\n')}
      `}} />
        </div>
    );
};
