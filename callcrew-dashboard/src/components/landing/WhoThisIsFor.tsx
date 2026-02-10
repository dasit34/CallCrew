import React from "react";

export function WhoThisIsFor() {
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-4">
            Built for businesses that cannot always answer the phone
          </h2>
          <ul className="space-y-2 text-slate-700 text-sm sm:text-base">
            <li>Local service businesses (contractors, HVAC, clinics)</li>
            <li>Small teams without a full-time receptionist</li>
            <li>Solo founders and operators</li>
            <li>Professionals who miss calls during meetings or jobs</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

