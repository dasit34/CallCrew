import React from "react";
import { CheckCircle } from "lucide-react";

export function PricingTeaser() {
  return (
    <section className="py-16 md:py-20 bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Costs less than one missed job a month</h2>
          <p className="text-slate-300 text-sm sm:text-base mb-6">
            CallCrew is priced so that capturing just one extra customer or patient each month can pay for the service.
            It is often less than what you would pay a receptionist for a single hour of work.
          </p>

          <div className="grid sm:grid-cols-2 gap-5 mb-6 text-sm">
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
              <p className="font-semibold mb-2 text-white">What missing calls can cost</p>
              <ul className="space-y-1 text-slate-300">
                <li>• A $300 service call that never booked</li>
                <li>• A new patient who chose another clinic</li>
                <li>• A legal intake that went to voicemail</li>
              </ul>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4">
              <p className="font-semibold mb-2 text-white">What CallCrew gives you</p>
              <ul className="space-y-1 text-slate-300">
                <li>• Every call answered, even after hours</li>
                <li>• Clear summaries so you can follow up fast</li>
                <li>• No hiring, training, or managing staff</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Simple monthly pricing — no hardware, no long contracts.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Try it risk-free and turn it off anytime if it is not a fit.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

