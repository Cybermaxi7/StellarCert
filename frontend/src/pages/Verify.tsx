import React from 'react';

export default function Verify(): React.JSX.Element {
  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">Verify a Certificate</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Enter a certificate ID or scan a verification code to confirm authenticity.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <form className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Certificate ID
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-primary"
                placeholder="STC-2026-00023"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Issuer Email
              </label>
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none focus:border-primary"
                placeholder="issuer@stellarcert.io"
                type="email"
              />
            </div>
            <button
              type="button"
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
            >
              Verify Certificate
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/10 to-white/5 p-6">
          <h3 className="text-lg font-semibold text-white">Verification results</h3>
          <p className="mt-2 text-sm text-slate-300">
            Verification responses will include issuer details, certificate status, and metadata integrity.
          </p>
          <div className="mt-6 space-y-3 text-sm text-slate-200">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
              <span>Status</span>
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">
                Authentic
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
              <span>Issued</span>
              <span>Jan 12, 2026</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3">
              <span>Recipient</span>
              <span>Jordan Lewis</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
