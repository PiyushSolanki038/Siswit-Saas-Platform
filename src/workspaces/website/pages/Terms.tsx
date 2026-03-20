import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-24 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-xl text-muted-foreground mb-6">
            Last Updated: March 20, 2026
          </p>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using SISWIT, you agree to be bound by these terms and all applicable laws and regulations.
            </p>
          </section>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Use of License</h2>
            <p className="text-muted-foreground leading-relaxed">
              Permission is granted to temporarily use the platform for the services subscribed to by your organization.
            </p>
          </section>
          {/* Add more sections as needed */}
        </div>
      </main>
      <Footer />
    </div>
  );
}
