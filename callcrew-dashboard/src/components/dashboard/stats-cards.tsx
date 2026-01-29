"use client";

import React from "react";
import { motion } from "framer-motion";
import { Phone, Users, Clock, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardsProps {
  stats: {
    totalCalls: number;
    totalLeads: number;
    totalMinutes: number;
    conversionRate: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: "Total Calls",
      value: stats.totalCalls.toLocaleString(),
      change: "+12%",
      trend: "up",
      icon: Phone,
      gradient: "from-indigo-500 to-purple-500",
    },
    {
      title: "Leads Captured",
      value: stats.totalLeads.toLocaleString(),
      change: "+8%",
      trend: "up",
      icon: Users,
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      title: "Minutes Used",
      value: stats.totalMinutes.toLocaleString(),
      change: "-3%",
      trend: "down",
      icon: Clock,
      gradient: "from-amber-500 to-orange-500",
    },
    {
      title: "Conversion Rate",
      value: `${stats.conversionRate}%`,
      change: "+5%",
      trend: "up",
      icon: TrendingUp,
      gradient: "from-rose-500 to-pink-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card hover className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-neutral-500 mb-1">{card.title}</p>
                    <motion.p
                      className="text-3xl font-bold text-neutral-900"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 + 0.2 }}
                    >
                      {card.value}
                    </motion.p>
                    <div className="flex items-center gap-1 mt-2">
                      {card.trend === "up" ? (
                        <ArrowUp className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ArrowDown className="w-4 h-4 text-red-500" />
                      )}
                      <span
                        className={cn(
                          "text-sm font-medium",
                          card.trend === "up" ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {card.change}
                      </span>
                      <span className="text-xs text-neutral-400">vs last month</span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                      card.gradient
                    )}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
