"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DashboardStats, MonthlyData, StatusData, Order } from "@/types";
import { formatDate, getDeliveryLabel } from "@/lib/utils";

interface Props {
  stats: DashboardStats;
  monthlyData: MonthlyData[];
  statusData: StatusData[];
  recentOrders: Order[];
}

function StatCard({
  title,
  value,
  icon,
  color,
  sub,
  filterParam,
}: {
  filterParam?: string;
  title: string;
  value: number;
  icon: string;
  color: string;
  sub?: string;
}) {
  return (
    <Link
      href={`/orders?filter=${filterParam}`}
      prefetch={true}
      className="stat-card cursor-pointer group hover:scale-[1.02] hover:shadow-md transition-all duration-200 block"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          <p
            className="text-3xl font-bold mt-1"
            style={{
              fontFamily: "Cormorant Garamond, serif",
              color,
            }}
          >
            {value}
          </p>
          {sub && (
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background: `${color}18` }}
        >
          {icon}
        </div>
      </div>
    </Link>
  );
}

const statCards = [
  {
    key: "todayOrders" as keyof DashboardStats,
    title: "Today's Orders",
    icon: "📋",
    color: "hsl(345,70%,28%)",
    sub: "New orders today",
    filterParam: "todayOrders",
  },
  {
    key: "todayDeliveries" as keyof DashboardStats,
    title: "Today's Deliveries",
    icon: "🚚",
    color: "hsl(25,80%,35%)",
    sub: "Due for delivery",
    filterParam: "todayDeliveries",
  },
  {
    key: "nextDayDeliveries" as keyof DashboardStats,
    title: "Tomorrow's Deliveries",
    icon: "📅",
    color: "hsl(40,85%,40%)",
    sub: "Prepare today",
    filterParam: "tomorrowDeliveries",
  },
  {
    key: "next7DaysDeliveries" as keyof DashboardStats,
    title: "Next 7 Days",
    icon: "🗓️",
    color: "hsl(200,60%,40%)",
    sub: "Upcoming deliveries",
    filterParam: "next7Days",
  },
  {
    key: "pendingStitching" as keyof DashboardStats,
    title: "Pending Stitching",
    icon: "🧵",
    color: "hsl(280,50%,40%)",
    sub: "Items in stitching",
    filterParam: "pendingStitching",
  },
  {
    key: "pendingWork" as keyof DashboardStats,
    title: "Pending Work",
    icon: "✂️",
    color: "hsl(15,60%,40%)",
    sub: "Items in work stage",
    filterParam: "pendingWork",
  },
  {
    key: "totalActiveOrders" as keyof DashboardStats,
    title: "Active Orders",
    icon: "⚡",
    color: "hsl(140,50%,30%)",
    sub: "In progress",
    filterParam: "active",
  },
  {
    key: "deliveredThisMonth" as keyof DashboardStats,
    title: "Delivered (Month)",
    icon: "✅",
    color: "hsl(220,60%,40%)",
    sub: "Completed",
    filterParam: "delivered",
  },
];

function getStatusColor(status: string) {
  if (status === "active")
    return { bg: "hsl(345,70%,28%,0.1)", text: "hsl(345,70%,28%)" };
  if (status === "delivered")
    return { bg: "hsl(140,40%,40%,0.1)", text: "hsl(140,40%,30%)" };
  return { bg: "hsl(0,60%,50%,0.1)", text: "hsl(0,60%,40%)" };
}

export default function DashboardClient({
  stats,
  monthlyData,
  statusData,
  recentOrders,
}: Props) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold text-foreground flex items-center gap-2"
          style={{ fontFamily: "Cormorant Garamond, serif" }}
        >
          <span>✨</span> Dashboard Overview
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Real-time snapshot of orders, deliveries, and production status
        </p>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard
            key={card.key}
            title={card.title}
            value={stats[card.key]}
            icon={card.icon}
            color={card.color}
            sub={card.sub}
            filterParam={card.filterParam}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Bar Chart */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm">
          <h2
            className="text-lg font-semibold mb-4"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Monthly Orders & Deliveries
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barCategoryGap="30%">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(35,25%,88%)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "hsl(20,10%,45%)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "hsl(20,10%,45%)" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid hsl(35,25%,85%)",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="orders" name="Orders" fill="hsl(345,70%,28%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="deliveries" name="Deliveries" fill="hsl(40,85%,52%)" radius={[4, 4, 0, 0]} />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2
            className="text-lg font-semibold mb-4"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Order Status
          </h2>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(35,25%,85%)",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              No order data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: "Cormorant Garamond, serif" }}
          >
            Recent Orders
          </h2>
          <Link
            href="/orders"
            className="text-xs font-medium hover:underline"
            style={{ color: "hsl(var(--primary))" }}
          >
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                style={{ background: "hsl(var(--muted))" }}
              >
                <th className="px-4 py-3 text-left">Order No</th>
                <th className="px-4 py-3 text-left">Party</th>
                <th className="px-4 py-3 text-left">Order Date</th>
                <th className="px-4 py-3 text-left">Delivery</th>
                <th className="px-4 py-3 text-left">Items</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No orders yet. <Link href="/orders/new" className="underline" style={{ color: "hsl(var(--primary))" }}>Create your first order</Link>
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => {
                  const sc = getStatusColor(order.status);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className="data-table-row border-b last:border-0 cursor-pointer hover:bg-muted/60 transition-colors"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      <td className="px-4 py-3">
                        <span
                          className="font-bold hover:underline"
                          style={{ color: "hsl(var(--primary))" }}
                        >
                          {order.order_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {order.party?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(order.order_date)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            order.delivery_date &&
                            order.delivery_date ===
                              new Date().toISOString().split("T")[0]
                              ? "text-orange-600 font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {order.delivery_date
                            ? getDeliveryLabel(order.delivery_date)
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {order.order_items?.length || 0} item
                        {(order.order_items?.length || 0) !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
                          style={{
                            background: `${sc.bg}`,
                            color: sc.text,
                          }}
                        >
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
