"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderItem, Stage, StageStatus } from "@/types";
import {
  ITEM_TYPE_LABELS,
  STAGE_LABELS,
  STATUS_LABELS,
} from "@/types";
import { formatDate, formatDateTime, cn } from "@/lib/utils";

interface Props {
  order: Order;
}

const STAGES: Stage[] = ["fabric", "work", "stitching", "delivery"];

function getStageStatus(item: OrderItem, stage: Stage): StageStatus {
  const p = item.item_progress;
  if (!p) return "pending";
  return p[`${stage}_status` as keyof typeof p] as StageStatus;
}

function StatusBadge({ status }: { status: StageStatus }) {
  const classes = {
    pending: "stage-badge-pending",
    in_progress: "stage-badge-in_progress",
    completed: "stage-badge-completed",
  };
  const icons = { pending: "○", in_progress: "◐", completed: "●" };
  return (
    <span className={classes[status]}>
      {icons[status]} {STATUS_LABELS[status]}
    </span>
  );
}

function ProductionProgress({ item }: { item: OrderItem }) {
  const stages = STAGES;
  return (
    <div className="flex items-center gap-1">
      {stages.map((stage, i) => {
        const status = getStageStatus(item, stage);
        return (
          <div key={stage} className="flex items-center gap-1">
            <div className="flex flex-col items-center">
              <div className={cn("progress-step-circle", status)}>
                {status === "completed" ? "✓" : i + 1}
              </div>
              <span className="text-xs text-muted-foreground mt-1 whitespace-nowrap">{STAGE_LABELS[stage]}</span>
            </div>
            {i < stages.length - 1 && (
              <div className={cn("progress-connector mb-4", status === "completed" ? "completed" : "")} style={{ width: "2rem" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetailClient({ order: initialOrder }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState<Order>(initialOrder);
  const [updatingStage, setUpdatingStage] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);

  const handleStageUpdate = async (
    item: OrderItem,
    stage: Stage,
    newStatus: StageStatus
  ) => {
    const key = `${stage}_status`;
    const startedKey = `${stage}_started_at`;
    const completedKey = `${stage}_completed_at`;
    const stageKey = `${item.id}-${stage}`;
    setUpdatingStage(stageKey);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const oldStatus = getStageStatus(item, stage);

      const updateData: Record<string, string | null> = {
        [key]: newStatus,
        updated_by: user?.id || null,
      };
      if (newStatus === "in_progress" && !item.item_progress?.[startedKey as keyof typeof item.item_progress]) {
        updateData[startedKey] = now;
      }
      if (newStatus === "completed") {
        updateData[completedKey] = now;
      }

      const { error } = await supabase
        .from("item_progress")
        .update(updateData)
        .eq("item_id", item.id);

      if (error) throw error;

      // Log history
      await supabase.from("item_progress_history").insert([{
        item_id: item.id,
        stage,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: user?.id || null,
      }]);

      toast.success(`${STAGE_LABELS[stage]} stage updated to ${STATUS_LABELS[newStatus]}`);

      // Update local state
      setOrder((prev) => ({
        ...prev,
        order_items: prev.order_items?.map((oi) =>
          oi.id === item.id
            ? {
                ...oi,
                item_progress: {
                  ...oi.item_progress!,
                  [key]: newStatus,
                  ...(newStatus === "in_progress" && !oi.item_progress?.[startedKey as keyof typeof oi.item_progress]
                    ? { [startedKey]: now }
                    : {}),
                  ...(newStatus === "completed" ? { [completedKey]: now } : {}),
                },
              }
            : oi
        ),
      }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdatingStage(null);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("oms_orders")
      .update({ status: newStatus })
      .eq("id", order.id);
    if (error) { toast.error("Failed to update status"); return; }
    setOrder((prev) => ({ ...prev, status: newStatus as typeof prev.status }));
    toast.success(`Order marked as ${newStatus}`);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete order ${order.order_number}? This will permanently delete all items and progress data.`)) return;
    setDeletingOrder(true);
    const supabase = createClient();
    const { error } = await supabase.from("oms_orders").delete().eq("id", order.id);
    if (error) { toast.error("Failed to delete order"); setDeletingOrder(false); return; }
    toast.success("Order deleted");
    router.push("/orders");
  };

  const handlePrint = () => window.print();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Card */}
      <div
        className="rounded-xl p-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(345,70%,22%) 0%, hsl(25,45%,30%) 100%)" }}
      >
        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-5xl opacity-10">🪡</div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm mb-1" style={{ color: "hsl(40,40%,70%)" }}>Order Number</p>
            <h2 className="text-3xl font-bold" style={{ fontFamily: "Cormorant Garamond, serif", color: "hsl(40,85%,80%)" }}>
              {order.order_number}
            </h2>
            <p className="text-sm mt-1" style={{ color: "hsl(40,40%,70%)" }}>
              Created {formatDate(order.created_at)} · {order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={order.status}
              onChange={(e) => handleStatusUpdate(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm font-medium border-0 outline-none cursor-pointer"
              style={{ background: "hsl(345,50%,35%)", color: "hsl(40,60%,90%)" }}
            >
              <option value="active">Active</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={handlePrint} className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80" style={{ background: "hsl(40,85%,52%)", color: "hsl(20,15%,10%)" }}>
              🖨️ Print
            </button>
            <Link href={`/orders/${order.id}/edit`} className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80" style={{ background: "hsl(345,50%,30%)", color: "hsl(40,60%,90%)" }}>
              ✏️ Edit
            </Link>
            <button onClick={handleDelete} disabled={deletingOrder} className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-80 disabled:opacity-60" style={{ background: "hsl(0,50%,35%)", color: "hsl(0,0%,95%)" }}>
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <h3 className="font-semibold text-base" style={{ fontFamily: "Cormorant Garamond, serif", color: "hsl(var(--primary))" }}>
            👤 Customer Details
          </h3>
          <InfoRow label="Party Name" value={order.party?.name} />
          <InfoRow label="Phone" value={order.phone || order.party?.phone} />
          <InfoRow label="Address" value={order.party?.address} />
          <InfoRow label="GST Number" value={order.party?.gst_number} />
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
          <h3 className="font-semibold text-base" style={{ fontFamily: "Cormorant Garamond, serif", color: "hsl(var(--primary))" }}>
            📋 Order Details
          </h3>
          <InfoRow label="Order Date" value={formatDate(order.order_date)} />
          <InfoRow label="Delivery Date" value={formatDate(order.delivery_date)} highlight={!!order.delivery_date} />
          <InfoRow label="Vyapar Order No." value={order.vyapar_order_number} />
          <InfoRow label="Measurement No." value={order.stitching_measurement_number} />
          {order.notes && <InfoRow label="Notes" value={order.notes} />}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold" style={{ fontFamily: "Cormorant Garamond, serif" }}>
          👗 Items & Production Progress
        </h3>
        {(order.order_items || []).map((item, idx) => (
          <div key={item.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            {/* Item Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted))" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "hsl(var(--primary))" }}>
                {idx + 1}
              </div>
              <div>
                <span className="font-semibold">{ITEM_TYPE_LABELS[item.item_type]}</span>
                <span className="text-muted-foreground text-sm ml-2">Qty: {item.quantity}</span>
              </div>
              {item.fabric_party && (
                <span className="ml-auto text-xs text-muted-foreground">🧵 {item.fabric_party.name}</span>
              )}
            </div>

            <div className="p-5 space-y-5">
              {/* Fabric Image + Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {item.fabric_image_url && (
                  <div className="md:col-span-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.fabric_image_url}
                      alt="Fabric"
                      className="w-full h-32 object-cover rounded-lg border"
                      style={{ borderColor: "hsl(var(--border))" }}
                    />
                  </div>
                )}
                <div className={item.fabric_image_url ? "md:col-span-2" : "md:col-span-3"}>
                  {item.fabric_details && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fabric Details</span>
                      <p className="text-sm mt-0.5">{item.fabric_details}</p>
                    </div>
                  )}
                  {item.special_instructions && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Special Instructions</span>
                      <p className="text-sm mt-0.5">{item.special_instructions}</p>
                    </div>
                  )}
                  {item.notes && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</span>
                      <p className="text-sm mt-0.5">{item.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Production Progress */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Production Progress</p>
                <ProductionProgress item={item} />
              </div>

              {/* Stage Controls */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {STAGES.map((stage) => {
                  const currentStatus = getStageStatus(item, stage);
                  const nextStatus: StageStatus =
                    currentStatus === "pending"
                      ? "in_progress"
                      : currentStatus === "in_progress"
                      ? "completed"
                      : "pending";
                  const isLoading = updatingStage === `${item.id}-${stage}`;
                  return (
                    <div key={stage} className="rounded-lg border p-3 space-y-2" style={{ borderColor: "hsl(var(--border))" }}>
                      <div className="text-xs font-medium text-muted-foreground uppercase">{STAGE_LABELS[stage]}</div>
                      <StatusBadge status={currentStatus} />
                      <button
                        id={`stage-${item.id}-${stage}-btn`}
                        onClick={() => handleStageUpdate(item, stage, nextStatus)}
                        disabled={isLoading}
                        className="w-full text-xs py-1.5 rounded border font-medium hover:bg-muted transition-colors disabled:opacity-50"
                        style={{ borderColor: "hsl(var(--border))" }}
                      >
                        {isLoading ? "..." : `→ ${STATUS_LABELS[nextStatus]}`}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Timeline */}
              {item.progress_history && item.progress_history.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">History</p>
                  <div className="space-y-0">
                    {[...item.progress_history]
                      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
                      .slice(0, 5)
                      .map((h) => (
                        <div key={h.id} className="timeline-item text-xs">
                          <div className="timeline-dot" />
                          <span className="font-medium">{STAGE_LABELS[h.stage]}</span>{" "}
                          <span className="text-muted-foreground">
                            {h.old_status && `${STATUS_LABELS[h.old_status as StageStatus]} → `}
                          </span>
                          <span style={{ color: "hsl(var(--primary))" }}>{STATUS_LABELS[h.new_status as StageStatus]}</span>
                          {h.profile && <span className="text-muted-foreground"> · by {h.profile.full_name}</span>}
                          <span className="text-muted-foreground"> · {formatDateTime(h.changed_at)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className={cn("text-sm font-medium", highlight && "text-orange-600")}>{value}</span>
    </div>
  );
}
