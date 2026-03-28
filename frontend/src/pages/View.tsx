import React from 'react';

export default function View(): React.JSX.Element {
  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-white">View Certificate</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          This layout mirrors the exported certificate PDF and is optimized for print output.
        </p>
      </div>

      <div className="print-certificate certificate-text rounded-[28px] border border-white/15 bg-white p-10 text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
          <span>StellarCert Institute</span>
          <span>Credential ID STC-2026-00023</span>
        </div>
        <h3 className="mt-10 text-center text-3xl font-bold">Certificate of Excellence</h3>
        <p className="mt-6 text-center text-base text-slate-600">
          This certifies that
        </p>
        <p className="mt-4 text-center text-3xl font-semibold text-slate-900">Jordan Lewis</p>
        <p className="mt-6 text-center text-base text-slate-600">
          has demonstrated outstanding proficiency in
        </p>
        <p className="mt-3 text-center text-xl font-semibold text-slate-800">
          Advanced Digital Credentialing
        </p>
        <div className="mt-12 flex flex-col gap-6 border-t border-slate-200 pt-8 text-sm text-slate-600 sm:flex-row sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Issued</p>
            <p className="mt-2 text-base text-slate-800">January 12, 2026</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Signed by</p>
            <p className="mt-2 text-base text-slate-800">Dr. Amina Rivera</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Verification</p>
            <p className="mt-2 text-base text-slate-800">stellarcert.app/verify</p>
          </div>
        </div>
      </div>

      <div className="no-print rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
        Tip: Use your browser print dialog to export the certificate. The header and footer are hidden in
        print mode.
      </div>
    </section>
  );
}
