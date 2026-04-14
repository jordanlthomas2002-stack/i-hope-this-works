import { useEffect, useMemo, useRef, useState } from 'react'
import { useRealtimeOps } from './hooks/useRealtimeOps'
import type { DiningTable, Floor, Reservation, TableShape, TableStatus } from './types'

const statusColors: Record<TableStatus, string> = {
  available: '#14532d',
  seated: '#1d4ed8',
  reserved: '#7c3aed',
  dirty: '#b45309',
  closed: '#7f1d1d',
}

const shapeBorderRadius: Record<TableShape, string> = {
  round: '999px',
  square: '18px',
  booth: '22px',
  bar: '12px',
}

function minutesSince(iso: string | null) {
  if (!iso) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
}

function currency(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0)
}

function App() {
  const ops = useRealtimeOps()
  const [activeFloorId, setActiveFloorId] = useState<string>('')
  const [selectedTableId, setSelectedTableId] = useState<string>('')
  const [reservationForm, setReservationForm] = useState({ guest_name: '', party_size: 2, reservation_time: '', phone: '', status: 'booked', notes: '' })
  const boardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!activeFloorId && ops.floors[0]) setActiveFloorId(ops.floors[0].id)
  }, [ops.floors, activeFloorId])

  const activeFloor = useMemo(() => ops.floors.find((f) => f.id === activeFloorId) ?? ops.floors[0], [ops.floors, activeFloorId])
  const floorTables = useMemo(() => ops.tables.filter((t) => t.floor_id === activeFloor?.id), [ops.tables, activeFloor])
  const selectedTable = useMemo(() => ops.tables.find((t) => t.id === selectedTableId) ?? floorTables[0] ?? null, [ops.tables, selectedTableId, floorTables])

  useEffect(() => {
    if (!selectedTableId && floorTables[0]) setSelectedTableId(floorTables[0].id)
  }, [floorTables, selectedTableId])

  useEffect(() => {
    const timer = setInterval(() => {
      document.title = `Ops Pro • ${ops.metrics.seated} seated • ${ops.metrics.waitlist} waitlist`
    }, 15000)
    return () => clearInterval(timer)
  }, [ops.metrics.seated, ops.metrics.waitlist])

  const createQuickTable = async () => {
    if (!activeFloor) return
    const count = floorTables.length + 1
    await ops.upsertTable({ floor_id: activeFloor.id, name: `T${count}`, x: 80 + count * 10, y: 80 + count * 10 })
    await ops.logActivity(`Added table T${count} on ${activeFloor.name}`, 'table')
  }

  const handleDragStart = (table: DiningTable, event: React.PointerEvent<HTMLDivElement>) => {
    if (!boardRef.current || !activeFloor) return
    const boardRect = boardRef.current.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const baseX = table.x
    const baseY = table.y
    ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)

    const onMove = async (e: PointerEvent) => {
      const nextX = Math.min(Math.max(0, baseX + e.clientX - startX), activeFloor.width - table.width)
      const nextY = Math.min(Math.max(0, baseY + e.clientY - startY), activeFloor.height - table.height)
      const el = document.getElementById(`table-${table.id}`)
      if (el) {
        el.style.left = `${nextX}px`
        el.style.top = `${nextY}px`
      }
    }

    const onUp = async (e: PointerEvent) => {
      const nextX = Math.min(Math.max(0, baseX + e.clientX - startX), activeFloor.width - table.width)
      const nextY = Math.min(Math.max(0, baseY + e.clientY - startY), activeFloor.height - table.height)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      await ops.updateTablePosition(table.id, nextX, nextY)
      await ops.logActivity(`Moved ${table.name} on ${activeFloor.name}`, 'layout')
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
  }

  const saveReservation = async () => {
    if (!reservationForm.guest_name || !reservationForm.reservation_time) return
    await ops.createReservation({
      floor_id: activeFloor?.id ?? null,
      table_id: null,
      guest_name: reservationForm.guest_name,
      party_size: Number(reservationForm.party_size),
      reservation_time: reservationForm.reservation_time,
      phone: reservationForm.phone || null,
      status: reservationForm.status as Reservation['status'],
      notes: reservationForm.notes || null,
    })
    await ops.logActivity(`Added reservation for ${reservationForm.guest_name}`, 'reservation')
    setReservationForm({ guest_name: '', party_size: 2, reservation_time: '', phone: '', status: 'booked', notes: '' })
  }

  const seatReservation = async (reservation: Reservation) => {
    if (!selectedTable) return
    await ops.patchReservation(reservation.id, { status: 'seated', table_id: selectedTable.id, floor_id: selectedTable.floor_id })
    await ops.patchTable(selectedTable.id, {
      status: 'seated',
      current_covers: reservation.party_size,
      turn_started_at: new Date().toISOString(),
      notes: reservation.guest_name,
    })
    await ops.logActivity(`Seated ${reservation.guest_name} at ${selectedTable.name}`, 'seat')
  }

  const exportSnapshot = async () => {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), floors: ops.floors, tables: ops.tables, reservations: ops.reservations }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'restaurant-ops-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (ops.loading) return <Shell><div style={loadingCard}>Loading restaurant data…</div></Shell>

  return (
    <Shell>
      <div style={appLayout}>
        <aside style={leftRail}>
          <div style={panel}>
            <div style={sectionTitle}>Manager Snapshot</div>
            <Metric label="Seated" value={String(ops.metrics.seated)} />
            <Metric label="Covers" value={String(ops.metrics.covers)} />
            <Metric label="Waitlist" value={String(ops.metrics.waitlist)} />
            <Metric label="Open Sales" value={currency(ops.metrics.sales)} />
            <Metric label="Dirty Tables" value={String(ops.metrics.dirty)} />
          </div>

          <div style={panel}>
            <div style={{ ...sectionTitle, marginBottom: 12 }}>Floors</div>
            {ops.floors.map((floor) => (
              <button key={floor.id} onClick={() => setActiveFloorId(floor.id)} style={floorButton(floor.id === activeFloor?.id)}>{floor.name}</button>
            ))}
            <button style={actionButton} onClick={() => {
              const name = window.prompt('New floor name')
              if (name) void ops.createFloor(name)
            }}>+ Add floor</button>
          </div>

          <div style={panel}>
            <div style={sectionTitle}>Reservations / Waitlist</div>
            <input style={input} placeholder="Guest name" value={reservationForm.guest_name} onChange={(e) => setReservationForm((s) => ({ ...s, guest_name: e.target.value }))} />
            <div style={row2}>
              <input style={input} type="number" min={1} placeholder="Party" value={reservationForm.party_size} onChange={(e) => setReservationForm((s) => ({ ...s, party_size: Number(e.target.value) }))} />
              <select style={input} value={reservationForm.status} onChange={(e) => setReservationForm((s) => ({ ...s, status: e.target.value }))}>
                <option value="booked">Booked</option>
                <option value="waitlist">Waitlist</option>
              </select>
            </div>
            <input style={input} type="datetime-local" value={reservationForm.reservation_time} onChange={(e) => setReservationForm((s) => ({ ...s, reservation_time: e.target.value }))} />
            <input style={input} placeholder="Phone" value={reservationForm.phone} onChange={(e) => setReservationForm((s) => ({ ...s, phone: e.target.value }))} />
            <textarea style={{ ...input, minHeight: 72 }} placeholder="Notes" value={reservationForm.notes} onChange={(e) => setReservationForm((s) => ({ ...s, notes: e.target.value }))} />
            <button style={actionButton} onClick={() => void saveReservation()}>Save reservation</button>
            <div style={{ marginTop: 12, display: 'grid', gap: 8, maxHeight: 240, overflow: 'auto' }}>
              {ops.reservations.map((r) => (
                <div key={r.id} style={reservationCard}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.guest_name}</div>
                    <div style={smallMuted}>Party {r.party_size} • {new Date(r.reservation_time).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={pill}>{r.status}</span>
                    <button style={miniButton} onClick={() => void seatReservation(r)}>Seat</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main style={centerArea}>
          <div style={topBar}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Restaurant Ops Pro</div>
              <div style={smallMuted}>Shared live floor board for service, turns, covers, and reservations</div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button style={actionButton} onClick={() => void createQuickTable()}>+ Add table</button>
              <button style={ghostButton} onClick={() => void ops.reload()}>Refresh</button>
              <button style={ghostButton} onClick={exportSnapshot}>Export</button>
            </div>
          </div>

          {ops.error && <div style={{ ...panel, border: '1px solid #7f1d1d', background: '#2a0e16' }}>{ops.error}</div>}

          <div ref={boardRef} style={{ ...board, width: activeFloor?.width ?? 1400, height: activeFloor?.height ?? 900 }}>
            <div style={gridOverlay} />
            {floorTables.map((table) => {
              const mins = minutesSince(table.turn_started_at)
              return (
                <div
                  id={`table-${table.id}`}
                  key={table.id}
                  onPointerDown={(e) => handleDragStart(table, e)}
                  onClick={() => setSelectedTableId(table.id)}
                  style={{
                    position: 'absolute',
                    left: table.x,
                    top: table.y,
                    width: table.width,
                    height: table.height,
                    background: statusColors[table.status],
                    borderRadius: shapeBorderRadius[table.shape],
                    border: selectedTable?.id === table.id ? '3px solid #f8fafc' : '2px solid rgba(255,255,255,0.16)',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 10,
                    cursor: 'grab',
                    touchAction: 'none',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.25)'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{table.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>{table.current_covers}/{table.max_covers} covers</div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>{table.server_name || 'Unassigned'}</div>
                  {table.status === 'seated' && <div style={{ fontSize: 13, fontWeight: 700 }}>{mins} min</div>}
                </div>
              )
            })}
          </div>
        </main>

        <aside style={rightRail}>
          <div style={panel}>
            <div style={sectionTitle}>Table Console</div>
            {selectedTable ? (
              <TableEditor table={selectedTable} onPatch={(patch) => void ops.patchTable(selectedTable.id, patch)} onStatus={(status) => void ops.setTableStatus(selectedTable.id, status)} onDelete={() => void ops.removeTable(selectedTable.id)} />
            ) : (
              <div style={smallMuted}>Select a table to edit it.</div>
            )}
          </div>

          <div style={panel}>
            <div style={sectionTitle}>Live Activity</div>
            <div style={{ display: 'grid', gap: 8, maxHeight: 340, overflow: 'auto' }}>
              {ops.activity.map((item) => (
                <div key={item.id} style={activityRow}>
                  <div style={{ fontWeight: 700 }}>{item.message}</div>
                  <div style={smallMuted}>{new Date(item.created_at).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  )
}

function TableEditor({ table, onPatch, onStatus, onDelete }: { table: DiningTable; onPatch: (patch: Partial<DiningTable>) => void; onStatus: (status: TableStatus) => void; onDelete: () => void }) {
  const mins = minutesSince(table.turn_started_at)
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <input style={input} value={table.name} onChange={(e) => onPatch({ name: e.target.value })} />
      <div style={row2}>
        <select style={input} value={table.shape} onChange={(e) => onPatch({ shape: e.target.value as TableShape })}>
          <option value="round">Round</option>
          <option value="square">Square</option>
          <option value="booth">Booth</option>
          <option value="bar">Bar</option>
        </select>
        <select style={input} value={table.status} onChange={(e) => onStatus(e.target.value as TableStatus)}>
          <option value="available">Available</option>
          <option value="seated">Seated</option>
          <option value="reserved">Reserved</option>
          <option value="dirty">Dirty</option>
          <option value="closed">Closed</option>
        </select>
      </div>
      <div style={row2}>
        <input style={input} type="number" value={table.current_covers} onChange={(e) => onPatch({ current_covers: Number(e.target.value) })} placeholder="Current covers" />
        <input style={input} type="number" value={table.max_covers} onChange={(e) => onPatch({ max_covers: Number(e.target.value), seats: Number(e.target.value) })} placeholder="Max covers" />
      </div>
      <div style={row2}>
        <input style={input} value={table.server_name ?? ''} onChange={(e) => onPatch({ server_name: e.target.value, section_name: e.target.value })} placeholder="Server" />
        <input style={input} type="color" value={table.server_color ?? '#38bdf8'} onChange={(e) => onPatch({ server_color: e.target.value })} />
      </div>
      <div style={row2}>
        <input style={input} type="number" value={table.width} onChange={(e) => onPatch({ width: Number(e.target.value) })} placeholder="Width" />
        <input style={input} type="number" value={table.height} onChange={(e) => onPatch({ height: Number(e.target.value) })} placeholder="Height" />
      </div>
      <input style={input} type="number" value={table.active_check_total} onChange={(e) => onPatch({ active_check_total: Number(e.target.value) })} placeholder="Check total" />
      <textarea style={{ ...input, minHeight: 90 }} value={table.notes ?? ''} onChange={(e) => onPatch({ notes: e.target.value })} placeholder="Table notes" />
      <div style={smallMuted}>Turn time: {mins} minutes</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={actionButton} onClick={() => onStatus('seated')}>Start turn</button>
        <button style={ghostButton} onClick={() => onStatus('available')}>Reset table</button>
        <button style={{ ...ghostButton, borderColor: '#7f1d1d', color: '#fecaca' }} onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCard}>
      <div style={smallMuted}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100%', background: 'linear-gradient(180deg,#0b1020 0%, #111827 100%)' }}>{children}</div>
}

const appLayout: React.CSSProperties = { display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: 16, padding: 16, minHeight: '100vh' }
const leftRail: React.CSSProperties = { display: 'grid', gap: 16, alignContent: 'start' }
const centerArea: React.CSSProperties = { display: 'grid', gap: 16, alignContent: 'start' }
const rightRail: React.CSSProperties = { display: 'grid', gap: 16, alignContent: 'start' }
const panel: React.CSSProperties = { background: 'rgba(15,23,42,0.88)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: 22, padding: 16, boxShadow: '0 18px 40px rgba(0,0,0,0.22)' }
const loadingCard: React.CSSProperties = { ...panel, margin: 24 }
const sectionTitle: React.CSSProperties = { fontSize: 18, fontWeight: 800, marginBottom: 10 }
const metricCard: React.CSSProperties = { border: '1px solid rgba(148,163,184,0.16)', borderRadius: 18, padding: 12, marginBottom: 10, background: 'rgba(255,255,255,0.03)' }
const floorButton = (active: boolean): React.CSSProperties => ({ width: '100%', textAlign: 'left', borderRadius: 16, padding: '12px 14px', marginBottom: 8, border: active ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.16)', background: active ? 'rgba(14,116,144,0.25)' : 'rgba(255,255,255,0.03)', color: 'white' })
const actionButton: React.CSSProperties = { borderRadius: 16, padding: '12px 14px', border: '1px solid #0284c7', background: '#0369a1', color: 'white', fontWeight: 700 }
const ghostButton: React.CSSProperties = { borderRadius: 16, padding: '12px 14px', border: '1px solid rgba(148,163,184,0.22)', background: 'rgba(255,255,255,0.03)', color: 'white', fontWeight: 700 }
const miniButton: React.CSSProperties = { borderRadius: 12, padding: '8px 10px', border: '1px solid #0284c7', background: '#075985', color: 'white', fontSize: 12, fontWeight: 700 }
const input: React.CSSProperties = { width: '100%', borderRadius: 14, border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(255,255,255,0.03)', color: 'white', padding: '12px 13px' }
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }
const topBar: React.CSSProperties = { ...panel, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }
const board: React.CSSProperties = { position: 'relative', overflow: 'auto', borderRadius: 26, background: 'linear-gradient(180deg, rgba(17,24,39,0.95), rgba(15,23,42,0.95))', border: '1px solid rgba(148,163,184,0.12)', minHeight: 720 }
const gridOverlay: React.CSSProperties = { position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }
const reservationCard: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, borderRadius: 16, padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.16)' }
const activityRow: React.CSSProperties = { borderRadius: 16, padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.16)' }
const pill: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '4px 8px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(129,140,248,0.4)', fontSize: 12 }
const smallMuted: React.CSSProperties = { fontSize: 12, color: '#cbd5e1' }

export default App
