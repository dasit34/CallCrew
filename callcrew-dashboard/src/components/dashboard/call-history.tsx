"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  MessageSquare,
  Download,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatPhoneNumber, formatDuration, formatRelativeTime } from "@/lib/utils";

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

interface CallHistoryProps {
  calls: Call[];
  loading?: boolean;
}

function CallRow({ call }: { call: Call }) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    completed: { icon: Phone, color: "success", label: "Completed" },
    missed: { icon: PhoneMissed, color: "destructive", label: "Missed" },
    "in-progress": { icon: PhoneIncoming, color: "warning", label: "In Progress" },
  };

  const config = statusConfig[call.status as keyof typeof statusConfig] || statusConfig.completed;
  const StatusIcon = config.icon;

  return (
    <motion.div
      layout
      className={cn(
        "border-b border-neutral-100 last:border-0 transition-colors",
        expanded && "bg-neutral-50"
      )}
    >
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          config.color === "success" && "bg-emerald-100",
          config.color === "destructive" && "bg-red-100",
          config.color === "warning" && "bg-amber-100"
        )}>
          <StatusIcon className={cn(
            "w-5 h-5",
            config.color === "success" && "text-emerald-600",
            config.color === "destructive" && "text-red-600",
            config.color === "warning" && "text-amber-600"
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-neutral-900 truncate">
              {formatPhoneNumber(call.fromNumber)}
            </p>
            {call.leadCaptured && (
              <Badge variant="success" className="text-xs">Lead</Badge>
            )}
          </div>
          <p className="text-sm text-neutral-500 truncate">{call.callerIntent || "No intent detected"}</p>
        </div>

        <div className="hidden sm:flex items-center gap-6 text-sm text-neutral-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{formatDuration(call.duration)}</span>
          </div>
          <Badge variant={config.color as "success" | "destructive" | "warning"}>
            {config.label}
          </Badge>
          <span className="w-24 text-right">{formatRelativeTime(call.createdAt)}</span>
        </div>

        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-neutral-400" />
        </motion.div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">
              <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-4">
                {/* Summary */}
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Conversation Summary
                  </h4>
                  <p className="text-sm text-neutral-600">
                    {call.conversationSummary || "No summary available"}
                  </p>
                </div>

                {/* Transcript */}
                {call.transcript && call.transcript.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-neutral-700 mb-2">Transcript</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {call.transcript.map((msg, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex gap-3",
                            msg.role === "assistant" ? "flex-row" : "flex-row-reverse"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[80%] p-3 rounded-xl text-sm",
                              msg.role === "assistant"
                                ? "bg-indigo-50 text-indigo-900"
                                : "bg-neutral-100 text-neutral-900"
                            )}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
                  <Button variant="outline" size="sm">
                    <Play className="w-4 h-4 mr-1" />
                    Play Recording
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function CallHistory({ calls, loading }: CallHistoryProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-neutral-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-200 rounded w-1/4" />
                  <div className="h-3 bg-neutral-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Calls</CardTitle>
        <Button variant="ghost" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {calls.length === 0 ? (
          <div className="p-12 text-center">
            <Phone className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500">No calls yet</p>
            <p className="text-sm text-neutral-400 mt-1">
              Calls will appear here once your assistant starts receiving them
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {calls.map((call) => (
              <CallRow key={call._id} call={call} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
