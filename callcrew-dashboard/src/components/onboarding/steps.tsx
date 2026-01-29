"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Phone,
  Mail,
  Users,
  Moon,
  PhoneForwarded,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Briefcase,
  Dumbbell,
  Scissors,
  TrendingUp,
  Sparkles,
  Save,
  Play,
  Volume2,
  HelpCircle,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api-base";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface FAQ {
  question: string;
  answer: string;
}

interface OnboardingData {
  // Step 1: Business Setup
  businessName: string;
  businessPhone: string;
  notificationEmail: string;
  timezone: string;
  businessDescription: string;
  services: string;
  
  // Step 2: Template
  template: string;
  
  // Step 3: Customize
  voiceModel: string;
  greeting: string;
  faqs: FAQ[];
  
  // Step 4: Notifications
  emailNotifications: boolean;
  smsNotifications: boolean;
  smsNumber: string;
  callForwarding: boolean;
  forwardingNumber: string;
}

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

const TEMPLATES = [
  { id: "general", name: "General Business", description: "Offices, clinics, contractors, professional services", icon: Building2, badge: "Popular" },
  { id: "after-hours", name: "After-Hours", description: "Capture leads outside business hours", icon: Moon, badge: null },
  { id: "coach", name: "Coach / Trainer", description: "Book sessions and screen clients", icon: Users, badge: null },
  { id: "gym", name: "Gym / Studio", description: "Memberships, classes, trial signups", icon: Dumbbell, badge: null },
  { id: "salon", name: "Salon / Beauty", description: "Appointments for salons and spas", icon: Scissors, badge: null },
  { id: "sales", name: "Sales & Leads", description: "Qualify leads, schedule demos", icon: TrendingUp, badge: null },
  { id: "executive-assistant", name: "Executive Assistant", description: "Screen calls for busy professionals", icon: Briefcase, badge: null },
];

// Template-specific FAQs
const TEMPLATE_FAQS: Record<string, FAQ[]> = {
  general: [
    { question: "What are your business hours?", answer: "" },
    { question: "Where are you located?", answer: "" },
    { question: "Do you offer free estimates?", answer: "" },
    { question: "How do I schedule an appointment?", answer: "" },
    { question: "What forms of payment do you accept?", answer: "" },
  ],
  "after-hours": [
    { question: "When will someone call me back?", answer: "We'll return your call first thing in the morning during business hours." },
    { question: "Is this an emergency line?", answer: "" },
    { question: "Can I leave a detailed message?", answer: "Absolutely! I'll make sure to capture all the details for you." },
    { question: "What are your regular business hours?", answer: "" },
    { question: "How soon can I expect a response?", answer: "You'll hear back from us within the next business day." },
  ],
  coach: [
    { question: "What types of coaching do you offer?", answer: "" },
    { question: "How long is a typical session?", answer: "" },
    { question: "Do you offer a free consultation?", answer: "" },
    { question: "What are your rates?", answer: "" },
    { question: "Do you work with beginners?", answer: "" },
  ],
  gym: [
    { question: "What are your membership options?", answer: "" },
    { question: "Do you offer a free trial?", answer: "" },
    { question: "What classes do you have?", answer: "" },
    { question: "What are your hours?", answer: "" },
    { question: "Is there a sign-up fee?", answer: "" },
  ],
  salon: [
    { question: "How do I book an appointment?", answer: "I can help you schedule right now! What service are you looking for?" },
    { question: "What services do you offer?", answer: "" },
    { question: "What are your prices?", answer: "" },
    { question: "Do you take walk-ins?", answer: "" },
    { question: "What's your cancellation policy?", answer: "" },
  ],
  sales: [
    { question: "What does your product/service cost?", answer: "" },
    { question: "Can I schedule a demo?", answer: "Absolutely! I can help set that up for you." },
    { question: "What makes you different from competitors?", answer: "" },
    { question: "Do you offer a free trial?", answer: "" },
    { question: "How do I get started?", answer: "" },
  ],
  "executive-assistant": [
    { question: "Is [Name] available?", answer: "Let me check their availability. May I ask what this is regarding?" },
    { question: "When is the best time to reach them?", answer: "" },
    { question: "Can I leave a message?", answer: "Of course! I'll make sure they receive it." },
    { question: "Is this urgent?", answer: "" },
    { question: "How can I schedule a meeting?", answer: "" },
  ],
};

