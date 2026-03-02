import { Calculator, FileText, Users, Database } from "lucide-react";

export const HeroAnimation = () => {
    const nodes = [
        { id: 'cpq', label: 'CPQ', icon: Calculator, color: 'hsl(var(--primary))', x: -120, y: -120, delay: '0s' },
        { id: 'clm', label: 'CLM', icon: FileText, color: 'hsl(var(--accent))', x: 120, y: -120, delay: '0.5s' },
        { id: 'erp', label: 'ERP', icon: Database, color: 'hsl(210, 100%, 50%)', x: -120, y: 120, delay: '1s' },
        { id: 'crm', label: 'CRM', icon: Users, color: 'hsl(280, 100%, 60%)', x: 120, y: 120, delay: '1.5s' },
    ];

    return (
        <div className="relative w-full aspect-square max-w-[600px] flex items-center justify-center perspective-[1200px] overflow-visible">

            {/* 3D Container */}
            <div className="relative w-full h-full flex items-center justify-center transform-style-3d animate-rotate-scene">

                {/* The Base Grid/Floor */}
                <div className="absolute w-[400px] h-[400px] border border-primary/10 rounded-xl bg-primary/5 transform-preserve-3d -rotate-x-[35deg] rotate-z-[45deg] flex items-center justify-center">
                    {/* Grid Scanline Effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
                </div>

                {/* Central Core - The Unified Engine */}
                <div className="absolute z-20 transform-style-3d -translate-y-12">
                    <div className="relative w-24 h-24 transform-preserve-3d -rotate-x-[35deg] rotate-z-[45deg] animate-float-slow">
                        {/* Core Layers */}
                        <div className="absolute inset-0 bg-primary/20 border-2 border-primary/40 rounded-lg blur-xl animate-pulse" />
                        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-accent border-2 border-white/20 rounded-lg shadow-2xl flex items-center justify-center">
                            <span className="text-[10px] font-black text-white tracking-widest -rotate-z-45">CORE</span>
                        </div>
                        {/* Top Glowing Plate */}
                        <div className="absolute inset-0 translate-z-4 bg-white/10 rounded-lg border border-white/40" />
                    </div>
                </div>

                {/* Product Platforms (Satellites) */}
                {nodes.map((node) => (
                    <div
                        key={node.id}
                        className="absolute transform-style-3d"
                        style={{
                            transform: `translateX(${node.x}px) translateY(${node.y}px)`,
                            animation: `float-platform 5s ease-in-out infinite ${node.delay}`
                        }}
                    >
                        <div className="relative w-20 h-20 transform-preserve-3d -rotate-x-[35deg] rotate-z-[45deg]">
                            {/* Platform Base */}
                            <div
                                className="absolute inset-0 rounded-lg border-2 border-opacity-50 shadow-lg flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm"
                                style={{ borderColor: node.color }}
                            >
                                <node.icon size={24} color={node.color} className="-rotate-z-45 mb-1" />
                                <span
                                    className="text-[10px] font-bold -rotate-z-45 uppercase tracking-tighter"
                                    style={{ color: node.color }}
                                >
                                    {node.label}
                                </span>
                            </div>

                            {/* Floating Connection Beam (Targeting Core) */}
                            <svg className="absolute top-1/2 left-1/2 w-[200px] h-[200px] -translate-x-1/2 -translate-y-1/2 rotate-z-[-45deg] pointer-events-none z-[-1] overflow-visible">
                                <line
                                    x1="100" y1="100"
                                    x2={-node.x + 100} y2={-node.y + 100}
                                    stroke={node.color}
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                    className="opacity-30"
                                />
                                <circle r="3" fill={node.color} className="animate-flow-particle">
                                    <animateMotion
                                        path={`M 100 100 L ${-node.x + 100} ${-node.y + 100}`}
                                        dur="2s"
                                        repeatCount="indefinite"
                                    />
                                </circle>
                            </svg>
                        </div>
                    </div>
                ))}

                {/* Floating Particles/Ambience */}
                {[...Array(8)].map((_, i) => (
                    <div
                        key={`particle-${i}`}
                        className="absolute w-1 h-1 bg-primary/40 rounded-full animate-float-particle"
                        style={{
                            left: `${Math.random() * 400 - 200}px`,
                            top: `${Math.random() * 400 - 200}px`,
                            animationDelay: `${Math.random() * 5}s`
                        }}
                    />
                ))}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
        .transform-style-3d { transform-style: preserve-3d; }
        .transform-preserve-3d { transform-style: preserve-3d; transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
        .translate-z-4 { transform: translateZ(10px); }
        
        @keyframes rotate-scene {
          0% { transform: rotateY(-10deg); }
          50% { transform: rotateY(10deg); }
          100% { transform: rotateY(-10deg); }
        }

        @keyframes float-platform {
          0%, 100% { transform: translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) translateZ(0); }
          50% { transform: translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) translateZ(20px); }
        }

        @keyframes float-slow {
          0%, 100% { transform: rotateX(-35deg) rotateZ(45deg) translateY(0); }
          50% { transform: rotateX(-35deg) rotateZ(45deg) translateY(-15px); }
        }

        @keyframes float-particle {
          0%, 100% { transform: translateZ(0) scale(1); opacity: 0.2; }
          50% { transform: translateZ(100px) scale(1.5); opacity: 0.8; }
        }

        .animate-rotate-scene { animation: rotate-scene 15s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
      `}} />
        </div>
    );
};
