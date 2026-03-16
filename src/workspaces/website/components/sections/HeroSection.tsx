import { Link } from "react-router-dom";
import { ArrowRight, Shield, Zap, Cloud, Bot } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import heroBg from "@/assets/hero-bg.jpg";
import { HeroAnimation } from "./HeroAnimation";

const highlights = [
  { icon: Shield, text: "Secure" }, // Shortened text for better fit
  { icon: Zap, text: "Fast" },
  { icon: Cloud, text: "Cloud" },
  { icon: Bot, text: "AI" },
];

export function HeroSection() {
  return (
    // Changed min-h-screen to h-[100dvh] to force exact viewport height
    <section className="relative h-[100dvh] w-full flex items-center justify-center overflow-hidden">

      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroBg}
          alt="Cloud infrastructure background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/70" />
        <div className="absolute inset-0 gradient-hero opacity-70" />
      </div>

      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
      {/* <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "-3s" }} /> */}

      {/* Content Container - Uses h-full to maximize vertical space distribution */}
      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-center">

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center h-full max-h-[900px] mx-auto">

          {/* Left Column - Text */}
          <div className="text-center lg:text-left flex flex-col justify-center space-y-6 sm:space-y-8">

            {/* Wrapper for text content to ensure it stays tight */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-up">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs sm:text-sm font-medium text-primary">
                  Trusted by 500+ enterprises
                </span>
              </div>

              {/* Main Heading - Clamped font sizes */}
              <h1 className="font-bold tracking-tight leading-tight mb-4 animate-fade-up" style={{ animationDelay: "0.1s" }}>
                <span className="text-gradient block text-1xl sm:text-2xl lg:text-4xl xl:text-3xl ">
                  One Unified Platform for
                </span>

                <span className="text-foreground block mt-1 text-3xl sm:text-3xl lg:text-4xl xl:text-5xl">
                  CPQ, ERP, CLM & CRM
                </span>
              </h1>


              {/* Subheading - Controlled width and size */}
              <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-6 sm:mb-8 animate-fade-up" style={{ animationDelay: "0.2s" }}>
                SISWIT empowers your business with intelligent automation, seamless integrations, and enterprise-grade security.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start animate-fade-up" style={{ animationDelay: "0.3s" }}>
                <Link to="/contact">
                  <Button variant="hero" size="lg" className="group w-full sm:w-auto">
                    Request Demo
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/contact">
                  <Button variant="heroOutline" size="lg" className="w-full sm:w-auto">
                    Contact Sales
                  </Button>
                </Link>
              </div>
            </div>

            {/* Highlights - Compact layout */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2 animate-fade-up pt-2" style={{ animationDelay: "0.4s" }}>
              {highlights.map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-1.5 text-muted-foreground"
                >
                  <item.icon className="w-4 h-4 text-primary" />
                  <span className="text-xs sm:text-sm font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Animation Art */}
          <div className="hidden lg:flex items-center justify-center animate-fade-up h-full max-h-[60vh]" style={{ animationDelay: "0.5s" }}>
            <HeroAnimation />
          </div>
        </div>
      </div>


      {/* Scroll indicator - Absolute bottom, small footprint */}
      {/* <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce hidden sm:block">
        <div className="w-5 h-8 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1.5">
          <div className="w-1 h-2 rounded-full bg-primary" />
        </div>
      </div> */}
    </section>
  );
}
