"use client";
import { downloadJobSheetAsPDF } from "@/lib/downloadPdf";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { PrintableJobSheet } from "@/components/PrintableJobSheet";
import { BulletPointsList } from "@/components/ui/BulletPoints";
import SearchableSelect from "@/components/ui/SearchableSelect";
import OrderActivityLogSection from "@/components/OrderActivityLogSection";
import { extractOrderLogs, encodeMeasurementsWithLogs, recordOrderDeletion, type OrderActivityLog } from "@/lib/orderLogs";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Order, OrderItem, Stage, StageStatus } from "@/types";
import { getAttachmentCategory } from "@/types";
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
  additionalLogs?: OrderActivityLog[];
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

export default function OrderDetailClient({ order: initialOrder, additionalLogs = [] }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState<Order>(initialOrder);

  const fabricAttachments = (order.attachments || []).filter((a) => {
    const c = getAttachmentCategory(a);
    return c === "fabric" || c === "color" || c === "material";
  });
  const referenceAttachments = (order.attachments || []).filter((a) => {
    const c = getAttachmentCategory(a);
    return c === "reference";
  });
  const [updatingStage, setUpdatingStage] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);
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

      try {
        const existingLogs = extractOrderLogs(order.stitching_measurement_number);
        const stageLog: OrderActivityLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          order_id: order.id,
          action: "stage_change",
          title: `${ITEM_TYPE_LABELS[item.item_type]} - ${STAGE_LABELS[stage]}: ${STATUS_LABELS[newStatus]}`,
          title_gu: `${STAGE_LABELS[stage]} સ્ટેજ: ${STATUS_LABELS[newStatus]}`,
          description: `Stage updated from ${STATUS_LABELS[oldStatus]} to ${STATUS_LABELS[newStatus]}`,
          changes: [{
            field: `${ITEM_TYPE_LABELS[item.item_type]} ${STAGE_LABELS[stage]} Stage`,
            label_gu: `${STAGE_LABELS[stage]} સ્ટેજ`,
            old_value: STATUS_LABELS[oldStatus],
            new_value: STATUS_LABELS[newStatus],
          }],
          created_at: now,
          user_name: user?.user_metadata?.full_name || user?.email || "Staff",
        };
        const updatedLogs = [stageLog, ...existingLogs];
        const measurements = parseMeasurements(order.stitching_measurement_number);
        const encoded = encodeMeasurementsWithLogs(measurements, updatedLogs);
        await supabase.from("oms_orders").update({ stitching_measurement_number: encoded }).eq("id", order.id);
        setOrder((prev) => ({ ...prev, stitching_measurement_number: encoded }));
      } catch {}

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
    if (!newStatus || newStatus === order.status) return;
    setUpdatingOrderStatus(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const oldStatus = order.status;
      const userName = user?.user_metadata?.full_name || user?.email || "Staff";

      const existingLogs = extractOrderLogs(order.stitching_measurement_number);
      const nowIso = new Date().toISOString();
      const statusLog: OrderActivityLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        order_id: order.id,
        action: "status_change",
        title: `Status Changed to ${newStatus.toUpperCase()}`,
        title_gu: `ઓર્ડર સ્ટેટસ ${newStatus.toUpperCase()} કર્યું`,
        description: `Order status changed from ${oldStatus.toUpperCase()} to ${newStatus.toUpperCase()}`,
        changes: [{
          field: "Order Status",
          label_gu: "ઓર્ડર સ્ટેટસ",
          old_value: oldStatus.toUpperCase(),
          new_value: newStatus.toUpperCase(),
        }],
        created_at: nowIso,
        user_name: userName,
      };

      const updatedLogs = [statusLog, ...existingLogs];
      const measurements = parseMeasurements(order.stitching_measurement_number);
      const encoded = encodeMeasurementsWithLogs(measurements, updatedLogs);

      const { error } = await supabase
        .from("oms_orders")
        .update({
          status: newStatus,
          stitching_measurement_number: encoded,
        })
        .eq("id", order.id);

      if (error) {
        toast.error(`Failed to update status: ${error.message}`);
        return;
      }

      try {
        await supabase.from("order_activity_logs").insert([{
          order_id: order.id,
          action: "status_change",
          description: statusLog.description,
          field_changes: statusLog.changes,
          performed_by: user?.id || null,
          performed_by_name: userName,
        }]);
      } catch {}

      setOrder((prev) => ({
        ...prev,
        status: newStatus as typeof prev.status,
        stitching_measurement_number: encoded,
      }));
      toast.success(`Order status updated to ${newStatus.toUpperCase()}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingOrderStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete order ${order.order_number}? This will permanently delete all items and progress data.`)) return;
    setDeletingOrder(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    recordOrderDeletion(order, user?.user_metadata?.full_name || user?.email || "Staff");

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
              <div className="relative">
                <select
                  id="order-status-select"
                  disabled={updatingOrderStatus}
                  value={order.status}
                  onChange={(e) => handleStatusUpdate(e.target.value)}
                  className={cn(
                    "appearance-none px-3.5 py-2 pr-8 rounded-lg text-xs sm:text-sm font-bold shadow-sm outline-none cursor-pointer border transition-colors disabled:opacity-50",
                    order.status === "active" && "bg-amber-500 text-black border-amber-400 font-extrabold",
                    order.status === "delivered" && "bg-emerald-600 text-white border-emerald-500 font-extrabold",
                    order.status === "cancelled" && "bg-rose-600 text-white border-rose-500 font-extrabold"
                  )}
                >
                  <option value="active" className="bg-card text-foreground font-semibold">● Active (ચાલુ)</option>
                  <option value="delivered" className="bg-card text-foreground font-semibold">✓ Delivered (ડીલીવર)</option>
                  <option value="cancelled" className="bg-card text-foreground font-semibold">✕ Cancelled (કેન્સલ)</option>
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-current text-xs font-bold">
                  ▼
                </div>
              </div>
              <button
                onClick={() => downloadJobSheetAsPDF(order, `Tailor_JobSheet_${order.order_number || order.id}`)}
                className="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm transition-all"
              >
                <span>📥</span> Download PDF
              </button>
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
          const hasUpper = m.lambai || m.bai || m.solder || m.chati || m.pet || m.sheet_upper || m.cap || m.coller || m.kurta_length || m.chest || m.shoulder || m.stomach;
          const hasLower = m.lambai_bottom || m.kamber || m.sheet || m.jang || m.moli || m.kistak || m.pant_length || m.pant_waist;

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
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => downloadJobSheetAsPDF(order, `Tailor_JobSheet_${order.order_number || order.id}`)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5"
                  >
                    <span>📥</span> Download PDF
                  </button>
                  <button
                    onClick={handlePrint}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors flex items-center gap-1.5"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    <span>🖨️</span> Print Job Sheet
                  </button>
                </div>
              </div>

              {hasUpper && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-primary uppercase tracking-wide">👔 Upper Body Garment (અપર બોડી)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-xs">
                    {m.lambai && <div className="bg-muted/50 p-2 rounded border">1) Lambai (લંબાઈ): <span className="font-bold">{m.lambai}</span></div>}
                    {m.bai && <div className="bg-muted/50 p-2 rounded border">2) Bai (બાઈ): <span className="font-bold">{m.bai}</span></div>}
                    {m.solder && <div className="bg-muted/50 p-2 rounded border">3) Solder (સોલ્ડર): <span className="font-bold">{m.solder}</span></div>}
                    {m.chati && <div className="bg-muted/50 p-2 rounded border">4) Chati (છાતી): <span className="font-bold">{m.chati}</span></div>}
                    {m.pet && <div className="bg-muted/50 p-2 rounded border">5) Pet (પેટ): <span className="font-bold">{m.pet}</span></div>}
                    {m.sheet_upper && <div className="bg-muted/50 p-2 rounded border">6) Sheet (સીટ): <span className="font-bold">{m.sheet_upper}</span></div>}
                    {m.cap && <div className="bg-muted/50 p-2 rounded border">7) Cap (કેપ): <span className="font-bold">{m.cap}</span></div>}
                    {m.coller && <div className="bg-muted/50 p-2 rounded border">8) Coller (કોલર): <span className="font-bold">{m.coller}</span></div>}
                  </div>
                </div>
              )}

              {hasLower && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-bold text-primary uppercase tracking-wide">👖 Bottom Garment (બોટમ)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                    {m.lambai_bottom && <div className="bg-muted/50 p-2 rounded border">1) Lambai (લંબાઈ): <span className="font-bold">{m.lambai_bottom}</span></div>}
                    {m.kamber && <div className="bg-muted/50 p-2 rounded border">2) Kamber (કમર): <span className="font-bold">{m.kamber}</span></div>}
                    {m.sheet && <div className="bg-muted/50 p-2 rounded border">3) Sheet (સીટ): <span className="font-bold">{m.sheet}</span></div>}
                    {m.jang && <div className="bg-muted/50 p-2 rounded border">4) Jang (ઝાંગ): <span className="font-bold">{m.jang}</span></div>}
                    {m.moli && <div className="bg-muted/50 p-2 rounded border">5) Moli (મોરી): <span className="font-bold">{m.moli}</span></div>}
                    {m.kistak && <div className="bg-muted/50 p-2 rounded border">6) Kistak (કિસ્તક): <span className="font-bold">{m.kistak}</span></div>}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Fabric, Color & Material Samples Gallery */}
        {fabricAttachments.length > 0 && (
          <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-3" style={{ borderColor: "hsl(var(--border))" }}>
            <h3 className="font-semibold text-base flex items-center justify-between" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              <span>🧵 Fabric, Color & Material Samples ({fabricAttachments.length})</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {fabricAttachments.map((att, idx) => (
                <div
                  key={att.id || idx}
                  className="rounded-lg border bg-muted/30 overflow-hidden cursor-pointer group hover:shadow-md transition-all"
                  style={{ borderColor: "hsl(var(--border))" }}
                  onClick={() => {
                    setLightboxImages(fabricAttachments.map((a) => ({ url: a.file_url, title: a.file_name || "Fabric Sample" })));
                    setLightboxIndex(idx);
                  }}
                >
                  <div className="h-28 bg-gray-100 dark:bg-zinc-900 flex items-center justify-center relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={att.file_url} alt={att.file_name || "Fabric"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                      🔍 Full Screen
                    </div>
                  </div>
                  <div className="p-2 bg-card border-t text-center" style={{ borderColor: "hsl(var(--border))" }}>
                    <p className="text-xs font-semibold truncate text-foreground">{att.file_name || "Fabric Sample"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Design & Style Reference Images Gallery */}
        {referenceAttachments.length > 0 && (
          <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-3" style={{ borderColor: "hsl(var(--border))" }}>
            <h3 className="font-semibold text-base flex items-center justify-between" style={{ fontFamily: "Cormorant Garamond, serif" }}>
              <span>📸 Design & Style Reference Images ({referenceAttachments.length})</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {referenceAttachments.map((att, idx) => (
                <div
                  key={att.id || idx}
                  className="rounded-lg border bg-muted/30 overflow-hidden cursor-pointer group hover:shadow-md transition-all"
                  style={{ borderColor: "hsl(var(--border))" }}
                  onClick={() => {
                    setLightboxImages(referenceAttachments.map((a) => ({ url: a.file_url, title: a.file_name || "Design Reference" })));
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
                    <p className="text-xs font-semibold truncate text-foreground">{att.file_name || "Design Reference"}</p>
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

        {/* Order Activity & Audit Trail (Last Section) */}
        <OrderActivityLogSection order={order} additionalLogs={additionalLogs} />
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
                  onClick={() => downloadJobSheetAsPDF(order, `Tailor_JobSheet_${order.order_number || order.id}`)}
                  className="px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 transition-opacity shadow-sm"
                >
                  <span>📥</span> Download PDF
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); try { window.print(); } catch(err) {} }} onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); try { window.print(); } catch(err) {} }}
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
