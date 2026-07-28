import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";
import type { Order, DashboardStats, MonthlyData } from "@/types";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from "date-fns";

async function getDashboardData() {
  const supabase = await createClient();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = format(tomorrow, "yyyy-MM-dd");
  const next7 = new Date(today);
  next7.setDate(next7.getDate() + 7);
  const next7Str = format(next7, "yyyy-MM-dd");

  const { data: orders } = await supabase
    .from("oms_orders")
    .select(`*, party:parties(name, phone), order_items(*, item_progress(*))`)
    .order("created_at", { ascending: false });

  const allOrders: Order[] = (orders || []) as Order[];

  const stats: DashboardStats = {
    todayOrders: allOrders.filter((o) => o.order_date === todayStr).length,
    todayDeliveries: allOrders.filter((o) => o.delivery_date === todayStr).length,
    nextDayDeliveries: allOrders.filter((o) => o.delivery_date === tomorrowStr).length,
    next7DaysDeliveries: allOrders.filter(
      (o) =>
        o.delivery_date &&
        o.delivery_date >= todayStr &&
        o.delivery_date <= next7Str
    ).length,
    pendingStitching: allOrders.reduce((acc, o) => {
      const items = o.order_items || [];
      return (
        acc +
        items.filter(
          (i) =>
            i.item_progress?.stitching_status === "pending" ||
            i.item_progress?.stitching_status === "in_progress"
        ).length
      );
    }, 0),
    pendingWork: allOrders.reduce((acc, o) => {
      const items = o.order_items || [];
      return (
        acc +
        items.filter(
          (i) =>
            i.item_progress?.work_status === "pending" ||
            i.item_progress?.work_status === "in_progress"
        ).length
      );
    }, 0),
    totalActiveOrders: allOrders.filter((o) => o.status === "active").length,
    totalDeliveredOrders: allOrders.filter((o) => o.status === "delivered").length,
  };

  // Monthly data for past 6 months
  const monthlyData: MonthlyData[] = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(today, 5 - i);
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return {
      month: format(month, "MMM"),
      orders: allOrders.filter((o) => {
        try {
          const d = parseISO(o.order_date);
          return isWithinInterval(d, { start, end });
        } catch { return false; }
      }).length,
      deliveries: allOrders.filter((o) => {
        if (!o.delivery_date) return false;
        try {
          const d = parseISO(o.delivery_date);
          return isWithinInterval(d, { start, end });
        } catch { return false; }
      }).length,
    };
  });

  const statusData = [
    {
      name: "Active",
      value: allOrders.filter((o) => o.status === "active").length,
      color: "hsl(345,70%,28%)",
    },
    {
      name: "Delivered",
      value: allOrders.filter((o) => o.status === "delivered").length,
      color: "hsl(140,40%,40%)",
    },
    {
      name: "Cancelled",
      value: allOrders.filter((o) => o.status === "cancelled").length,
      color: "hsl(0,60%,50%)",
    },
  ].filter((d) => d.value > 0);

  const recentOrders = allOrders.slice(0, 10);

  return { stats, monthlyData, statusData, recentOrders };
}

export default async function DashboardPage() {
  const { stats, monthlyData, statusData, recentOrders } =
    await getDashboardData();

  return (
    <DashboardClient
      stats={stats}
      monthlyData={monthlyData}
      statusData={statusData}
      recentOrders={recentOrders}
    />
  );
}
