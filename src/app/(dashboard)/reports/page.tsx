"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/types";
import { formatDate } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";


type ReportType =
  | "today_orders"
  | "today_delivery"
  | "tomorrow_delivery"
  | "next7_delivery"
  | "pending_fabric"
  | "pending_work"
  | "pending_stitching"
  | "delivered"
  | "delayed";

const REPORTS = [
  { id: "today_orders" as ReportType, label: "Today's Orders", icon: "📋" },
  { id: "today_delivery" as ReportType, label: "Today's Deliveries", icon: "🚚" },
  { id: "tomorrow_delivery" as ReportType, label: "Tomorrow's Deliveries", icon: "📅" },
  { id: "next7_delivery" as ReportType, label: "Next 7 Days Deliveries", icon: "🗓️" },
  { id: "pending_fabric" as ReportType, label: "Pending Fabric", icon: "🧶" },
  { id: "pending_work" as ReportType, label: "Pending Work", icon: "✂️" },
  { id: "pending_stitching" as ReportType, label: "Pending Stitching", icon: "🪡" },
  { id: "delivered" as ReportType, label: "Delivered Orders", icon: "✅" },
  { id: "delayed" as ReportType, label: "Delayed Orders", icon: "⚠️" },
];

function filterOrders(orders: Order[], type: ReportType): Order[] {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");
  const next7Str = format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd");

  switch (type) {
    case "today_orders":
      return orders.filter((o) => o.order_date === todayStr);
    case "today_delivery":
      return orders.filter((o) => o.delivery_date === todayStr);
    case "tomorrow_delivery":
      return orders.filter((o) => o.delivery_date === tomorrowStr);
    case "next7_delivery":
      return orders.filter(
        (o) => o.delivery_date && o.delivery_date >= todayStr && o.delivery_date <= next7Str
      );
    case "pending_fabric":
      return orders.filter((o) =>
        o.order_items?.some(
          (i) => i.item_progress?.fabric_status === "pending" || i.item_progress?.fabric_status === "in_progress"
        )
      );
    case "pending_work":
      return orders.filter((o) =>
        o.order_items?.some(
          (i) => i.item_progress?.work_status === "pending" || i.item_progress?.work_status === "in_progress"
        )
      );
    case "pending_stitching":
      return orders.filter((o) =>
        o.order_items?.some(
          (i) => i.item_progress?.stitching_status === "pending" || i.item_progress?.stitching_status === "in_progress"
        )
      );
    case "delivered":
      return orders.filter((o) => o.status === "delivered");
    case "delayed":
      return orders.filter(
        (o) =>
          o.status === "active" &&
          o.delivery_date &&
          o.delivery_date < todayStr
      );
    default:
      return orders;
  }
}

export default function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<ReportType>("today_orders");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("oms_orders")
      .select("*, party:parties(name, phone), order_items(*, item_progress(*))")
      .order("delivery_date", { ascending: true })
      .then(({ data }) => {
        setOrders((data || []) as Order[]);
        setLoading(false);
      });
  }, []);

  const reportData = filterOrders(orders, activeReport);
  const currentReport = REPORTS.find((r) => r.id === activeReport);

  const exportCSV = () => {
    const rows = [
      ["Order No", "Party", "Phone", "Order Date", "Delivery Date", "Status", "Items"],
      ...reportData.map((o) => [
        o.order_number,
        o.party?.name || "",
        o.phone || "",
        o.order_date,
        o.delivery_date || "",
        o.status,
        o.order_items?.length || 0,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeReport}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("CSV exported!");
  };

  const exportJSON = () => {
    const json = JSON.stringify(reportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeReport}_${format(new Date(), "yyyy-MM-dd")}.json`;
    a.click();
    toast.success("JSON exported!");
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar Reports List */}
      <div className="w-64 flex-shrink-0">
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted))" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reports</p>
          </div>
          <nav className="p-2 space-y-0.5">
            {REPORTS.map((r) => (
              <button
                key={r.id}
                id={`report-${r.id}`}
                onClick={() => setActiveReport(r.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all"
                style={{
                  background: activeReport === r.id ? "hsl(var(--primary) / 0.1)" : "transparent",
                  color: activeReport === r.id ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                }}
              >
                <span>{r.icon}</span>
                <span>{r.label}</span>
                {!loading && (
                  <span
                    className="ml-auto text-xs rounded-full px-1.5 py-0.5 font-medium"
                    style={{
                      background: activeReport === r.id ? "hsl(var(--primary) / 0.2)" : "hsl(var(--muted))",
                      color: activeReport === r.id ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {filterOrders(orders, r.id).length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 min-w-0">
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "hsl(var(--border))" }}>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                {currentReport?.icon} {currentReport?.label}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading ? "Loading..." : `${reportData.length} order${reportData.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                id="export-csv-btn"
                onClick={exportCSV}
                disabled={loading || reportData.length === 0}
                className="px-3 py-2 rounded-lg border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                📄 CSV
              </button>
              <button
                id="export-json-btn"
                onClick={exportJSON}
                disabled={loading || reportData.length === 0}
                className="px-3 py-2 rounded-lg border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-40"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                📊 JSON
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="shimmer h-12 rounded-lg" />
              ))}
            </div>
          ) : reportData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <span className="text-4xl mb-3">{currentReport?.icon}</span>
              <p className="text-sm">No orders found for this report</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium text-muted-foreground uppercase tracking-wide" style={{ background: "hsl(var(--muted))" }}>
                    <th className="px-4 py-3 text-left">Order No</th>
                    <th className="px-4 py-3 text-left">Party</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Order Date</th>
                    <th className="px-4 py-3 text-left">Delivery Date</th>
                    <th className="px-4 py-3 text-left">Items</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((order) => (
                    <tr key={order.id} className="border-b last:border-0" style={{ borderColor: "hsl(var(--border))" }}>
                      <td className="px-4 py-3">
                        <a
                          href={`/orders/${order.id}`}
                          className="font-bold hover:underline"
                          style={{ color: "hsl(var(--primary))" }}
                        >
                          {order.order_number}
                        </a>
                      </td>
                      <td className="px-4 py-3 font-medium">{order.party?.name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{order.phone || order.party?.phone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(order.order_date)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            activeReport === "delayed"
                              ? "text-red-600 font-semibold"
                              : activeReport === "today_delivery"
                              ? "text-orange-600 font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {formatDate(order.delivery_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{order.order_items?.length || 0}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-xs font-medium px-2 py-0.5 rounded-full" style={{
                          background: order.status === "active" ? "hsl(345,70%,28%,0.1)" : order.status === "delivered" ? "hsl(140,40%,40%,0.1)" : "hsl(0,60%,50%,0.1)",
                          color: order.status === "active" ? "hsl(345,70%,28%)" : order.status === "delivered" ? "hsl(140,40%,30%)" : "hsl(0,60%,40%)",
                        }}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
