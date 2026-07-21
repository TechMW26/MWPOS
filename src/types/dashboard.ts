import type { OrderStatus, UserRole } from "@/types";

export interface DashboardFilterOption {
  id: string;
  label: string;
}

export interface DashboardOrderRow {
  id: string;
  status: OrderStatus;
  distributorId: string;
  distributorName: string;
  asmId: string;
  asmName: string;
  placedByName: string;
  paymentMode: string;
  paymentStatus: string;
  totalPaise: number;
  createdAt: string;
  historyCount: number;
}

export interface DashboardPerformanceRow {
  id: string;
  name: string;
  orders: number;
  delivered: number;
  pending: number;
  valuePaise: number;
  lastOrderAt: string | null;
}

export interface DashboardActivityRow {
  id: string;
  label: string;
  detail: string;
  actorName: string;
  entityId: string;
  createdAt: string;
  kind: "ORDER" | "AUDIT";
}

export interface DashboardResponse {
  viewer: { role: UserRole; displayName: string };
  scopeLabel: string;
  orderBasePath: string;
  generatedAt: string;
  filters: {
    distributors: DashboardFilterOption[];
    asms: DashboardFilterOption[];
    statuses: OrderStatus[];
  };
  metrics: {
    orders: number;
    orderValuePaise: number;
    averageOrderPaise: number;
    khataDuePaise: number;
    pendingApprovals: number;
    delivered: number;
    fulfillmentRate: number;
    activeClients: number;
    activeAsms: number;
    activeProducts: number;
    lowStock: number;
  };
  trend: Array<{ label: string; value: number; orders: number }>;
  statusCounts: Array<{ label: string; value: number; color: string }>;
  recentOrders: DashboardOrderRow[];
  asmPerformance: DashboardPerformanceRow[];
  clientPerformance: DashboardPerformanceRow[];
  activity: DashboardActivityRow[];
}
