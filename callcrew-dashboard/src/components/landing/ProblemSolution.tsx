import React from "react";
import { CheckCircle, XCircle } from "lucide-react";

export function ProblemSolution() {
  return (
    <section className="py-16 md:py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start">
          {/* Before / After cards */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-4">Before CallCrew</h2>
            <div className="space-y-3 text-sm sm:text-base text-slate-700">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-rose-500 mt-1" />
                <p>Phone rings while you are with a customer — goes to voicemail or rings out.</p>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-rose-500 mt-1" />
                <p>Callers hang up instead of leaving a message, and you never know who they were.</p>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-rose-500 mt-1" />
                <p>After-hours calls pile up, and you spend your morning returning missed calls.</p>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-rose-500 mt-1" />
                <p>You know you are leaving money on the table every week.</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-4">After CallCrew</h2>
            <div className="space-y-3 text-sm sm:text-base text-slate-700">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-1" />
                <p>Every call is answered with your greeting, even when you cannot pick up.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-1" />
                <p>You get name, number, and why they called so you can call back real leads, not spam.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-1" />
                <p>Summaries hit your phone or inbox within seconds, so you can follow up between jobs.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-1" />
                <p>Missing one less job a week can cover the cost of CallCrew many times over.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

