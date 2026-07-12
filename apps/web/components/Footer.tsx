import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 py-14">
        <div className="grid md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <img src="/logo.svg" alt="JobMan" className="w-8 h-8" />
              <span className="font-extrabold text-xl text-white">Job<span className="text-primary-400">Man</span></span>
            </div>
            <p className="text-sm leading-relaxed">
              The US marketplace connecting gig workers, professionals, and employers across all 50 states.
            </p>
            <p className="text-xs mt-4">🇺🇸 Proudly built for America</p>
          </div>

          {/* Workers */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">For Workers</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/gigs" className="hover:text-white transition-colors">Browse Gig Work</Link></li>
              <li><Link href="/jobs" className="hover:text-white transition-colors">Browse Jobs</Link></li>
              <li><Link href="/sign-up" className="hover:text-white transition-colors">Create Profile</Link></li>
              <li><Link href="/messages" className="hover:text-white transition-colors">Messages</Link></li>
            </ul>
          </div>

          {/* Employers */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">For Employers</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/gigs" className="hover:text-white transition-colors">Find Gig Workers</Link></li>
              <li><Link href="/professionals" className="hover:text-white transition-colors">Find Professionals</Link></li>
              <li><Link href="/jobs/post" className="hover:text-white transition-colors">Post a Job</Link></li>
              <li><Link href="/sign-up" className="hover:text-white transition-colors">Sign Up Free</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Account</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link></li>
              <li><Link href="/sign-up" className="hover:text-white transition-colors">Sign Up</Link></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p>© 2026 JobMan. All rights reserved.</p>
          <p className="text-slate-500">The US job & gig marketplace · Free to get started</p>
        </div>
      </div>
    </footer>
  );
}
