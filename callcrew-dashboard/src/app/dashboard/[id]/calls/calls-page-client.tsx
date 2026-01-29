"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPhoneNumber, formatDuration, formatRelativeTime } from "@/lib/utils";
import { getApiBase } from "@/lib/api-base";

interface Call {
  _id: string;
  fromNumber: string;
  status: string;
  duration: number;
  callerIntent: string;
  sentiment: string;
  leadCaptured: boolean;
  conversationSummary: string;
  createdAt: string;
}

export default function CallsPageClient({ id }: { id: string }) {
  const apiBase = getApiBase();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const limit = 10;

  useEffect(() => {
    async function fetchCalls() {
      setLoading(true);
      try {
        const res = await fetch(
          `${apiBase}/api/calls?businessId=${id}&limit=${limit}&skip=${(page - 1) * limit}`
        );
        const data = await res.json();
        if (data.success) {
          setCalls(data.calls || []);
          setTotal(data.total || 0);
        }
      } catch (e) {
        console.error("Failed to fetch calls:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchCalls();
  }, [id, page, apiBase]);

  const filteredCalls = calls.filter((c) => {
    if (search && !c.fromNumber.includes(search)) return false;
    if (filter === "leads" && !c.leadCaptured) return false;
    if (filter === "completed" && c.status !== "completed") return false;
    if (filter === "missed" && c.status !== "missed") return false;
    return true;
  });

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Call History</h1>
          <p className="text-neutral-500">View and manage all incoming calls</p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex gap-2">
          {["all", "leads", "completed", "missed"].map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-neutral-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="p-12 text-center">
              <Phone className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500">No calls found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                      Caller
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                      Intent
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                      Duration
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredCalls.map((call, index) => (
                    <motion.tr
                      key={call._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-neutral-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Phone className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-neutral-900">
                              {formatPhoneNumber(call.fromNumber)}
                            </p>
                            {call.leadCaptured && (
                              <Badge variant="success" className="text-xs mt-1">
                                Lead
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-neutral-600 max-w-xs truncate">
                          {call.callerIntent || "No intent detected"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-neutral-600">
                          {formatDuration(call.duration)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={
                            call.status === "completed"
                              ? "success"
                              : call.status === "missed"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {call.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-neutral-500">
                          {formatRelativeTime(call.createdAt)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} calls
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-neutral-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
