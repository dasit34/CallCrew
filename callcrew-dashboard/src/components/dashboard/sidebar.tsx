"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Phone,
  LayoutDashboard,
  History,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "", icon: LayoutDashboard, label: "Overview" },
  { href: "/calls", icon: History, label: "Call History" },
  { href: "/leads", icon: Users, label: "Leads" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ businessId }: { businessId: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-white border-r border-neutral-200/60 shadow-sm"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-100">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Phone className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-semibold text-neutral-900"
            >
              CallCrew
            </motion.span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-neutral-500" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const fullPath = `/dashboard/${businessId}${item.href}`;
          const isActive = pathname === fullPath || (item.href === "" && pathname === `/dashboard/${businessId}`);

          return (
            <Link
              key={item.label}
              href={fullPath}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-indigo-50 text-indigo-600"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              )}
            >
              <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-indigo-600")} />
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-medium"
                >
                  {item.label}
                </motion.span>
              )}
              {isActive && !collapsed && (
                <motion.div
                  layoutId="activeIndicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade Card */}
      {!collapsed && (
        <div className="p-3">
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4" />
              <span className="font-medium text-sm">Upgrade to Pro</span>
            </div>
            <p className="text-xs text-white/80 mb-3">
              Get unlimited minutes and advanced features
            </p>
            <button className="w-full py-2 rounded-lg bg-white text-indigo-600 text-sm font-medium hover:bg-white/90 transition-colors">
              Upgrade Now
            </button>
          </div>
        </div>
      )}

      {/* User */}
      <div className="p-3 border-t border-neutral-100">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-neutral-600 hover:bg-neutral-50 transition-colors">
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="font-medium">Sign Out</span>}
        </button>
      </div>
    </motion.aside>
  );
}
