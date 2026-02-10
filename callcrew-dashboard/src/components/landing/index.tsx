"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Menu,
  X,
  Phone,
  ArrowRight,
  MessageSquare,
  Clock,
  UserCheck,
  Calendar,
  PhoneForwarded,
  Mail,
  CheckCircle,
  Wrench,
  Thermometer,
  Stethoscope,
  Scissors,
  Home,
  Scale,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  CalendarDays,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============ NAVBAR ============
export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled ? "bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm" : "bg-white"
      )}
    >
      <nav className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
              <Phone className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-slate-900">CallCrew</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-slate-600 hover:text-blue-600 transition-colors">
              How it works
            </a>
            <a href="#industries" className="text-sm text-slate-600 hover:text-blue-600 transition-colors">
              Industries
            </a>
            <a href="#faq" className="text-sm text-slate-600 hover:text-blue-600 transition-colors">
              FAQ
            </a>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="#join-beta"
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
            >
              Join the beta
            </a>
            <Link
              href="/onboarding"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Start Your Assistant
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 -mr-2 text-slate-600"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-100">
            <div className="flex flex-col gap-3">
              <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="py-2 text-slate-600">
                How it works
              </a>
              <a href="#industries" onClick={() => setIsMobileMenuOpen(false)} className="py-2 text-slate-600">
                Industries
              </a>
              <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="py-2 text-slate-600">
                FAQ
              </a>
              <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
                <a href="#join-beta" className="py-2.5 text-center text-sm font-medium text-slate-700 border border-slate-300 rounded-lg">
                  Join the beta
                </a>
                <Link href="/onboarding" className="py-2.5 text-center text-sm font-medium text-white bg-blue-600 rounded-lg">
                  Start Your Assistant
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

// ============ HERO ============
export function Hero() {
  return (
    <section className="pt-28 pb-20 md:pt-36 md:pb-28 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-6 border border-blue-100">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Your first AI employee
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.1] mb-6">
            Every missed call is missed revenue.
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-8 max-w-2xl">
            CallCrew is your phone receptionist and executive assistant in one — answering calls, capturing leads,
            booking follow-ups, and sending you simple summaries while you stay focused on customers, meetings, or your next session.
          </p>

          {/* Supporting line */}
          <p className="text-sm sm:text-base text-slate-500 mb-6 max-w-2xl">
            Built for small businesses, busy assistants, and solo professionals who run their day by the phone.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Start capturing every call
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#request-demo"
              className="inline-flex items-center justify-center px-6 py-3.5 text-base font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors"
            >
              See how it works
            </a>
          </div>

          {/* Supporting bullets */}
          <ul className="flex flex-col sm:flex-row gap-2 sm:gap-6 mb-6 text-sm text-slate-600">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Answers calls when you are on a job, in a meeting, or off the clock</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Captures caller details, booking needs, and next steps</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Sends a clear summary so you or your assistant can follow up fast</span>
            </li>
          </ul>

          {/* Social proof / trust */}
          <p className="text-xs sm:text-sm text-slate-500">
            Trusted by small service businesses, clinics, and local professionals who are tired of losing work to missed
            calls.
          </p>

          {/* Micro-line */}
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Keep your business number. Forward calls on or off anytime.
          </p>
        </div>
      </div>
    </section>
  );
}

// ============ WHAT IT DOES ============
const features = [
  {
    icon: Phone,
    title: "Capture every call",
    description: "Stay available when customers dial — even when you are on a job, in a meeting, or closed for the day.",
    color: "bg-blue-500",
  },
  {
    icon: UserCheck,
    title: "Turn callers into leads",
    description: "Collects name, number, and what they need so you can quickly call back the right people.",
    color: "bg-emerald-500",
  },
  {
    icon: MessageSquare,
    title: "Know who to call first",
    description: "Asks your screening questions so you know which calls are urgent and which can wait.",
    color: "bg-violet-500",
  },
  {
    icon: Calendar,
    title: "Book more appointments",
    description: "Takes down times and services so you can confirm bookings instead of playing phone tag.",
    color: "bg-amber-500",
  },
  {
    icon: PhoneForwarded,
    title: "Protect urgent calls",
    description: "Can route emergencies or VIP callers directly to your cell so you never miss critical issues.",
    color: "bg-rose-500",
  },
  {
    icon: Mail,
    title: "Get clear call summaries",
    description: "Receive a simple summary by text or email after each call so you always know what happened.",
    color: "bg-cyan-500",
  },
];

