import React from "react";

const cards = [
  {
    title: "Small Businesses",
    description: "Pick up new work even when you and your team are tied up.",
    bullets: [
      "Answer calls when no one is free to pick up the phone",
      "Turn missed calls into booked jobs and appointments",
      "Send a quick summary so you know who to call back first",
    ],
  },
  {
    title: "Lunch-Hour & After-Hours Coverage",
    description: "Cover the phones when the office is closed or on break.",
    bullets: [
      "Forward calls over lunch or after you lock the doors",
      "Give callers a real greeting instead of voicemail",
      "Capture simple details so staff can follow up later",
    ],
  },
  {
    title: "Executive Assistant Mode",
    description: "Screen and organize calls for busy owners and leaders.",
    bullets: [
      "Screen calls while you are in meetings or traveling",
      "Capture why they are calling and any follow-up needed",
      "Support scheduling and reminders around your calendar",
    ],
  },
  {
    title: "Coaches & Solo Professionals",
    description: "Handle intake while you stay focused on clients.",
    bullets: [
      "Take discovery calls while you are in sessions",
      "Collect basic intake details so new clients feel taken care of",
      "Send simple notes you can drop straight into your CRM or notes app",
    ],
  },
];

export function RealWorldSchedules() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mb-8">
          <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-3">
            Built for real-world schedules
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            CallCrew fits around how you actually work — busy days, packed calendars, and time away from the phone.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {cards.map((card) => (
            <div key={card.title} className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">{card.title}</h3>
              <p className="text-sm text-slate-600 mb-3">{card.description}</p>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {card.bullets.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

