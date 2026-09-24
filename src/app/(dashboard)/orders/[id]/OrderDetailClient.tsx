"use client";

import ImageLightbox from "@/components/ui/ImageLightbox";
import { PrintableJobSheet } from "@/components/PrintableJobSheet";
import { BulletPointsList } from "@/components/ui/BulletPoints";
import SearchableSelect from "@/components/ui/SearchableSelect";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderItem, Stage, StageStatus } from "@/types";
import {
  ITEM_TYPE_LABELS,
  parseMeasurements,
  getCleanSlipNumber,
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
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
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
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; title?: string }[]>([]);

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

  const handlePrint = () => {
    setIsPrintModalOpen(true);
  };

  return (
    <>
      {/* Screen Interactive Dashboard View */}
      <div className="max-w-5xl mx-auto space-y-6 print:hidden">
        {/* Header Card */}
        <div
          className="rounded-xl p-4 sm:p-6 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(345,70%,22%) 0%, hsl(25,45%,30%) 100%)" }}
        >
          <div className="absolute right-6 top-1/2 -translate-y-1/2 text-5xl opacity-10 hidden sm:block">🪡</div>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <p className="text-xs sm:text-sm mb-1" style={{ color: "hsl(40,40%,70%)" }}>Order Number</p>
              <h2 className="text-2xl sm:text-3xl font-bold" style={{ fontFamily: "Cormorant Garamond, serif", color: "hsl(40,85%,80%)" }}>
                {order.order_number}
              </h2>
              <p className="text-xs sm:text-sm mt-1" style={{ color: "hsl(40,40%,70%)" }}>
                Created {formatDate(order.created_at)} · {order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-32 sm:w-36">
                <SearchableSelect
                  options={[
                    { value: "active", label: "Active" },
                    { value: "delivered", label: "Delivered" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                  value={order.status}
                  onChange={(val) => handleStatusUpdate(val)}
                  placeholder="Status"
                  searchPlaceholder="Search status..."
                />
              </div>
              <button
                onClick={handlePrint}
                className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold hover:opacity-90 flex items-center gap-1.5 shadow-sm"
                style={{ background: "hsl(40,85%,52%)", color: "hsl(20,15%,10%)" }}
              >
                <span>🖨️</span> Print Job Sheet
              </button>
              <Link
                href={`/orders/${order.id}/edit`}
                className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium hover:opacity-90"
                style={{ background: "hsl(345,50%,30%)", color: "hsl(40,60%,90%)" }}
              >
                ✏️ Edit
              </Link>
              <button
                onClick={handleDelete}
                disabled={deletingOrder}
                className="px-3 py-2 rounded-lg text-xs sm:text-sm font-medium hover:opacity-90 disabled:opacity-60"
                style={{ background: "hsl(0,50%,35%)", color: "hsl(0,0%,95%)" }}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>

        {/* Order Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-base" style={{ fontFamily: "Cormorant Garamond, serif", color: "hsl(var(--primary))" }}>
              👤 Customer Details
            </h3>
            <InfoRow label="Party Name" value={order.party?.name} />
            <InfoRow label="Phone" value={order.phone || order.party?.phone} />
            <InfoRow label="Address" value={order.party?.address} />
            <InfoRow label="GST Number" value={order.party?.gst_number} />
          </div>
          <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-base" style={{ fontFamily: "Cormorant Garamond, serif", color: "hsl(var(--primary))" }}>
              📋 Order Details
            </h3>
            <InfoRow label="Order Date" value={formatDate(order.order_date)} />
            <InfoRow label="Delivery Date" value={formatDate(order.delivery_date)} highlight={!!order.delivery_date} />
            <InfoRow label="Vyapar Order No." value={order.vyapar_order_number} />
            <InfoRow label="Measurement No." value={getCleanSlipNumber(order)} />
            {order.notes && (
              <div className="pt-2 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Fabric, Material & Design Points:</span>
                <BulletPointsList text={order.notes} />
              </div>
            )}
          </div>
        </div>

        {/* Measurement Section if exists */}
        {order.stitching_measurement_number && (() => {
          const m = parseMeasurements(order.stitching_measurement_number);
          const hasUpper = m.kurta_length || m.chest || m.waist || m.shoulder || m.sleeve_length || m.collar_neck;
          const hasLower = m.pant_length || m.pant_waist || m.pant_hips || m.thigh || m.bottom_mori;

          return (
            <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-4" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "hsl(var(--border))" }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">📏</span>
                  <h3 className="font-semibold text-base sm:text-lg" style={{ fontFamily: "Cormorant Garamond, serif", color: "hsl(var(--primary))" }}>
                    Measurement Details (માપણી વિગત)
                  </h3>
                  {m.slip_number && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                      Slip #: {m.slip_number}
                    </span>
                  )}
                </div>
                <button
                  onClick={handlePrint}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors flex items-center gap-1.5 self-start sm:self-auto"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <span>🖨️</span> Open & Print Tailor Job Sheet
                </button>
              </div>

              {hasUpper && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-primary uppercase tracking-wide">👔 Upper Body Garment</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {m.kurta_length && <div className="bg-muted/50 p-2 rounded border">Length (લંબાઈ): <span className="font-bold">{m.kurta_length}</span></div>}
                    {m.chest && <div className="bg-muted/50 p-2 rounded border">Chest (છાતી): <span className="font-bold">{m.chest}</span></div>}
                    {m.waist && <div className="bg-muted/50 p-2 rounded border">Waist (કમર): <span className="font-bold">{m.waist}</span></div>}
                    {m.hips && <div className="bg-muted/50 p-2 rounded border">Seat/Hips (સીટ): <span className="font-bold">{m.hips}</span></div>}
                    {m.shoulder && <div className="bg-muted/50 p-2 rounded border">Shoulder (શોલ્ડર): <span className="font-bold">{m.shoulder}</span></div>}
                    {m.sleeve_length && <div className="bg-muted/50 p-2 rounded border">Sleeve (બાઈ): <span className="font-bold">{m.sleeve_length}</span></div>}
                    {m.sleeve_opening && <div className="bg-muted/50 p-2 rounded border">Sleeve Mori (બાઈ મોરી): <span className="font-bold">{m.sleeve_opening}</span></div>}
                    {m.collar_neck && <div className="bg-muted/50 p-2 rounded border">Collar (કોલર): <span className="font-bold">{m.collar_neck}</span></div>}
                    {m.biceps && <div className="bg-muted/50 p-2 rounded border">Biceps (મુંઢો): <span className="font-bold">{m.biceps}</span></div>}
                  </div>
                </div>
              )}

              {hasLower && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-bold text-primary uppercase tracking-wide">👖 Lower Body Garment</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {m.pant_length && <div className="bg-muted/50 p-2 rounded border">Pant Length (લંબાઈ): <span className="font-bold">{m.pant_length}</span></div>}
                    {m.pant_waist && <div className="bg-muted/50 p-2 rounded border">Pant Waist (કમર): <span className="font-bold">{m.pant_waist}</span></div>}
                    {m.pant_hips && <div className="bg-muted/50 p-2 rounded border">Seat/Hips (સીટ): <span className="font-bold">{m.pant_hips}</span></div>}
                    {m.thigh && <div className="bg-muted/50 p-2 rounded border">Thigh (ઝાંગ): <span className="font-bold">{m.thigh}</span></div>}
                    {m.knee && <div className="bg-muted/50 p-2 rounded border">Knee (ઘૂંટણ): <span className="font-bold">{m.knee}</span></div>}
                    {m.galo && <div className="bg-muted/50 p-2 rounded border">Galo (ગાળો): <span className="font-bold">{m.galo}</span></div>}
                    {m.bottom_mori && <div className="bg-muted/50 p-2 rounded border">Mori (મોરી): <span className="font-bold">{m.bottom_mori}</span></div>}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Reference Images & Attachments Gallery */}
        {order.attachments && order.attachments.length > 0 && (
          <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-3" style={{ borderColor: "hsl(var(--border))" }}>
            <h3 className="font-semibold text-base flex items-center justify-between" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              <span>📸 Reference Images & Attachments ({order.attachments.length})</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {order.attachments.map((att, idx) => (
                <div
                  key={att.id || idx}
                  className="rounded-lg border bg-muted/30 overflow-hidden cursor-pointer group hover:shadow-md transition-all"
                  style={{ borderColor: "hsl(var(--border))" }}
                  onClick={() => {
                    setLightboxImages((order.attachments || []).map((a) => ({ url: a.file_url, title: a.file_name || "Reference Image" })));
                    setLightboxIndex(idx);
                  }}
                >
                  <div className="h-28 bg-gray-100 dark:bg-zinc-900 flex items-center justify-center relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={att.file_url} alt={att.file_name || "Ref"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                      🔍 Full Screen
                    </div>
                  </div>
                  <div className="p-2 bg-card border-t text-center" style={{ borderColor: "hsl(var(--border))" }}>
                    <p className="text-xs font-semibold truncate text-foreground">{att.file_name || "Reference Image"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Items & Production Progress */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "Cormorant Garamond, serif" }}>
            👗 Items & Production Progress
          </h3>
          {(order.order_items || []).map((item, idx) => (
            <div key={item.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              {/* Item Header */}
              <div className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted))" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: "hsl(var(--primary))" }}>
                  {idx + 1}
                </div>
                <div>
                  <span className="font-semibold text-sm sm:text-base">{ITEM_TYPE_LABELS[item.item_type]}</span>
                  <span className="text-muted-foreground text-xs sm:text-sm ml-2">Qty: {item.quantity}</span>
                </div>
                {item.fabric_party && (
                  <span className="ml-auto text-xs text-muted-foreground truncate">🧵 {item.fabric_party.name}</span>
                )}
              </div>

              <div className="p-4 sm:p-5 space-y-5">
                {/* Fabric Image + Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {item.fabric_image_url && (
                    <div className="md:col-span-1 cursor-pointer group relative rounded-lg overflow-hidden border" style={{ borderColor: "hsl(var(--border))" }} onClick={() => {
                      setLightboxImages([{ url: item.fabric_image_url!, title: `${ITEM_TYPE_LABELS[item.item_type]} Fabric Image` }]);
                      setLightboxIndex(0);
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.fabric_image_url}
                        alt="Fabric"
                        className="w-full h-32 object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                        🔍 Full Screen
                      </div>
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

      {/* Interactive Print Job Sheet Modal for Mobile & Screen View */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto print:static print:p-0 print:bg-white">
          <div className="bg-card rounded-2xl shadow-2xl max-w-3xl w-full p-3 sm:p-5 flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto relative print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none print:bg-white">
            <div className="flex items-center justify-between border-b pb-3 mb-2 flex-shrink-0 print:hidden" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="text-lg sm:text-xl">📐</span>
                <h2 className="text-xs sm:text-lg font-bold text-foreground truncate" style={{ fontFamily: "Cormorant Garamond, serif" }}>
                  Tailor Job Sheet
                </h2>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white flex items-center gap-1 hover:opacity-90 transition-opacity shadow-sm"
                  style={{ background: "hsl(var(--primary))" }}
                >
                  <span>🖨️</span> Print
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-2.5 py-1.5 rounded-lg border text-xs sm:text-sm hover:bg-muted font-bold text-muted-foreground transition-colors"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-0.5 print:overflow-visible">
              <PrintableJobSheet order={order} />
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Printable Tailor Job Sheet */}
      <div className="hidden print:block">
        <PrintableJobSheet order={order} />
      </div>

      {/* Full Screen Image Lightbox */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(idx) => setLightboxIndex(idx)}
        />
      )}
    </>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground w-28 sm:w-32 flex-shrink-0 pt-0.5">{label}</span>
      <span className={cn("text-xs sm:text-sm font-medium", highlight && "text-orange-600")}>{value}</span>
    </div>
  );
}
