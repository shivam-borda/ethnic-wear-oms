"use client";
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
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

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
            <div className="w-36">
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
          <InfoRow label="Measurement No." value={parseMeasurements(order.stitching_measurement_number).slip_number || order.stitching_measurement_number} />
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
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">📏</span>
                <h3 className="font-semibold text-lg" style={{ fontFamily: "Cormorant Garamond, serif", color: "hsl(var(--primary))" }}>
                  Measurement Details (માપણી વિગત)
                </h3>
                {m.slip_number && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 ml-2">
                    Slip #: {m.slip_number}
                  </span>
                )}
              </div>
              <Link
                href="/measurements"
                className="text-xs font-medium px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors flex items-center gap-1.5"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <span>🖨️</span> Open Measurement Module & Print
              </Link>
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
        <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="flex items-center gap-2">
              <span className="text-xl">📸</span>
              <h3 className="font-semibold text-lg" style={{ fontFamily: "Cormorant Garamond, serif", color: "hsl(var(--primary))" }}>
                Reference Images ({order.attachments.length})
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {order.attachments.map((att) => (
              <div
                key={att.id}
                onClick={() => setPreviewImage({ url: att.file_url, title: att.file_name || "Reference Image" })}
                className="group relative border rounded-xl overflow-hidden bg-background cursor-pointer hover:shadow-md transition-all flex flex-col"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <div className="w-full h-36 bg-black/5 relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={att.file_url}
                    alt={att.file_name || "Attachment"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                    🔍 Click to Zoom
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
