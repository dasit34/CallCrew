"use client";

import React from "react";
import { motion } from "framer-motion";
import { Phone, Power, Settings, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatPhoneNumber } from "@/lib/utils";

interface AssistantStatusProps {
  business: {
    businessName: string;
    twilioPhoneNumber: string;
    isActive: boolean;
    voiceType: string;
  };
  onToggle: () => void;
}

export function AssistantStatus({ business, onToggle }: AssistantStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Assistant Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Toggle */}
        <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={cn(
                  "w-3 h-3 rounded-full",
                  business.isActive ? "bg-emerald-500" : "bg-neutral-400"
                )}
              />
              {business.isActive && (
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
              )}
            </div>
            <div>
              <p className="font-medium text-neutral-900">
                {business.isActive ? "Active" : "Inactive"}
              </p>
              <p className="text-sm text-neutral-500">
                {business.isActive ? "Receiving calls" : "Not receiving calls"}
              </p>
            </div>
          </div>

          {/* iOS-style toggle */}
          <button
            onClick={onToggle}
            className={cn(
              "relative w-14 h-8 rounded-full transition-colors duration-300",
              business.isActive ? "bg-emerald-500" : "bg-neutral-300"
            )}
          >
            <motion.div
              className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md"
              animate={{ left: business.isActive ? 30 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        {/* Phone Number */}
        <div className="space-y-2">
          <p className="text-sm text-neutral-500">Phone Number</p>
          <div className="flex items-center justify-between">
            <p className="font-mono text-lg font-medium text-neutral-900">
              {formatPhoneNumber(business.twilioPhoneNumber)}
            </p>
            <Button variant="ghost" size="sm">
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Voice */}
        <div className="space-y-2">
          <p className="text-sm text-neutral-500">Voice</p>
          <p className="font-medium text-neutral-900 capitalize">{business.voiceType}</p>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-neutral-100">
          <Button variant="outline" className="w-full">
            <Settings className="w-4 h-4 mr-2" />
            Configure Assistant
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
