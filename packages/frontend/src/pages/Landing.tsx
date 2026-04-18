import { Link } from "react-router-dom";
import {
  Briefcase,
  Users,
  Shield,
  MapPin,
  Clock,
  Star,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import logoWithText from "@Assets/logo-with-text.png";
import heroBg from "@Assets/hero-bg.png";

export function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img
              src={logoWithText}
              alt="TABANG"
              className="h-12 object-contain"
            />
            <h1 className="text-2xl font-extrabold text-white font-display tracking-tight hidden sm:block">
              TABANG
            </h1>
          </div>
          <div className="flex gap-3">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium text-white hover:text-slate-200"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="btn-primary text-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="relative px-4 py-32 text-center bg-center bg-cover bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})`, backgroundSize: "cover", backgroundPosition: "center center", backgroundAttachment: "fixed" }}
      >
        {/* Dark overlay for text contrast */}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative max-w-7xl mx-auto">
          <h2 className="text-5xl font-extrabold text-white mb-6 font-display tracking-tight">
            Connect with Skilled Local Workers
          </h2>
          <p className="text-xl text-slate-200 mb-8 max-w-2xl mx-auto">
            Project Tabang bridges residents with certified service workers in your barangay.
            Get quality work done. Fair pricing. Local support.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/register" className="btn-primary">
              Register as Resident
            </Link>
            <Link
              to="/register"
              className="px-6 py-3 border-2 border-white text-white font-medium rounded-lg hover:bg-white/10 transition-colors"
            >
              Apply as Worker
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Why Choose Tabang?</h3>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card">
              <MapPin className="text-primary-600 mb-4" size={32} />
              <h4 className="font-semibold mb-2">Smart Matching</h4>
              <p className="text-slate-600 text-sm">
                AI-powered assignment connects you with the best-fit worker based on location, skills, and availability.
              </p>
            </div>
            <div className="card">
              <Clock className="text-accent-600 mb-4" size={32} />
              <h4 className="font-semibold mb-2">Flexible Scheduling</h4>
              <p className="text-slate-600 text-sm">
                Choose your preferred date and time. Workers set their own availability schedules.
              </p>
            </div>
            <div className="card">
              <div className="text-emerald-600 mb-4 text-4xl">₱</div>
              <h4 className="font-semibold mb-2">Transparent Pricing</h4>
              <p className="text-slate-600 text-sm">
                No hidden fees. Price is negotiated on-site. Commission goes back to the barangay.
              </p>
            </div>
            <div className="card">
              <Star className="text-yellow-500 mb-4" size={32} />
              <h4 className="font-semibold mb-2">Verified Workers</h4>
              <p className="text-slate-600 text-sm">
                All workers are verified by barangay admin. Community ratings ensure quality service.
              </p>
            </div>
            <div className="card">
              <Shield className="text-primary-600 mb-4" size={32} />
              <h4 className="font-semibold mb-2">Safe & Secure</h4>
              <p className="text-slate-600 text-sm">
                Payment processed safely. Dispute resolution handled by barangay admin.
              </p>
            </div>
            <div className="card">
              <Users className="text-purple-600 mb-4" size={32} />
              <h4 className="font-semibold mb-2">Community Support</h4>
              <p className="text-slate-600 text-sm">
                Support local workers. Keep money in the barangay. Build community trust.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">How It Works</h3>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary-600">1</span>
              </div>
              <h4 className="font-semibold mb-2">Request Service</h4>
              <p className="text-sm text-slate-600">
                Submit what you need, when, and where. Tell us the problem.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-accent-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-accent-600">2</span>
              </div>
              <h4 className="font-semibold mb-2">Get Matched</h4>
              <p className="text-sm text-slate-600">
                System finds the best worker. They confirm and head to your location.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-emerald-600">3</span>
              </div>
              <h4 className="font-semibold mb-2">Work Done</h4>
              <p className="text-sm text-slate-600">
                Worker completes the job. Negotiate final price on-site if needed.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-yellow-600">4</span>
              </div>
              <h4 className="font-semibold mb-2">Pay & Rate</h4>
              <p className="text-sm text-slate-600">
                Submit proof of payment. Rate the worker. Work is complete!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For Residents */}
      <section className="bg-primary-50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-start gap-8">
            <div className="flex-1">
              <h3 className="text-3xl font-bold mb-4">For Residents</h3>
              <p className="text-slate-700 mb-6">
                Need carpentry, plumbing, electrical work, masonry, or appliance repair? Tabang connects you with local, verified workers quickly and affordably.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <span>Self-register in minutes</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <span>Get matched with verified workers</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <span>Pay safely with proof submission</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <span>Rate and review workers</span>
                </li>
              </ul>
              <Link to="/register" className="btn-primary inline-flex items-center gap-2">
                Sign Up as Resident <ArrowRight size={18} />
              </Link>
            </div>
            <div className="flex-1 bg-white rounded-lg p-8 shadow-sm">
              <div className="space-y-4">
                <div className="border-l-4 border-blue-600 pl-4">
                  <p className="font-semibold text-sm text-slate-900">Quick matching</p>
                  <p className="text-xs text-slate-600">Workers auto-assigned within minutes</p>
                </div>
                <div className="border-l-4 border-blue-600 pl-4">
                  <p className="font-semibold text-sm text-slate-900">Fair pricing</p>
                  <p className="text-xs text-slate-600">Transparent rates with no surprise charges</p>
                </div>
                <div className="border-l-4 border-blue-600 pl-4">
                  <p className="font-semibold text-sm text-slate-900">Safe payment</p>
                  <p className="text-xs text-slate-600">Payment processing with dispute protection</p>
                </div>
                <div className="border-l-4 border-blue-600 pl-4">
                  <p className="font-semibold text-sm text-slate-900">Community trust</p>
                  <p className="text-xs text-slate-600">Support local workers & barangay</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Workers */}
      <section className="bg-emerald-50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-start gap-8 flex-row-reverse">
            <div className="flex-1">
              <h3 className="text-3xl font-bold mb-4">For Workers</h3>
              <p className="text-slate-700 mb-6">
                Skilled in carpentry, plumbing, electrical work, masonry, or appliance repair? Join Tabang and grow your client base with steady work from your barangay.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <span>Registered by barangay admin only</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <span>Consistent job assignments</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <span>Fair, negotiated pricing</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-600" />
                  <span>Build your reputation & ratings</span>
                </li>
              </ul>
              <p className="text-sm text-slate-600 mb-6">
                <strong>Note:</strong> Worker registration requires verification by your barangay admin.
              </p>
              <Link
                to="/register"
                className="px-6 py-3 border-2 border-green-600 text-emerald-600 font-medium rounded-lg hover:bg-emerald-50 transition-colors inline-flex items-center gap-2"
              >
                Apply as Worker <ArrowRight size={18} />
              </Link>
            </div>
            <div className="flex-1 bg-white rounded-lg p-8 shadow-sm">
              <div className="space-y-4">
                <div className="border-l-4 border-green-600 pl-4">
                  <p className="font-semibold text-sm text-slate-900">Smart matching</p>
                  <p className="text-xs text-slate-600">AI assigns jobs based on your skills & location</p>
                </div>
                <div className="border-l-4 border-green-600 pl-4">
                  <p className="font-semibold text-sm text-slate-900">Flexible scheduling</p>
                  <p className="text-xs text-slate-600">Set your own availability and work hours</p>
                </div>
                <div className="border-l-4 border-green-600 pl-4">
                  <p className="font-semibold text-sm text-slate-900">Earn fairly</p>
                  <p className="text-xs text-slate-600">Negotiate price with resident on-site</p>
                </div>
                <div className="border-l-4 border-green-600 pl-4">
                  <p className="font-semibold text-sm text-slate-900">Build profile</p>
                  <p className="text-xs text-slate-600">Ratings & reviews grow your business</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Admin */}
      <section className="bg-purple-50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-start gap-8">
            <div className="flex-1">
              <h3 className="text-3xl font-bold mb-4">For Barangay Admin</h3>
              <p className="text-slate-700 mb-6">
                Tabang empowers barangay administrators to register workers, oversee disputes, manage payments, and grow the local service economy.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-purple-600" />
                  <span>Verify and manage worker credentials</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-purple-600" />
                  <span>Configure service categories & pricing</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-purple-600" />
                  <span>Resolve disputes & payment issues</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-purple-600" />
                  <span>Track income & system activity</span>
                </li>
              </ul>
            </div>
            <div className="flex-1 bg-white rounded-lg p-8 shadow-sm">
              <Briefcase size={32} className="text-purple-600 mb-4" />
              <p className="font-semibold mb-2">Admin Features</p>
              <ul className="text-xs text-slate-600 space-y-2">
                <li>• Worker registration & verification</li>
                <li>• Service category management</li>
                <li>• Dashboard with real-time stats</li>
                <li>• Payment review & confirmation</li>
                <li>• Dispute resolution center</li>
                <li>• User management & suspension</li>
                <li>• System logs & audit trails</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Service Categories */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Available Services</h3>
          <div className="grid md:grid-cols-5 gap-4">
            {["Carpentry", "Plumbing", "Electrical", "Masonry", "Appliance Repair"].map(
              (service) => (
                <div
                  key={service}
                  className="card text-center py-8 hover:border-primary-300 transition-colors"
                >
                  <Briefcase
                    size={32}
                    className="text-primary-600 mx-auto mb-3"
                  />
                  <h4 className="font-semibold text-slate-900">{service}</h4>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary-600 to-accent-600 py-16 text-white">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h3 className="text-3xl font-bold mb-4">Ready to Get Started?</h3>
          <p className="mb-8 text-lg">
            Join your barangay's service community. Request help or offer your skills.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              to="/register"
              className="px-8 py-3 bg-white text-primary-600 font-semibold rounded-lg hover:bg-slate-100 transition-colors"
            >
              Register Now
            </Link>
            <Link
              to="/login"
              className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:bg-opacity-10 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="text-white font-semibold mb-4">Tabang</h4>
              <p className="text-sm">
                Connecting residents with local service workers for a stronger barangay.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">For Residents</h4>
              <ul className="text-sm space-y-2">
                <li>
                  <a href="#" className="hover:text-white">
                    Request Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">For Workers</h4>
              <ul className="text-sm space-y-2">
                <li>
                  <a href="#" className="hover:text-white">
                    Apply as Worker
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Grow Your Business
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Support
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="text-sm space-y-2">
                <li>
                  <a href="#" className="hover:text-white">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center">
            <p className="text-sm">
              © {new Date().getFullYear()} Project Tabang. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
