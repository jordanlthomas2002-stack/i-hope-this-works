export type TableShape = 'round' | 'square' | 'booth' | 'bar'
export type TableStatus = 'available' | 'seated' | 'reserved' | 'dirty' | 'closed'

export interface Floor {
  id: string
  name: string
  width: number
  height: number
  sort_order: number
}

export interface DiningTable {
  id: string
  floor_id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  seats: number
  shape: TableShape
  server_name: string | null
  server_color: string | null
  status: TableStatus
  section_name: string | null
  notes: string | null
  turn_started_at: string | null
  current_covers: number
  max_covers: number
  active_check_total: number
}

export interface Reservation {
  id: string
  floor_id: string | null
  table_id: string | null
  guest_name: string
  party_size: number
  reservation_time: string
  phone: string | null
  status: 'booked' | 'seated' | 'completed' | 'cancelled' | 'waitlist'
  notes: string | null
}

export interface ActivityLog {
  id: string
  created_at: string
  message: string
  kind: string
}
