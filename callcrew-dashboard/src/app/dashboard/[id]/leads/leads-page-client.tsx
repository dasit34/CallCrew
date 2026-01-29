"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Mail,
  Phone,
  MoreHorizontal,
  Star,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatPhoneNumber, formatRelativeTime } from "@/lib/utils";
import { getApiBase } from "@/lib/api-base";

interface Lead {
  _id: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  quality: string;
  interestedIn: string;
  conversationSummary: string;
  createdAt: string;
}

const qualityColors = {
  hot: "bg-red-100 text-red-700",
  warm: "bg-amber-100 text-amber-700",
  cold: "bg-blue-100 text-blue-700",
};

const statusColors = {
  new: "bg-indigo-100 text-indigo-700",
  contacted: "bg-amber-100 text-amber-700",
  qualified: "bg-emerald-100 text-emerald-700",
  converted: "bg-green-100 text-green-700",
  lost: "bg-neutral-100 text-neutral-700",
};

export default function LeadsPageClient({ id }: { id: string }) {
  const apiBase = getApiBase();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchLeads() {
      try {
        const res = await fetch(`${apiBase}/api/admin/leads?businessId=${id}&limit=50`);
        const data = await res.json();
        if (data.success) setLeads(data.leads || []);
      } catch (e) {
        console.error("Failed to fetch leads:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchLeads();
  }, [id, apiBase]);

  const filteredLeads = leads.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.name?.toLowerCase().includes(s) || l.phone?.includes(search) || l.email?.toLowerCase().includes(s);
  });

  const stats = {
    total: leads.length,
    hot: leads.filter((l) => l.quality === "hot").length,
    new: leads.filter((l) => l.status === "new").length,
    converted: leads.filter((l) => l.status === "converted").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Leads</h1>
          <p className="text-neutral-500">Manage captured leads from calls</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Leads", value: stats.total, color: "bg-indigo-500" },
          { label: "Hot Leads", value: stats.hot, color: "bg-red-500" },
          { label: "New This Week", value: stats.new, color: "bg-amber-500" },
          { label: "Converted", value: stats.converted, color: "bg-emerald-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-sm text-neutral-500">{stat.label}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={cn("w-2 h-2 rounded-full", stat.color)} />
                <span className="text-2xl font-bold text-neutral-900">{stat.value}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="max-w-md">
        <Input
          placeholder="Search leads..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500">No leads found</p>
            <p className="text-sm text-neutral-400 mt-1">
              Leads will appear here when callers share their contact information
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((lead, index) => (
            <motion.div
              key={lead._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card hover className="h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-medium">
                        {lead.name
                          ? lead.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
                          : "?"}
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900">{lead.name || "Unknown"}</p>
                        <p className="text-sm text-neutral-500">{formatRelativeTime(lead.createdAt)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 mb-4">
                    {lead.phone && (
                      <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <Phone className="w-4 h-4 text-neutral-400" />
                        <span>{formatPhoneNumber(lead.phone)}</span>
                      </div>
                    )}
                    {lead.email && (
                      <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <Mail className="w-4 h-4 text-neutral-400" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}
                  </div>
                  {lead.interestedIn && (
                    <p className="text-sm text-neutral-600 mb-4 line-clamp-2">{lead.interestedIn}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn("text-xs", statusColors[lead.status as keyof typeof statusColors] || statusColors.new)}
                    >
                      {lead.status || "new"}
                    </Badge>
                    {lead.quality && (
                      <Badge
                        className={cn("text-xs", qualityColors[lead.quality as keyof typeof qualityColors] || qualityColors.cold)}
                      >
                        <Star className="w-3 h-3 mr-1" />
                        {lead.quality}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
