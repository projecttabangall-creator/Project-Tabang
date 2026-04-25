import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle, MapPin, ShieldCheck, UserRoundCheck } from "lucide-react";
import logoWithText from "@Assets/logo-with-text.png";
import heroBg from "@Assets/hero-bg.png";

export function WorkerApplicationInfo() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="absolute inset-x-0 top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoWithText} alt="TABANG" className="h-12 object-contain" />
            <span className="text-2xl font-extrabold text-white font-display tracking-tight hidden sm:block">
              TABANG
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white hover:text-slate-200"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
        </div>
      </header>

      <section
        className="relative min-h-[76svh] bg-center bg-cover flex items-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="relative max-w-7xl mx-auto px-4 py-28 w-full">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-200 mb-5">
              Worker Application
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white font-display tracking-tight leading-tight mb-6">
              Apply through your nearest Project Tabang barangay.
            </h1>
            <p className="text-lg md:text-xl text-slate-200 max-w-2xl mb-8">
              Workers are registered and verified by barangay administrators. Visit the nearest participating barangay office to submit your details and credentials.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#how-to-apply"
                className="btn-primary inline-flex items-center gap-2"
              >
                See Requirements
                <ArrowRight size={18} />
              </a>
              <Link
                to="/login"
                className="px-6 py-3 border-2 border-white text-white font-medium rounded-lg hover:bg-white/10 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section id="how-to-apply" className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-[0.85fr_1.15fr] gap-12 items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold font-display tracking-tight mb-4">
                How worker registration works
              </h2>
              <p className="text-slate-600 text-lg">
                Project Tabang keeps worker accounts verified by letting barangay admins register workers directly.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              <div className="border-l-4 border-primary-600 pl-5">
                <MapPin className="text-primary-600 mb-4" size={28} />
                <h3 className="font-semibold mb-2">Find your barangay</h3>
                <p className="text-sm text-slate-600">
                  Go to the nearest barangay that uses Project Tabang.
                </p>
              </div>
              <div className="border-l-4 border-primary-600 pl-5">
                <ShieldCheck className="text-primary-600 mb-4" size={28} />
                <h3 className="font-semibold mb-2">Bring credentials</h3>
                <p className="text-sm text-slate-600">
                  Prepare valid ID, contact details, skills, and certificates if available.
                </p>
              </div>
              <div className="border-l-4 border-primary-600 pl-5">
                <UserRoundCheck className="text-primary-600 mb-4" size={28} />
                <h3 className="font-semibold mb-2">Get verified</h3>
                <p className="text-sm text-slate-600">
                  The barangay admin creates and verifies your worker account.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-slate-50">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-bold font-display tracking-tight mb-8">
              What to bring
            </h2>
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-5">
              {[
                "Valid government or barangay ID",
                "Active contact number",
                "Current address or service area",
                "List of services you can provide",
                "Certificates, permits, or proof of skill if available",
                "Preferred work schedule and availability",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle className="text-emerald-600 mt-0.5 shrink-0" size={20} />
                  <span className="text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 bg-primary-600 text-white">
          <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <h2 className="text-3xl font-bold font-display tracking-tight mb-3">
                Ready to work with Tabang?
              </h2>
              <p className="text-primary-50 max-w-2xl">
                Visit the nearest participating barangay office and ask the admin to register you as a Project Tabang worker.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-primary-700 font-semibold rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              Back to Home
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
