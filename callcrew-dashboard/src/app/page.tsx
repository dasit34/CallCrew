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

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <WhoThisIsFor />
      <WhatItDoes />
      <OnOffControl />
      <ReplaceLiveAssistants />
      <IndustryAssistants />
      <HowItWorks />
      <FAQ />
      <CallDemoCTA />
      <FinalCTA />
      <Footer />
    </main>
  );
}