const VOICES = [
  { id: "alloy", name: "Alloy", description: "Balanced, professional", color: "bg-slate-100" },
  { id: "echo", name: "Echo", description: "Clear, articulate", color: "bg-blue-100" },
  { id: "fable", name: "Fable", description: "Warm, friendly", color: "bg-amber-100" },
  { id: "onyx", name: "Onyx", description: "Deep, authoritative", color: "bg-slate-800" },
  { id: "nova", name: "Nova", description: "Energetic, upbeat", color: "bg-violet-100" },
  { id: "shimmer", name: "Shimmer", description: "Smooth, calming", color: "bg-emerald-100" },
];

const STEPS = [
  { id: 1, title: "Business Setup", description: "Your details" },
  { id: 2, title: "Assistant Type", description: "Choose template" },
  { id: 3, title: "Customize", description: "Voice & FAQs" },
  { id: 4, title: "Notifications", description: "How to reach you" },
  { id: 5, title: "Launch", description: "Review & go live" },
];

const INITIAL_DATA: OnboardingData = {
  businessName: "",
  businessPhone: "",
  notificationEmail: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  businessDescription: "",
  services: "",
  template: "",
  voiceModel: "nova",
  greeting: "",
  faqs: [],
  emailNotifications: true,
  smsNotifications: false,
  smsNumber: "",
  callForwarding: false,
  forwardingNumber: "",
};

// ═══════════════════════════════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════════════════════════════

