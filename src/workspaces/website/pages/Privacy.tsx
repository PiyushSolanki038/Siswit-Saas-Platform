import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-24 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-xl text-muted-foreground mb-6">
            Last Updated: March 20, 2026
          </p>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              At SISWIT, we value your privacy. This policy explains how we collect, use, and protect your information when you use our platform.
            </p>
          </section>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information you provide directly to us, such as when you create an account, submit a contact form, or use our CPQ/CLM tools.
            </p>
          </section>
          {/* Add more sections as needed */}
        </div>
      </main>
      <Footer />
    </div>
  );
}
