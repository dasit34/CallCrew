import React from "react";
import {
  Navbar,
  Hero,
  WhatItDoes,
  OnOffControl,
  ReplaceLiveAssistants,
  IndustryAssistants,
  HowItWorks,
  FAQ,
  CallDemoCTA,
  FinalCTA,
  Footer,
} from "@/components/landing";
import { WhoThisIsFor } from "@/components/landing/WhoThisIsFor";
import { ProblemSolution } from "@/components/landing/ProblemSolution";
import { RealWorldSchedules } from "@/components/landing/RealWorldSchedules";
import { Testimonials } from "@/components/landing/Testimonials";
import { PricingTeaser } from "@/components/landing/PricingTeaser";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <WhoThisIsFor />
      <RealWorldSchedules />
      <ProblemSolution />
      <WhatItDoes />
      <OnOffControl />
      <ReplaceLiveAssistants />
      <IndustryAssistants />
      <Testimonials />
      <PricingTeaser />
      <HowItWorks />
      <FAQ />
      <CallDemoCTA />
      <FinalCTA />
      <Footer />
    </main>
  );
}
