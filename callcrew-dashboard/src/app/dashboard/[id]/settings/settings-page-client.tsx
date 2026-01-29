"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Mic,
  Clock,
  Settings,
  Save,
  Check,
  Loader2,
  Play,
  Forward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api-base";

interface Business {
  _id: string;
  businessName: string;
  twilioPhoneNumber: string;
  customGreeting: string;
  voiceType: string;
  isActive: boolean;
  businessHours: { day: string; open: string; close: string; isClosed: boolean }[];
  callForwardingNumber?: string;
}

const VOICES = [
  { id: "alloy", name: "Alloy", description: "Professional and friendly", gender: "Neutral" },
  { id: "echo", name: "Echo", description: "Warm and authoritative", gender: "Male" },
  { id: "fable", name: "Fable", description: "Expressive and engaging", gender: "Female" },
  { id: "onyx", name: "Onyx", description: "Deep and confident", gender: "Male" },
  { id: "nova", name: "Nova", description: "Soft and welcoming", gender: "Female" },
  { id: "shimmer", name: "Shimmer", description: "Clear and energetic", gender: "Female" },
];

const TABS = [
  { id: "overview", label: "Overview", icon: Settings },
  { id: "voice", label: "Voice", icon: Mic },
  { id: "schedule", label: "Schedule", icon: Clock },
  { id: "advanced", label: "Advanced", icon: Forward },
];

export default function SettingsPageClient({ id }: { id: string }) {
  const apiBase = getApiBase();
  const [activeTab, setActiveTab] = useState("overview");
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState<Partial<Business>>({});

  useEffect(() => {
    async function fetchBusiness() {
      try {
        const res = await fetch(`${apiBase}/api/admin/businesses/${id}`);
        const data = await res.json();
        if (data.success) {
          setBusiness(data.business);
          setFormData(data.business);
        }
      } catch (e) {
        console.error("Failed to fetch business:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchBusiness();
  }, [id, apiBase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/admin/businesses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setBusiness(data.business);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setSaving(false);
    }
  };

  const updateHours = (index: number, updates: Partial<Business["businessHours"][0]>) => {
    const hours = [...(formData.businessHours || business?.businessHours || [])];
    hours[index] = { ...hours[index], ...updates };
    setFormData({ ...formData, businessHours: hours });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!business) {
    return <div>Business not found</div>;
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Assistant Settings</h1>
          <p className="text-neutral-500">Configure your AI receptionist</p>
        </div>
        <Button
          variant={saved ? "success" : "gradient"}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4 mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-white text-neutral-900 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === "overview" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Basic details about your business</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Business Name"
                  value={formData.businessName || ""}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                />
                <div>
                  <label className="text-sm font-medium text-neutral-700 mb-2 block">Phone Number</label>
                  <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
                    <Phone className="w-5 h-5 text-neutral-500" />
                    <span className="font-mono text-neutral-900">{business.twilioPhoneNumber}</span>
                    <Badge variant="success" className="ml-auto">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Greeting Message</CardTitle>
                <CardDescription>What callers hear when they call</CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full h-32 rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  value={formData.customGreeting || ""}
                  onChange={(e) => setFormData({ ...formData, customGreeting: e.target.value })}
                  placeholder="Thank you for calling! How may I help you today?"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "voice" && (
          <Card>
            <CardHeader>
              <CardTitle>Voice Selection</CardTitle>
              <CardDescription>Choose the voice for your AI receptionist</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {VOICES.map((voice) => (
                  <div
                    key={voice.id}
                    onClick={() => setFormData({ ...formData, voiceType: voice.id })}
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer transition-all",
                      formData.voiceType === voice.id
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center">
                          <Mic className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-900">{voice.name}</p>
                          <p className="text-xs text-neutral-500">{voice.gender}</p>
                        </div>
                      </div>
                      {formData.voiceType === voice.id && (
                        <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600">{voice.description}</p>
                    <Button variant="ghost" size="sm" className="mt-3">
                      <Play className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "schedule" && (
          <Card>
            <CardHeader>
              <CardTitle>Business Hours</CardTitle>
              <CardDescription>Set when your business is open</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(formData.businessHours || business?.businessHours || []).map((day, index) => (
                  <div
                    key={day.day}
                    className="flex items-center gap-4 p-3 rounded-xl bg-neutral-50 border border-neutral-200"
                  >
                    <div className="w-24 font-medium text-neutral-900">{day.day}</div>
                    <div className="flex-1 flex items-center gap-3">
                      {day.isClosed ? (
                        <span className="text-neutral-500">Closed</span>
                      ) : (
                        <>
                          <input
                            type="time"
                            value={day.open}
                            onChange={(e) => updateHours(index, { open: e.target.value })}
                            className="px-3 py-1.5 rounded-lg border border-neutral-200 text-sm"
                          />
                          <span className="text-neutral-400">to</span>
                          <input
                            type="time"
                            value={day.close}
                            onChange={(e) => updateHours(index, { close: e.target.value })}
                            className="px-3 py-1.5 rounded-lg border border-neutral-200 text-sm"
                          />
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => updateHours(index, { isClosed: !day.isClosed })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        day.isClosed ? "bg-neutral-200 text-neutral-700" : "bg-emerald-100 text-emerald-700"
                      )}
                    >
                      {day.isClosed ? "Closed" : "Open"}
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "advanced" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Call Forwarding</CardTitle>
                <CardDescription>Forward calls to another number when needed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      label="Forwarding Number"
                      placeholder="+1 (555) 123-4567"
                      value={formData.callForwardingNumber || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, callForwardingNumber: e.target.value })
                      }
                      icon={<Forward className="w-4 h-4" />}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-700">Danger Zone</CardTitle>
                <CardDescription className="text-red-600">
                  Actions here cannot be undone
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive">Delete Assistant</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>
    </div>
  );
}
