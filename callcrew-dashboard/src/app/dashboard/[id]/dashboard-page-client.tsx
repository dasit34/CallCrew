"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { CallHistory } from "@/components/dashboard/call-history";
import { AssistantStatus } from "@/components/dashboard/assistant-status";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { CallChart } from "@/components/dashboard/call-chart";
import { Skeleton } from "@/components/ui/skeleton";

interface Business {
  _id: string;
  businessName: string;
  twilioPhoneNumber: string;
  isActive: boolean;
  voiceType: string;
  stats: {
    totalCalls: number;
    totalLeads: number;
    totalMinutes: number;
  };
}

interface Call {
  _id: string;
  fromNumber: string;
  status: string;
  duration: number;
  callerIntent: string;
  sentiment: string;
  leadCaptured: boolean;
  conversationSummary: string;
  transcript: { role: string; content: string; timestamp: string }[];
  createdAt: string;
}

import { getApiBase } from "@/lib/api-base";

export default function DashboardPageClient({ id }: { id: string }) {
  const apiBase = getApiBase();
  const [business, setBusiness] = useState<Business | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [businessRes, callsRes] = await Promise.all([
          fetch(`${apiBase}/api/admin/businesses/${id}`),
          fetch(`${apiBase}/api/calls?businessId=${id}&limit=10`),
        ]);

        const businessData = await businessRes.json();
        const callsData = await callsRes.json();

        if (businessData.success) setBusiness(businessData.business);
        if (callsData.success) setCalls(callsData.calls || []);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id, apiBase]);

  const toggleAssistant = async () => {
    if (!business) return;

    try {
      const res = await fetch(`${apiBase}/api/admin/businesses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !business.isActive }),
      });
      const data = await res.json();
      if (data.success) setBusiness(data.business);
    } catch (error) {
      console.error("Failed to toggle assistant:", error);
    }
  };

  const activities = calls.slice(0, 5).map((call) => ({
    id: call._id,
    type: (call.leadCaptured ? "lead" : "call") as "lead" | "call",
    title: call.leadCaptured ? "New lead captured" : "Incoming call",
    description: `From ${call.fromNumber}`,
    timestamp: call.createdAt,
  }));

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Business not found</h2>
          <p className="text-neutral-500">The business you are looking for does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-neutral-900">{business.businessName}</h1>
        <p className="text-neutral-500">Welcome back! Here is what is happening with your AI assistant.</p>
      </motion.div>

      <StatsCards
        stats={{
          totalCalls: business.stats.totalCalls,
          totalLeads: business.stats.totalLeads,
          totalMinutes: business.stats.totalMinutes,
          conversionRate:
            business.stats.totalCalls > 0
              ? Math.round((business.stats.totalLeads / business.stats.totalCalls) * 100)
              : 0,
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CallChart data={[]} />
          <CallHistory calls={calls} />
        </div>
        <div className="space-y-6">
          <AssistantStatus business={business} onToggle={toggleAssistant} />
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
}
