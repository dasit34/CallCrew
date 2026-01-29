"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Phone,
  PhoneIncoming,
  UserPlus,
  Calendar,
  Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatRelativeTime } from "@/lib/utils";

interface Activity {
  id: string;
  type: "call" | "lead" | "appointment" | "notification";
  title: string;
  description: string;
  timestamp: string;
}

const iconMap = {
  call: PhoneIncoming,
  lead: UserPlus,
  appointment: Calendar,
  notification: Bell,
};

const colorMap = {
  call: "bg-indigo-100 text-indigo-600",
  lead: "bg-emerald-100 text-emerald-600",
  appointment: "bg-amber-100 text-amber-600",
  notification: "bg-purple-100 text-purple-600",
};

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const Icon = iconMap[activity.type];
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                      colorMap[activity.type]
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {activity.title}
                    </p>
                    <p className="text-sm text-neutral-500 truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {formatRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
