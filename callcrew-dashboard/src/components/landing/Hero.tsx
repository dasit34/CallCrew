"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-mesh-gradient" />
      <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white" />
      
      {/* Floating orbs */}
      <motion.div
        animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-400/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 20, 0], x: [0, -10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-50 border border-brand-100 mb-8">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-medium text-brand-700">
                AI-Powered Phone Reception
              </span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-neutral-900 mb-6"
          >
            Never miss a call.
            <br />
            <span className="gradient-text">Ever again.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-neutral-600 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Your AI receptionist answers every call, captures leads, and books
            appointments 24/7. Professional voice, perfect memory, zero missed
            opportunities.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/onboarding">
              <Button variant="gradient" size="xl" className="group">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button variant="outline" size="xl" className="group">
              <Play className="mr-2 w-5 h-5 text-brand-600" />
              Watch Demo
            </Button>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-16 flex flex-col items-center"
          >
            <div className="flex -space-x-3 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-purple-400 border-2 border-white flex items-center justify-center text-white text-xs font-medium"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-sm text-neutral-500">
              <span className="font-semibold text-neutral-700">500+</span>{" "}
              businesses trust CallCrew
            </p>
          </motion.div>
        </div>

        {/* Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
          <div className="relative rounded-2xl border border-neutral-200/60 shadow-glass-lg overflow-hidden bg-white">
            <div className="absolute top-0 left-0 right-0 h-12 bg-neutral-50 border-b border-neutral-200/60 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="pt-12 p-8 bg-gradient-to-br from-neutral-50 to-white">
              {/* Dashboard mockup */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: "Total Calls", value: "1,234" },
                  { label: "Leads Captured", value: "456" },
                  { label: "Minutes Saved", value: "8.2K" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white rounded-xl border border-neutral-200/60 p-4"
                  >
                    <p className="text-sm text-neutral-500">{stat.label}</p>
                    <p className="text-2xl font-semibold text-neutral-900 mt-1">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-neutral-200/60 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-neutral-900">Recent Calls</h4>
                  <span className="text-sm text-brand-600">View all</span>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-brand-700">
                            JD
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-900">
                            John Doe
                          </p>
                          <p className="text-xs text-neutral-500">
                            2 minutes ago
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-success-600 bg-success-50 px-2 py-1 rounded-full">
                        Lead Captured
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