function ProgressBar({ currentStep }: { currentStep: number }) {
  const progress = ((currentStep - 1) / 4) * 100;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-900">Step {currentStep} of 5</span>
        <span className="text-sm text-slate-500">{STEPS[currentStep - 1].title}</span>
      </div>
      
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="flex justify-between">
        {STEPS.map((step) => (
          <div key={step.id} className="flex flex-col items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                step.id < currentStep
                  ? "bg-blue-600 text-white"
                  : step.id === currentStep
                  ? "bg-blue-600 text-white ring-4 ring-blue-100"
                  : "bg-slate-100 text-slate-400"
              )}
            >
              {step.id < currentStep ? <Check className="w-4 h-4" /> : step.id}
            </div>
            <span
              className={cn(
                "text-xs mt-1.5 hidden sm:block",
                step.id <= currentStep ? "text-slate-700 font-medium" : "text-slate-400"
              )}
            >
              {step.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FORM COMPONENTS
// ═══════════════════════════════════════════════════════════════

function FormField({ label, error, children, required, helper }: {
  label: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
  helper?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {helper && !error && <p className="text-xs text-slate-500">{helper}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
        "transition-colors placeholder:text-slate-400",
        className
      )}
      {...props}
    />
  );
}

function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-white",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
        "transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg resize-none",
        "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
        "transition-colors placeholder:text-slate-400",
        className
      )}
      {...props}
    />
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors",
        checked ? "bg-blue-600" : "bg-slate-200",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <motion.div
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
        animate={{ left: checked ? 24 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 1: BUSINESS SETUP
// ═══════════════════════════════════════════════════════════════

function Step1BusinessSetup({ data, onChange, errors }: {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  errors: Record<string, string>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Tell us about your business</h2>
        <p className="text-slate-600 mt-1">This helps us set up your AI assistant.</p>
      </div>

      <div className="grid gap-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label="Business Name" required error={errors.businessName}>
            <Input
              placeholder="Acme Services LLC"
              value={data.businessName}
              onChange={(e) => onChange({ businessName: e.target.value })}
            />
          </FormField>

          <FormField label="Your Phone Number" required error={errors.businessPhone} helper="Where callers dial">
            <Input
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={data.businessPhone}
              onChange={(e) => onChange({ businessPhone: e.target.value })}
            />
          </FormField>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label="Email" required error={errors.notificationEmail} helper="For call summaries">
            <Input
              type="email"
              placeholder="you@business.com"
              value={data.notificationEmail}
              onChange={(e) => onChange({ notificationEmail: e.target.value })}
            />
          </FormField>

          <FormField label="Time Zone" required>
            <Select value={data.timezone} onChange={(e) => onChange({ timezone: e.target.value })}>
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="What does your business do?" required error={errors.businessDescription} helper="One sentence is enough">
          <Input
            placeholder="We're a family-owned plumbing company serving the Seattle area"
            value={data.businessDescription}
            onChange={(e) => onChange({ businessDescription: e.target.value })}
          />
        </FormField>

        <FormField label="Services you offer" helper="Comma-separated (e.g. Repairs, Installations, Inspections)">
          <Input
            placeholder="Repairs, Installations, Maintenance, Emergency Service"
            value={data.services}
            onChange={(e) => onChange({ services: e.target.value })}
          />
        </FormField>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 2: CHOOSE TEMPLATE
// ═══════════════════════════════════════════════════════════════

function Step2Template({ data, onChange, errors }: {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
  errors: Record<string, string>;
}) {
  const handleTemplateSelect = (templateId: string) => {
    // Load template-specific FAQs when selecting a template
    const templateFaqs = TEMPLATE_FAQS[templateId] || TEMPLATE_FAQS.general;
    onChange({ 
      template: templateId,
      faqs: templateFaqs.map(faq => ({ ...faq })) // Deep copy
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Choose your assistant type</h2>
        <p className="text-slate-600 mt-1">Pick the template that best fits your business.</p>
      </div>

      {errors.template && <p className="text-sm text-red-500 -mt-2 mb-4">{errors.template}</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        {TEMPLATES.map((template) => {
          const Icon = template.icon;
          const isSelected = data.template === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleTemplateSelect(template.id)}
              className={cn(
                "relative p-5 text-left rounded-xl border-2 transition-all",
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
              )}
            >
              {template.badge && !isSelected && (
                <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                  {template.badge}
                </span>
              )}
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={cn(
                "w-11 h-11 rounded-lg flex items-center justify-center mb-3",
                isSelected ? "bg-blue-500" : "bg-slate-100"
              )}>
                <Icon className={cn("w-5 h-5", isSelected ? "text-white" : "text-slate-600")} />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{template.name}</h3>
              <p className="text-sm text-slate-600">{template.description}</p>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 3: CUSTOMIZE (Voice + Greeting + FAQs)
// ═══════════════════════════════════════════════════════════════

function Step3Customize({ data, onChange }: {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [editingFaq, setEditingFaq] = useState<number | null>(null);

  const defaultGreeting = `Thank you for calling ${data.businessName || "[Your Business]"}! How can I help you today?`;

  const updateFaq = (index: number, updates: Partial<FAQ>) => {
    const newFaqs = [...data.faqs];
    newFaqs[index] = { ...newFaqs[index], ...updates };
    onChange({ faqs: newFaqs });
  };

  const handlePlayVoice = (voiceId: string) => {
    // Placeholder for voice preview functionality
    setPlayingVoice(voiceId);
    setTimeout(() => setPlayingVoice(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Customize your assistant</h2>
        <p className="text-slate-600 mt-1">Choose a voice and set up common Q&A.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left Panel: Voice Selection */}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-blue-600" />
            Voice Selection
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {VOICES.map((voice) => (
              <button
                key={voice.id}
                type="button"
                onClick={() => onChange({ voiceModel: voice.id })}
                className={cn(
                  "relative p-4 rounded-xl border-2 text-left transition-all group",
                  data.voiceModel === voice.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    voice.id === "onyx" ? "bg-slate-800" : voice.color
                  )}>
                    <Volume2 className={cn(
                      "w-4 h-4",
                      voice.id === "onyx" ? "text-white" : "text-slate-600"
                    )} />
                  </div>
                  {data.voiceModel === voice.id && (
                    <Check className="w-5 h-5 text-blue-500" />
                  )}
                </div>
                <span className="font-semibold text-slate-900 block">{voice.name}</span>
                <p className="text-xs text-slate-500 mt-0.5">{voice.description}</p>
                
                {/* Play button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayVoice(voice.id);
                  }}
                  className={cn(
                    "absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all",
                    "bg-white border border-slate-200 shadow-sm",
                    "opacity-0 group-hover:opacity-100",
                    playingVoice === voice.id && "opacity-100 bg-blue-500 border-blue-500"
                  )}
                >
                  <Play className={cn(
                    "w-3 h-3",
                    playingVoice === voice.id ? "text-white" : "text-slate-600"
                  )} />
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel: Greeting */}
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              Greeting Message
            </h3>
            <Textarea
              rows={3}
              placeholder={defaultGreeting}
              value={data.greeting}
              onChange={(e) => onChange({ greeting: e.target.value })}
              maxLength={200}
            />
            <div className="flex justify-between mt-1.5">
              <p className="text-xs text-slate-500">What callers hear first</p>
              <span className="text-xs text-slate-400">{(data.greeting || "").length}/200</span>
            </div>
          </div>

          {/* Preview box */}
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">Preview</p>
            <p className="text-sm text-slate-700 italic leading-relaxed">
              &ldquo;{data.greeting || defaultGreeting}&rdquo;
            </p>
            <p className="text-xs text-slate-500 mt-3">
              Voice: <span className="font-medium text-slate-700">{VOICES.find(v => v.id === data.voiceModel)?.name}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Bottom: FAQs */}
      <div className="pt-6 border-t border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          Top 5 FAQs
          <span className="text-xs font-normal text-slate-500 ml-1">Your assistant will answer these common questions</span>
        </h3>

        <div className="space-y-3">
          {data.faqs.map((faq, index) => (
            <div key={index} className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-medium text-slate-900">{faq.question}</p>
                <button
                  type="button"
                  onClick={() => setEditingFaq(editingFaq === index ? null : index)}
                  className="text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              
              <AnimatePresence>
                {editingFaq === index ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Textarea
                      rows={2}
                      placeholder="Type your answer here..."
                      value={faq.answer}
                      onChange={(e) => updateFaq(index, { answer: e.target.value })}
                      className="mt-2"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setEditingFaq(null)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Done
                    </button>
                  </motion.div>
                ) : (
                  <p className={cn(
                    "text-sm",
                    faq.answer ? "text-slate-600" : "text-slate-400 italic"
                  )}>
                    {faq.answer || "Click edit to add your answer..."}
                  </p>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Leave answers blank and your assistant will naturally ask callers to leave a message for unanswered questions.
        </p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 4: NOTIFICATIONS & ROUTING
// ═══════════════════════════════════════════════════════════════

function Step4Notifications({ data, onChange }: {
  data: OnboardingData;
  onChange: (updates: Partial<OnboardingData>) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">How should we reach you?</h2>
        <p className="text-slate-600 mt-1">Set up notifications and call routing.</p>
      </div>

      <div className="space-y-4">
        {/* Email Notifications - Default ON */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Email after each call</h3>
                <p className="text-sm text-slate-600 mt-0.5">Get a summary with caller info sent to your inbox</p>
              </div>
            </div>
            <Toggle checked={data.emailNotifications} onChange={(checked) => onChange({ emailNotifications: checked })} />
          </div>
          {data.emailNotifications && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-600">
                Summaries will be sent to: <span className="font-medium text-slate-900">{data.notificationEmail || "your email"}</span>
              </p>
            </div>
          )}
        </div>

        {/* SMS Notifications - Optional */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">SMS summaries</h3>
                <p className="text-sm text-slate-600 mt-0.5">Get a quick text after each call</p>
              </div>
            </div>
            <Toggle checked={data.smsNotifications} onChange={(checked) => onChange({ smsNotifications: checked })} />
          </div>
          <AnimatePresence>
            {data.smsNotifications && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <FormField label="SMS Number">
                    <Input
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={data.smsNumber}
                      onChange={(e) => onChange({ smsNumber: e.target.value })}
                    />
                  </FormField>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Call Forwarding - Optional */}
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                <PhoneForwarded className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Forward urgent calls to my phone</h3>
                <p className="text-sm text-slate-600 mt-0.5">Transfer callers who need immediate help</p>
              </div>
            </div>
            <Toggle checked={data.callForwarding} onChange={(checked) => onChange({ callForwarding: checked })} />
          </div>
          <AnimatePresence>
            {data.callForwarding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <FormField label="Forward to">
                    <Input
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={data.forwardingNumber}
                      onChange={(e) => onChange({ forwardingNumber: e.target.value })}
                    />
                  </FormField>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Info box */}
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Your assistant answers 24/7.</span> You can toggle it on/off anytime from your dashboard using call forwarding.
        </p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 5: REVIEW & LAUNCH
// ═══════════════════════════════════════════════════════════════

function Step5Review({ data, onEdit }: {
  data: OnboardingData;
  onEdit: (step: number) => void;
}) {
  const sections = [
    {
      title: "Business",
      step: 1,
      icon: Building2,
      color: "bg-slate-100 text-slate-600",
      items: [
        { label: "Name", value: data.businessName },
        { label: "Phone", value: data.businessPhone },
        { label: "Email", value: data.notificationEmail },
        { label: "What you do", value: data.businessDescription },
      ],
    },
    {
      title: "Assistant",
      step: 2,
      icon: Users,
      color: "bg-blue-100 text-blue-600",
      items: [
        { label: "Template", value: TEMPLATES.find((t) => t.id === data.template)?.name },
        { label: "Voice", value: VOICES.find((v) => v.id === data.voiceModel)?.name },
        { label: "FAQs configured", value: `${data.faqs.filter(f => f.answer).length} of ${data.faqs.length}` },
      ],
    },
    {
      title: "Notifications",
      step: 4,
      icon: Mail,
      color: "bg-emerald-100 text-emerald-600",
      items: [
        { label: "Email summaries", value: data.emailNotifications ? "Yes" : "No" },
        { label: "SMS summaries", value: data.smsNotifications ? `Yes (${data.smsNumber})` : "No" },
        { label: "Call forwarding", value: data.callForwarding ? `Yes (${data.forwardingNumber})` : "No" },
      ],
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Review & Launch</h2>
        <p className="text-slate-600 mt-1">Make sure everything looks right.</p>
      </div>

      <div className="space-y-4">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.title} className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", section.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-slate-900">{section.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(section.step)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Edit
                </button>
              </div>
              <div className="grid gap-2">
                {section.items.map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-slate-500">{item.label}</span>
                    <span className="text-slate-900 font-medium text-right max-w-[60%] truncate">{item.value || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Greeting preview */}
      <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-blue-900">Your assistant will answer:</p>
          <button
            type="button"
            onClick={() => onEdit(3)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Edit
          </button>
        </div>
        <p className="text-blue-800 italic">
          &ldquo;{data.greeting || `Thank you for calling ${data.businessName}! How can I help you today?`}&rdquo;
        </p>
      </div>

      {/* Auto-collected info notice */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-sm text-slate-700">
          <span className="font-medium">On every call, your assistant automatically collects:</span>
        </p>
        <ul className="mt-2 text-sm text-slate-600 space-y-1">
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Caller&apos;s name
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Callback phone number
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Reason for calling
          </li>
        </ul>
      </div>

      {/* Ready message */}
      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-emerald-900">Ready to launch!</p>
          <p className="text-sm text-emerald-700">Your assistant will be live in under 60 seconds.</p>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN ONBOARDING COMPONENT
// ═══════════════════════════════════════════════════════════════

export function OnboardingSteps() {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const API_URL = typeof window !== 'undefined' ? getApiBase() : '';

  // Load saved data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("callcrew_onboarding_v3");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setData({ ...INITIAL_DATA, ...parsed.data });
        if (parsed.step) setCurrentStep(parsed.step);
      } catch (e) {
        console.error("Failed to parse saved data");
      }
    }
  }, []);

  // Save to localStorage on changes
  const saveProgress = useCallback(() => {
    localStorage.setItem("callcrew_onboarding_v3", JSON.stringify({ data, step: currentStep }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [data, currentStep]);

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
    setErrors({});
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 1:
        if (!data.businessName.trim()) newErrors.businessName = "Business name is required";
        if (!data.businessPhone.trim()) newErrors.businessPhone = "Phone number is required";
        if (!data.notificationEmail.trim()) newErrors.notificationEmail = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.notificationEmail)) newErrors.notificationEmail = "Invalid email format";
        if (!data.businessDescription.trim()) newErrors.businessDescription = "Please describe your business";
        break;
      case 2:
        if (!data.template) newErrors.template = "Please select a template";
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (validateStep()) {
      setCurrentStep((s) => Math.min(5, s + 1));
      window.scrollTo(0, 0);
    }
  };

  const goBack = () => {
    setCurrentStep((s) => Math.max(1, s - 1));
    window.scrollTo(0, 0);
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    const payload = {
      businessName: data.businessName,
      ownerName: data.businessName,
      ownerEmail: data.notificationEmail,
      ownerPhone: data.businessPhone,
      industry: data.template,
      timezone: data.timezone,
      customGreeting: data.greeting || `Thank you for calling ${data.businessName}! How can I help you today?`,
      voiceType: data.voiceModel,
      customInstructions: `
Business Description: ${data.businessDescription}
Services: ${data.services}
Coverage: Always (24/7)

IMPORTANT: On every call, naturally collect the caller's name, callback number, and reason for calling through conversation.
      `.trim(),
      faqs: data.faqs.filter(faq => faq.answer), // Only send FAQs with answers
      callSettings: {
        enableTransfer: data.callForwarding,
        transferNumber: data.forwardingNumber,
      },
      notificationSettings: {
        primaryEmail: data.notificationEmail || data.emailNotifications ? data.notificationEmail : undefined,
        ccEmails: [],
        enableEmail: data.emailNotifications !== false,
        enableSMS: data.smsNotifications === true,
      },
    };

    try {
      const res = await fetch(`${API_URL}/api/onboarding/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (result.success) {
        localStorage.removeItem("callcrew_onboarding_v3");
        // Backend returns business.id, not business._id
        const businessId = result.business?.id || result.business?._id || result.businessId;
        window.location.href = `/dashboard/${businessId}`;
      } else {
        setErrors({ submit: result.error || "Failed to create assistant" });
      }
    } catch (error) {
      setErrors({ submit: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <Step1BusinessSetup data={data} onChange={updateData} errors={errors} />;
      case 2: return <Step2Template data={data} onChange={updateData} errors={errors} />;
      case 3: return <Step3Customize data={data} onChange={updateData} />;
      case 4: return <Step4Notifications data={data} onChange={updateData} />;
      case 5: return <Step5Review data={data} onEdit={goToStep} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <Phone className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-slate-900">CallCrew</span>
          </div>
          <button
            type="button"
            onClick={saveProgress}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="text-emerald-600">Saved</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Progress
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <ProgressBar currentStep={currentStep} />

        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>

        {errors.submit && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {errors.submit}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:text-slate-900 transition-colors rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep === 5 ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/25 font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  Launch My Assistant
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
