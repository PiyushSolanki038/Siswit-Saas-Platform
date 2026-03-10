import { Header } from "@/workspaces/website/components/layout/Header";
import { Footer } from "@/workspaces/website/components/layout/Footer";
import { Button } from "@/ui/shadcn/button";
import { Link } from "react-router-dom";
import { 
  Target, Eye, Heart, ArrowRight, Shield, Sparkles
} from "lucide-react";
import aboutCollaboration from "@/assets/about-collaboration.png";

const values = [
  {
    icon: Target,
    title: "Customer First",
    description: "Every decision we make starts with our customers. Your success is our success.",
  },
  {
    icon: Sparkles,
    title: "Innovation",
    description: "We continuously push boundaries to deliver cutting-edge solutions that drive real value.",
  },
  {
    icon: Shield,
    title: "Trust & Security",
    description: "We protect your data like it's our own, with enterprise-grade security at every layer.",
  },
  {
    icon: Heart,
    title: "Integrity",
    description: "We do the right thing, even when no one is watching. Honesty guides everything we do.",
  },
];

const stats = [
  { value: "2018", label: "Founded" },
  { value: "500+", label: "Enterprise Clients" },
  { value: "300+", label: "Team Members" },
  { value: "15+", label: "Countries" },
];

const milestones = [
  { year: "2018", title: "Company Founded", description: "SISWIT was born with a vision to unify business operations." },
  { year: "2019", title: "CPQ Launch", description: "Launched our first product - the Configure, Price, Quote module." },
  { year: "2020", title: "CLM Addition", description: "Expanded platform with Contract Lifecycle Management." },
  { year: "2021", title: "CRM Integration", description: "Completed the unified platform with CRM capabilities." },
  { year: "2022", title: "Series B Funding", description: "Raised $50M to accelerate global expansion." },
  { year: "2023", title: "AI Features", description: "Introduced AI-powered automation and insights." },
  { year: "2024", title: "Global Expansion", description: "Opened offices in Europe and Asia-Pacific." },
  // Added ERP Milestone
  { year: "2025", title: "ERP & Auto Doc", description: "Launched comprehensive Enterprise Resource Planning and Auto Document tools." },
];

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        {/* Hero */}
        <section className="py-20 gradient-hero relative overflow-hidden">
          <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-center lg:text-left">
                <span className="text-primary font-semibold text-sm uppercase tracking-wider">
                  About Us
                </span>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mt-4 mb-6">
                  Building the Future of{" "}
                  <span className="text-gradient">Business Operations</span>
                </h1>
                <p className="text-lg text-muted-foreground">
                  {/* Updated text to mention ERP */}
                  We're on a mission to help businesses streamline their operations with unified CPQ, CLM, CRM, and ERP solutions, 
                  close deals faster, and build stronger customer relationships.
                </p>
              </div>
              <div className="hidden lg:block">
                <img
                  src={aboutCollaboration}
                  alt="Team collaboration in a modern office with connected workflows and data sharing"
                  className="rounded-2xl shadow-xl border border-border/50"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12">
              <div className="p-8 rounded-2xl bg-card border border-border shadow-card">
                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-6">
                  <Target className="w-7 h-7 text-primary-foreground" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-4">Our Mission</h2>
                <p className="text-muted-foreground text-lg">
                  To empower every organization with intelligent, unified tools that eliminate 
                  complexity and unlock growth. We believe that powerful software should be 
                  accessible, intuitive, and transformative.
                </p>
              </div>

              <div className="p-8 rounded-2xl bg-card border border-border shadow-card">
                <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mb-6">
                  <Eye className="w-7 h-7 text-accent-foreground" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-4">Our Vision</h2>
                <p className="text-muted-foreground text-lg">
                  A world where businesses of all sizes can operate with the efficiency and 
                  intelligence of the world's best companies. We're building the platform 
                  that makes this vision a reality.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-16 bg-secondary/0">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-4xl sm:text-5xl font-bold text-gradient mb-2">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground font-medium">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Our Core Values
              </h2>
              <p className="text-lg text-muted-foreground">
                These principles guide every decision we make and every product we build.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value) => (
                <div
                  key={value.title}
                  className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-card-hover transition-all duration-300 text-center"
                >
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <value.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-24 bg-secondary/0">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Our Journey
              </h2>
              <p className="text-lg text-muted-foreground">
                From a small startup to a global enterprise platform.
              </p>
            </div>

            <div className="max-w-3xl mx-auto">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

                {milestones.map((milestone) => (
                  <div key={milestone.year} className="relative pl-20 pb-12 last:pb-0">
                    {/* Dot */}
                    <div className="absolute left-6 top-1 w-5 h-5 rounded-full bg-primary border-4 border-background" />
                    
                    <div className="p-6 rounded-xl bg-card border border-border">
                      <span className="text-primary font-bold">{milestone.year}</span>
                      <h3 className="text-lg font-semibold text-foreground mt-1">{milestone.title}</h3>
                      <p className="text-muted-foreground text-sm mt-1">{milestone.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 gradient-hero">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
              Join us on our mission
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Whether you're looking to transform your business or join our team, 
              we'd love to hear from you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/contact">
                <Button variant="hero" size="xl" className="group">
                  Get in Touch
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default About;
