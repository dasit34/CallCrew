import React from "react";
import { CheckCircle } from "lucide-react";

const testimonials = [
  {
    name: "Maria, Owner",
    business: "HVAC & Plumbing",
    quote:
      "Before CallCrew we were missing evening calls from new customers. Now every call gets answered and I can follow up the next morning with a clear summary.",
  },
  {
    name: "Dr. Lee, Practice Manager",
    business: "Medical clinic",
    quote:
      "Patients can request appointments after hours instead of leaving voicemails we might miss. Our front desk is less stressed and we still catch new patient inquiries.",
  },
  {
    name: "Jordan, Founder",
    business: "Small law firm",
    quote:
      "We no longer lose potential clients because we were in court or on another call. CallCrew captures intake details so we know which cases to prioritize.",
  },
];

export function Testimonials() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">Small businesses that stopped missing calls</h2>
          <p className="text-slate-600 text-sm sm:text-base">
            CallCrew is used by local service businesses, clinics, and professional offices that rely on the phone for new work.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name + t.business}
              className="bg-slate-50 rounded-2xl border border-slate-100 p-5 flex flex-col justify-between h-full"
            >
              <p className="text-slate-700 text-sm leading-relaxed mb-4">“{t.quote}”</p>
              <div className="text-sm text-slate-600">
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p>{t.business}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>Built on modern, secure cloud infrastructure</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>Designed for reliability — answer every call, day or night</span>
          </div>
        </div>
      </div>
    </section>
  );
}

