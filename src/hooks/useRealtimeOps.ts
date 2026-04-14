import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasSupabase, supabase } from '../lib/supabase'
import type { ActivityLog, DiningTable, Floor, Reservation, TableStatus } from '../types'

export function useRealtimeOps() {
  const [floors, setFloors] = useState<Floor[]>([])
  const [tables, setTables] = useState<DiningTable[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }
    setLoading(true)
    const [floorsRes, tablesRes, reservationsRes, activityRes] = await Promise.all([
      supabase.from('floors').select('*').order('sort_order'),
      supabase.from('dining_tables').select('*').order('name'),
      supabase.from('reservations').select('*').order('reservation_time'),
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(30),
    ])

    if (floorsRes.error || tablesRes.error || reservationsRes.error || activityRes.error) {
      setError(floorsRes.error?.message || tablesRes.error?.message || reservationsRes.error?.message || activityRes.error?.message || 'Could not load data')
    } else {
      setFloors((floorsRes.data as Floor[]) ?? [])
      setTables((tablesRes.data as DiningTable[]) ?? [])
      setReservations((reservationsRes.data as Reservation[]) ?? [])
      setActivity((activityRes.data as ActivityLog[]) ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (!hasSupabase || !supabase) return

    const channel = supabase
      .channel('restaurant-ops-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'floors' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dining_tables' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, reload)
      .subscribe()

    return () => {
      if (supabase) {
        void supabase.removeChannel(channel)
      }
    }
  }, [reload])

  const upsertTable = useCallback(async (table: Partial<DiningTable> & { id?: string; floor_id: string; name: string }) => {
    if (!supabase) return
    const payload = {
      width: 88,
      height: 88,
      seats: 4,
      shape: 'round',
      status: 'available',
      current_covers: 0,
      max_covers: 4,
      active_check_total: 0,
      x: 60,
      y: 60,
      ...table,
    }
    const { error } = await supabase.from('dining_tables').upsert(payload)
    if (error) throw error
  }, [])

  const updateTablePosition = useCallback(async (id: string, x: number, y: number) => {
    if (!supabase) return
    const { error } = await supabase.from('dining_tables').update({ x, y }).eq('id', id)
    if (error) throw error
  }, [])

  const patchTable = useCallback(async (id: string, patch: Partial<DiningTable>) => {
    if (!supabase) return
    const { error } = await supabase.from('dining_tables').update(patch).eq('id', id)
    if (error) throw error
  }, [])

  const removeTable = useCallback(async (id: string) => {
    if (!supabase) return
    const { error } = await supabase.from('dining_tables').delete().eq('id', id)
    if (error) throw error
  }, [])

  const createFloor = useCallback(async (name: string) => {
    if (!supabase) return
    const nextOrder = floors.length + 1
    const { error } = await supabase.from('floors').insert({ name, width: 1400, height: 900, sort_order: nextOrder })
    if (error) throw error
  }, [floors.length])

  const createReservation = useCallback(async (reservation: Omit<Reservation, 'id'>) => {
    if (!supabase) return
    const { error } = await supabase.from('reservations').insert(reservation)
    if (error) throw error
  }, [])

  const patchReservation = useCallback(async (id: string, patch: Partial<Reservation>) => {
    if (!supabase) return
    const { error } = await supabase.from('reservations').update(patch).eq('id', id)
    if (error) throw error
  }, [])

  const logActivity = useCallback(async (message: string, kind: string) => {
    if (!supabase) return
    const { error } = await supabase.from('activity_log').insert({ message, kind })
    if (error) throw error
  }, [])

  const metrics = useMemo(() => {
    const seated = tables.filter((t) => t.status === 'seated').length
    const reserved = tables.filter((t) => t.status === 'reserved').length
    const dirty = tables.filter((t) => t.status === 'dirty').length
    const covers = tables.reduce((sum, t) => sum + (t.current_covers ?? 0), 0)
    const sales = tables.reduce((sum, t) => sum + Number(t.active_check_total ?? 0), 0)
    const waitlist = reservations.filter((r) => r.status === 'waitlist').length
    return { seated, reserved, dirty, covers, sales, waitlist }
  }, [tables, reservations])

  const setTableStatus = useCallback(async (id: string, status: TableStatus) => {
    const patch: Partial<DiningTable> = { status }
    if (status === 'seated') patch.turn_started_at = new Date().toISOString()
    if (status === 'available') {
      patch.turn_started_at = null
      patch.current_covers = 0
      patch.active_check_total = 0
    }
    await patchTable(id, patch)
  }, [patchTable])

  return {
    floors,
    tables,
    reservations,
    activity,
    metrics,
    loading,
    error,
    reload,
    createFloor,
    upsertTable,
    updateTablePosition,
    patchTable,
    removeTable,
    createReservation,
    patchReservation,
    logActivity,
    setTableStatus,
  }
}
