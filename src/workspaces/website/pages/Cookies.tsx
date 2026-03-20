import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

export default function Cookies() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-24 max-w-4xl">
        <h1 className="text-4xl font-bold mb-8">Cookie Policy</h1>
        <div className="prose prose-slate dark:prose-invert max-w-none">
          <p className="text-xl text-muted-foreground mb-6">
            Last Updated: March 20, 2026
          </p>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. What are Cookies?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cookies are small text files stored on your device to help platforms provide a better user experience.
            </p>
          </section>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. How we use Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use strictly necessary cookies for authentication and preferences, and analytics cookies to improve our platform.
            </p>
          </section>
          {/* Add more sections as needed */}
        </div>
      </main>
      <Footer />
    </div>
  );
}
