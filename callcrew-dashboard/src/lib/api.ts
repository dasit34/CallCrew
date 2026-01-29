import { getApiBase } from './api-base';

// Resolved at runtime on client; empty string = same-origin (/api)
const API_BASE_URL = typeof window !== 'undefined' ? getApiBase() : '';

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
}

async function fetcher<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;
  
  let url = `${API_BASE_URL}${endpoint}`;
  
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// API Functions
export const api = {
  // Health
  health: () => fetcher<{ status: string; timestamp: string }>('/health'),

  // Industries/Templates
  getIndustries: () => 
    fetcher<{ success: boolean; templates: Industry[] }>('/api/onboarding/industries'),

  // Businesses
  getBusinesses: (params?: { limit?: string; skip?: string }) =>
    fetcher<{ success: boolean; businesses: Business[]; total: number }>('/api/admin/businesses', { params }),
  
  getBusiness: (id: string) =>
    fetcher<{ success: boolean; business: Business }>(`/api/admin/businesses/${id}`),
  
  updateBusiness: (id: string, data: Partial<Business>) =>
    fetcher<{ success: boolean; business: Business }>(`/api/admin/businesses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Onboarding
  createBusiness: (data: CreateBusinessData) =>
    fetcher<{ success: boolean; business: Business; message: string }>('/api/onboarding/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  searchNumbers: (areaCode?: string) =>
    fetcher<{ success: boolean; numbers: PhoneNumber[] }>('/api/onboarding/search-numbers', {
      method: 'POST',
      body: JSON.stringify({ areaCode, limit: 5 }),
    }),

  // Calls
  getCalls: (businessId: string, params?: { limit?: string; skip?: string }) =>
    fetcher<{ success: boolean; calls: Call[]; total: number }>('/api/calls', {
      params: { businessId, ...params },
    }),

  getCall: (id: string) =>
    fetcher<{ success: boolean; call: Call }>(`/api/calls/${id}`),

  getCallStats: (businessId: string, days?: number) =>
    fetcher<{ success: boolean; stats: CallStats }>(`/api/calls/stats/${businessId}`, {
      params: days ? { days: days.toString() } : undefined,
    }),

  // Leads
  getLeads: (businessId: string, params?: { limit?: string; skip?: string; status?: string }) =>
    fetcher<{ success: boolean; leads: Lead[]; total: number }>('/api/admin/leads', {
      params: { businessId, ...params },
    }),

  getLeadStats: (businessId: string) =>
    fetcher<{ success: boolean; stats: LeadStats }>(`/api/admin/leads/stats/${businessId}`),

  // Dashboard
  getDashboard: (businessId: string) =>
    fetcher<{ success: boolean; dashboard: DashboardData }>(`/api/admin/dashboard/${businessId}`),
};

// Types
export interface Industry {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  suggestedServices: { name: string; description: string }[];
  suggestedFaqs: { question: string; answer: string }[];
}

export interface Business {
  _id: string;
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  industry: string;
  twilioPhoneNumber: string;
  customGreeting: string;
  voiceType: string;
  businessHours: { day: string; open: string; close: string; isClosed: boolean }[];
  isActive: boolean;
  onboardingCompleted: boolean;
  stats: {
    totalCalls: number;
    totalLeads: number;
    totalMinutes: number;
  };
  subscription: {
    plan: string;
    status: string;
    trialEndsAt: string;
  };
  createdAt: string;
}

export interface PhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}

export interface Call {
  _id: string;
  twilioCallSid: string;
  fromNumber: string;
  toNumber: string;
  status: string;
  duration: number;
  formattedDuration: string;
  callerIntent: string;
  sentiment: string;
  leadCaptured: boolean;
  conversationSummary: string;
  transcript: { role: string; content: string; timestamp: string }[];
  createdAt: string;
}

export interface Lead {
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

export interface CallStats {
  totalCalls: number;
  completedCalls: number;
  missedCalls: number;
  avgDuration: number;
  leadsFromCalls: number;
  callsByDay: { _id: string; count: number }[];
}

export interface LeadStats {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  conversionRate: number;
}

export interface DashboardData {
  business: {
    name: string;
    phone: string;
    stats: { totalCalls: number; totalLeads: number; totalMinutes: number };
    subscription: { plan: string; status: string; trialEndsAt: string };
  };
  callStats: { totalCalls: number; totalDuration: number; avgDuration: number };
  leadStats: LeadStats;
  recentCalls: Call[];
  recentLeads: Lead[];
}

export interface CreateBusinessData {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  industry: string;
  selectedPhoneNumber: string;
  customGreeting?: string;
  voiceType?: string;
  businessHours?: { day: string; open: string; close: string; isClosed: boolean }[];
}
