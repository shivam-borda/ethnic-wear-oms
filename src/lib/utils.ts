import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'dd MMM yyyy, hh:mm a');
  } catch {
    return '—';
  }
}

export function getDeliveryLabel(date: string | null | undefined): string {
  if (!date) return '';
  try {
    const parsed = parseISO(date);
    if (isToday(parsed)) return 'Today';
    if (isTomorrow(parsed)) return 'Tomorrow';
    return format(parsed, 'dd MMM yyyy');
  } catch {
    return '';
  }
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  return phone;
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getItemTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    kurta: '👘',
    koti: '🧥',
    kurta_koti: '👔',
    pant: '👖',
    blazer: '🥼',
  };
  return icons[type] || '👗';
}

export function getOverallProgress(progress: {
  fabric_status: string;
  work_status: string;
  stitching_status: string;
  delivery_status: string;
} | undefined): number {
  if (!progress) return 0;
  const stages = [
    progress.fabric_status,
    progress.work_status,
    progress.stitching_status,
    progress.delivery_status,
  ];
  const completed = stages.filter((s) => s === 'completed').length;
  const inProgress = stages.filter((s) => s === 'in_progress').length;
  return Math.round(((completed + inProgress * 0.5) / stages.length) * 100);
}

export function getCurrentStageLabel(progress: {
  fabric_status: string;
  work_status: string;
  stitching_status: string;
  delivery_status: string;
} | undefined): string {
  if (!progress) return 'Fabric';
  if (progress.delivery_status === 'completed') return 'Delivered';
  if (progress.delivery_status === 'in_progress') return 'Delivery';
  if (progress.stitching_status === 'in_progress' || progress.stitching_status === 'completed') return 'Stitching';
  if (progress.work_status === 'in_progress' || progress.work_status === 'completed') return 'Work';
  return 'Fabric';
}
