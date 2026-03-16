import { Calculator, FileText, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/ui/shadcn/button";
import { useEffect, useRef, useState } from "react";

const features = [
  {
    icon: Calculator,
    title: "CPQ",
    subtitle: "Configure, Price, Quote",
    description: "Streamline sales with intelligent configuration and dynamic pricing rules.",
    highlights: ["Product Configuration", "Dynamic Pricing", "Quote Automation", "Approvals"],
    color: "from-primary to-primary/60",
  },
  {
    icon: FileText,
    title: "CLM",
    subtitle: "Contract Management",
    description: "Manage lifecycle from creation to renewal with smart templates and compliance.",
    highlights: ["Contract Creation", "E-Signatures", "Compliance Tracking", "Renewals"],
    color: "from-info to-primary/80 dark:from-accent dark:to-accent/60",
  },
  {
    icon: Users,
    title: "ERP",
    subtitle: "Enterprise Resource Planning",
    description: "Integrate and manage all core business processes in one unified system.",
    highlights: ["Inventory Management", "Financial Planning", "Resource Allocation", "Operational Efficiency"],
    color: "from-chart-3 to-chart-3/60",
  },
  {
    icon: Users,
    title: "CRM",
    subtitle: "Customer Relationships",
    description: "Build relationships with unified customer data and actionable analytics.",
    highlights: ["Lead Management", "Pipeline Tracking", "Customer Analytics", "360° View"],
    color: "from-chart-3 to-chart-3/60",
  },
];

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(false);
  const headerRef = useRef(null);
  const cardsRef = useRef(null);

  useEffect(() => {
    const observerOptions = { threshold: 0.1 };
    
    const headerObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsVisible(true);
    }, observerOptions);

    const cardsObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setCardsVisible(true);
    }, observerOptions);

    if (headerRef.current) headerObserver.observe(headerRef.current);
    if (cardsRef.current) cardsObserver.observe(cardsRef.current);

    return () => {
      headerObserver.disconnect();
      cardsObserver.disconnect();
    };
  }, []);

  return (
    // Enforce 100dvh (dynamic viewport height) and disable page scroll overflow
    <section className="relative h-[100dvh] w-full flex flex-col justify-center overflow-hidden bg-background py-4 sm:py-8">
      
      {/* Animated background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col">
        
        {/* Section Header - Compacted margins */}
        <div 
          ref={headerRef}
          className={`shrink-0 text-center max-w-3xl mx-auto mb-4 sm:mb-8 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <span className={`text-primary font-semibold text-xs uppercase tracking-wider inline-block mb-2 transition-all duration-500 ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`} style={{ transitionDelay: '100ms' }}>
            All-in-One Platform
          </span>
          <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`} style={{ transitionDelay: '200ms' }}>
            Three Powerful Modules,{" "}
            <span className="text-gradient">One Platform</span>
          </h2>
          <p className={`hidden sm:block text-sm sm:text-base text-muted-foreground transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`} style={{ transitionDelay: '300ms' }}>
            SISWIT brings together CPQ, CLM, and CRM into a unified platform, creating seamless workflows.
          </p>
        </div>

        {/* Features Container - Adapts to available height */}
        <div className="flex-1 min-h-0 flex items-center justify-center">
          {/* Grid Layout Logic:
             Desktop (md+): Standard 3-column grid.
             Mobile: Horizontal Scroll Snap (flex-row with overflow-x) to prevent vertical page scroll.
          */}
          <div 
            ref={cardsRef} 
            className="w-full h-auto max-h-[550px] flex md:grid md:grid-cols-4 gap-4 sm:gap-6 overflow-x-auto md:overflow-visible snap-x snap-mandatory px-2 pb-4 md:pb-0 scrollbar-hide"
          >
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`flex-none w-[85%] md:w-auto h-full snap-center group relative bg-card rounded-xl p-5 sm:p-6 border border-border shadow-card 
                  flex flex-col
                  transition-all duration-500 hover:shadow-card-hover hover:-translate-y-1 hover:scale-[1.01]
                  ${cardsVisible ? 'opacity-100 translate-y-0 rotate-0' : 'opacity-0 translate-y-16 rotate-1'}`}
                style={{ 
                  transitionDelay: cardsVisible ? `${index * 150}ms` : '0ms',
                }}
              >
                {/* Header Part of Card */}
                <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center 
                      group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-lg transition-all duration-300`}>
                      <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium text-right max-w-[50%] leading-tight group-hover:text-primary/70 transition-colors">
                        {feature.subtitle}
                    </span>
                </div>

                {/* Body Part of Card */}
                <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {feature.description}
                </p>

                {/* Highlights List - Takes available space */}
                <ul className="space-y-1.5 mb-4 flex-1">
                  {feature.highlights.map((highlight, hIndex) => (
                    <li 
                      key={highlight} 
                      className="flex items-center gap-2 text-xs sm:text-sm text-foreground group-hover:translate-x-1 transition-transform duration-300"
                      style={{ transitionDelay: `${hIndex * 50}ms` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary group-hover:scale-150 group-hover:bg-accent transition-all duration-300" />
                      {highlight}
                    </li>
                  ))}
                </ul>

                {/* Footer Part of Card */}
                <div className="mt-auto pt-2 border-t border-border/50">
                    <Link 
                    to="/products" 
                    className="inline-flex items-center gap-2 text-primary font-semibold text-xs sm:text-sm group-hover:gap-3 transition-all"
                    >
                    Learn more 
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 group-hover:translate-x-1 group-hover:scale-110 transition-all" />
                    </Link>
                </div>

                {/* Hover Effects */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-accent/5 
                  opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="absolute inset-0 rounded-xl border-2 border-primary/0 group-hover:border-primary/20 
                  transition-all duration-500 pointer-events-none" />
              </div>
            ))}
          </div>
        </div>

        {/* CTA - Compact Margin */}
        <div className={`shrink-0 text-center mt-4 sm:mt-8 transition-all duration-700 ${
          cardsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`} style={{ transitionDelay: '600ms' }}>
          <Link to="/products">
            <Button variant="hero" size="lg" className="h-10 px-6 text-sm sm:h-11 sm:px-8 sm:text-base group hover:scale-105 transition-transform duration-300">
              Explore All Features
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
