import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Header } from "@/workspaces/employee/layout/Header";
import { Footer } from "@/workspaces/employee/layout/Footer";
import { Button } from "@/ui/shadcn/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // 404 tracking
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <section className="min-h-[80vh] flex items-center justify-center gradient-hero relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />

          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="text-9xl font-bold text-gradient mb-4">404</div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Page Not Found
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
              The page you're looking for doesn't exist or has been moved.
              Let's get you back on track.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/">
                <Button variant="hero" size="lg" className="group">
                  <Home className="w-5 h-5" />
                  Back to Home
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="w-5 h-5" />
                Go Back
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