export function WhatItDoes() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">What it does</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A trained assistant that handles your calls the way you would.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all"
              >
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center mb-4 shadow-sm", feature.color)}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============ ON/OFF CONTROL ============
const useCases = [
  { icon: Sun, title: "Lunch hours", description: "Step away without missing a lead.", color: "from-amber-400 to-orange-500" },
  { icon: Moon, title: "After hours", description: "Capture calls when you have closed for the day.", color: "from-indigo-500 to-purple-600" },
  { icon: CalendarDays, title: "Weekends", description: "Take time off. Still get the call info Monday.", color: "from-emerald-400 to-teal-500" },
  { icon: RotateCcw, title: "24/7", description: "Let CallCrew handle everything, all the time.", color: "from-blue-500 to-blue-600" },
];

export function OnOffControl() {
  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div className="mb-10 lg:mb-0">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Use it only when you want.
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-6">
              Turn call forwarding on to let CallCrew answer. Turn it off to handle calls yourself. 
              It takes 10 seconds from your phone settings.
            </p>
            <p className="text-slate-500 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              No contracts. No minimum hours. You are in control.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon;
              return (
                <motion.div
                  key={useCase.title}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-2xl p-5 border border-slate-200 hover:shadow-md transition-all"
                >
                  <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 shadow-sm", useCase.color)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">{useCase.title}</h3>
                  <p className="text-sm text-slate-600">{useCase.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ REPLACE LIVE ASSISTANTS ============
const benefits = [
  "Fewer missed leads — every call gets answered",
  "No more voicemail tag with potential customers",
  "Consistent intake questions, every time",
  "Costs less than hiring or live answering services",
  "Instant summaries sent to your phone or inbox",
];

export function ReplaceLiveAssistants() {
  return (
    <section className="py-20 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Stop paying for live virtual assistants.
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            Live answering services cost a lot and still miss calls. Voicemail does not work. 
            CallCrew picks up every call and gets you the info you need to call back.
          </p>

          <ul className="space-y-4">
            {benefits.map((benefit, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-3"
              >
                <CheckCircle className="w-5 h-5 text-emerald-300 mt-0.5 flex-shrink-0" />
                <span className="text-blue-50">{benefit}</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ============ INDUSTRY ASSISTANTS ============
const industries = [
  {
    icon: Wrench,
    title: "Contractors",
    description: "Capture job requests while you are on site so you do not miss new work.",
    color: "bg-orange-500",
  },
  {
    icon: Thermometer,
    title: "HVAC & Plumbing",
    description: "Route emergency calls and collect service requests while your team is in the field.",
    color: "bg-red-500",
  },
  {
    icon: Stethoscope,
    title: "Clinics",
    description: "Take appointment requests after hours so staff can focus on patients in front of them.",
    color: "bg-teal-500",
  },
  {
    icon: Scissors,
    title: "Salons & Spas",
    description: "Book while you are with a client instead of letting calls go to voicemail.",
    color: "bg-pink-500",
  },
  {
    icon: Home,
    title: "Real Estate",
    description: "Capture buyer and seller leads when you are showing a home.",
    color: "bg-blue-500",
  },
  {
    icon: Scale,
    title: "Legal Intake",
    description: "Screen potential clients with qualifying questions, even when you are in court.",
    color: "bg-slate-600",
  },
];

export function IndustryAssistants() {
  return (
    <section id="industries" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Fits the way your business runs.
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            CallCrew adapts to your services, hours, and rules so callers get a professional, consistent experience.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {industries.map((industry, index) => {
            const Icon = industry.icon;
            return (
              <motion.div
                key={industry.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-slate-50 rounded-2xl p-5 border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm", industry.color)}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-1">{industry.title}</h3>
                    <p className="text-sm text-slate-600">{industry.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============ HOW IT WORKS ============
const steps = [
  {
    number: "1",
    title: "Forward your calls",
    description: "Turn on call forwarding from your existing business number to CallCrew. Takes about 2 minutes.",
    color: "bg-blue-600",
  },
  {
    number: "2",
    title: "Assistant answers",
    description: "CallCrew greets callers, answers common questions, and captures what they need.",
    color: "bg-emerald-500",
  },
  {
    number: "3",
    title: "You get the summary and next steps",
    description: "Within seconds, you or your assistant receive a simple summary with details, booking info, and follow-ups.",
    color: "bg-violet-500",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">How it works</h2>
          <p className="text-lg text-slate-600">Three steps. Live in minutes.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="text-center"
            >
              <div className={cn("w-14 h-14 rounded-2xl text-white text-xl font-bold flex items-center justify-center mx-auto mb-4 shadow-lg", step.color)}>
                {step.number}
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-slate-600">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ FAQ ============
const faqs = [
  {
    question: "How is this different from voicemail?",
    answer:
      "Voicemail waits for callers to leave a message. Many never do. CallCrew actually answers the call, has a short conversation, and sends you a clear summary with the caller's details and what they need.",
  },
  {
    question: "Will my customers know it is AI?",
    answer:
      "Most callers simply experience a polite receptionist that listens and asks the right questions. You control the greeting and instructions so it sounds like your business, not a tech company.",
  },
  {
    question: "How quickly can I set it up?",
    answer:
      "Most small businesses are live in under 15 minutes. You choose your greeting, basic questions, and where summaries should be sent. Then you turn on call forwarding from your existing number.",
  },
  {
    question: "Do I keep my existing business number?",
    answer:
      "Yes. You keep your current number. Callers dial you like normal — they just reach CallCrew when call forwarding is turned on.",
  },
  {
    question: "Can I use it 24/7 or only certain hours?",
    answer:
      "You decide when CallCrew picks up. Many businesses use it for lunch, after hours, or weekends. Others forward all calls and let CallCrew handle everything.",
  },
  {
    question: "How fast do I get the summary?",
    answer:
      "Summaries are sent within seconds of the call ending. You choose text message, email, or both so your team can follow up quickly.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Questions</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-100 transition-colors"
              >
                <span className="font-medium text-slate-900 pr-4">{faq.question}</span>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                  openIndex === index ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
                )}>
                  {openIndex === index ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>
              {openIndex === index && (
                <div className="px-5 pb-5">
                  <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============ CALL DEMO CTA ============
export function CallDemoCTA() {
  return (
    <section className="py-16 bg-slate-50 border-y border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Try it yourself</h3>
        <p className="text-slate-600 mb-6">Call our demo assistant and see how it works.</p>
        <a
          href="tel:+18446876128"
          className="inline-flex items-center gap-3 px-6 py-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl transition-all hover:shadow-md"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="text-sm text-slate-500">Call the demo</p>
            <p className="text-xl font-semibold text-slate-900 font-mono">(844) 687-6128</p>
          </div>
        </a>
      </div>
    </section>
  );
}

// ============ FINAL CTA ============
export function FinalCTA() {
  return (
    <section id="request-demo" className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Stop letting good calls slip away.
        </h2>
        <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
          Turn missed calls into booked work, new patients, or signed clients. Try CallCrew and see how much calmer your
          phone can feel.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-medium text-slate-900 bg-white rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
          >
            Get Your AI Receptionist
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#request-demo"
            id="request-demo"
            className="inline-flex items-center justify-center px-6 py-3.5 text-base font-medium text-white border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Request a demo
          </a>
        </div>

        {/* Call Demo Block */}
        <div className="pt-8 border-t border-slate-700">
          <p className="text-slate-400 mb-4">Or try the demo assistant now</p>
          <a
            href="tel:+18446876128"
            className="inline-flex items-center gap-3 px-5 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <Phone className="w-4 h-4 text-white" />
            </div>
            <span className="font-mono text-lg">(844) 687-6128</span>
          </a>
        </div>
      </div>
    </section>
  );
}

// ============ FOOTER ============
export function Footer() {
  return (
    <footer className="py-8 bg-white border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <Phone className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-medium text-slate-900">CallCrew Assistant</span>
          </div>
          <p className="text-sm text-slate-500">
            Your first AI employee.
          </p>
        </div>
      </div>
    </footer>
  );
}
