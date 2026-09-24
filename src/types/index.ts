// Core Types for Ethnic Wear OMS

export type UserRole = 'admin' | 'staff';

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Party {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  gst_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FabricParty {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ItemType = 'kurta' | 'koti' | 'kurta_koti' | 'pant' | 'blazer' | 'jacket' | 'indo_western' | 'jodhpuri';
export type StageStatus = 'pending' | 'in_progress' | 'completed';
export type OrderStatus = 'active' | 'delivered' | 'cancelled';
export type Stage = 'fabric' | 'work' | 'stitching' | 'delivery';

export interface ItemProgress {
  id: string;
  item_id: string;
  fabric_status: StageStatus;
  fabric_started_at: string | null;
  fabric_completed_at: string | null;
  work_status: StageStatus;
  work_started_at: string | null;
  work_completed_at: string | null;
  stitching_status: StageStatus;
  stitching_started_at: string | null;
  stitching_completed_at: string | null;
  delivery_status: StageStatus;
  delivery_started_at: string | null;
  delivery_completed_at: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface ItemProgressHistory {
  id: string;
  item_id: string;
  stage: Stage;
  old_status: StageStatus | null;
  new_status: StageStatus;
  changed_by: string | null;
  changed_at: string;
  profile?: Profile;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_type: ItemType;
  fabric_party_id: string | null;
  fabric_details: string | null;
  fabric_image_url: string | null;
  quantity: number;
  special_instructions: string | null;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  item_progress?: ItemProgress;
  fabric_party?: FabricParty;
  progress_history?: ItemProgressHistory[];
}

export interface Order {
  id: string;
  order_number: string;
  party_id: string | null;
  phone: string | null;
  order_date: string;
  delivery_date: string | null;
  vyapar_order_number: string | null;
  stitching_measurement_number: string | null;
  notes: string | null;
  status: OrderStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  party?: Party;
  order_items?: OrderItem[];
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  order_id: string;
  item_id: string | null;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

// Form Types
export interface OrderItemFormData {
  item_type: ItemType;
  fabric_party_id: string;
  fabric_details: string;
  fabric_image_url: string;
  quantity: number;
  special_instructions: string;
  notes: string;
}

export interface OrderFormData {
  party_id: string;
  party_name_new?: string;
  phone: string;
  order_date: string;
  delivery_date: string;
  vyapar_order_number: string;
  stitching_measurement_number: string;
  notes: string;
  items: OrderItemFormData[];
}

// Dashboard Types
export interface DashboardStats {
  todayOrders: number;
  todayDeliveries: number;
  nextDayDeliveries: number;
  next7DaysDeliveries: number;
  pendingStitching: number;
  pendingWork: number;
  totalActiveOrders: number;
  totalDeliveredOrders: number;
}

export interface MonthlyData {
  month: string;
  orders: number;
  deliveries: number;
}

export interface StatusData {
  name: string;
  value: number;
  color: string;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  kurta: 'Kurta',
  koti: 'Koti',
  kurta_koti: 'Kurta + Koti',
  pant: 'Pant',
  blazer: 'Blazer',
  jacket: 'Jacket',
  indo_western: 'Indo Western',
  jodhpuri: 'Jodhpuri',
};

export const STAGE_LABELS: Record<Stage, string> = {
  fabric: 'Fabric',
  work: 'Work',
  stitching: 'Stitching',
  delivery: 'Delivery',
};

export const STATUS_LABELS: Record<StageStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};


export interface GarmentMeasurements {
  slip_number?: string;
  kurta_length?: string;
  chest?: string;
  waist?: string;
  hips?: string;
  shoulder?: string;
  sleeve_length?: string;
  sleeve_opening?: string;
  collar_neck?: string;
  biceps?: string;
  front_cross?: string;
  pant_length?: string;
  pant_waist?: string;
  pant_hips?: string;
  thigh?: string;
  knee?: string;
  galo?: string;
  bottom_mori?: string;
  notes?: string;
}

export function parseMeasurements(raw?: string | null): GarmentMeasurements {
  if (!raw) return {};
  try {
    if (raw.trim().startsWith('{')) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.slip_number && parsed.slip_number.trim().startsWith('{')) {
          parsed.slip_number = '';
        }
        return parsed;
      }
    }
  } catch {}
  return { slip_number: raw && !raw.trim().startsWith('{') ? raw : '' };
}

export function getCleanSlipNumber(order?: { stitching_measurement_number?: string | null; order_number?: string } | null): string {
  if (!order) return 'N/A';
  const m = parseMeasurements(order.stitching_measurement_number);
  const slip = m.slip_number?.trim();
  if (slip && !slip.startsWith('{')) {
    return slip;
  }
  return order.order_number ? `SLIP-${order.order_number}` : 'N/A';
}

export interface OrderAttachmentFormData {
  id?: string;
  file_url: string;
  file_name: string;
  file_type?: string;
  category?: 'reference' | 'fabric' | 'color' | 'material';
}
