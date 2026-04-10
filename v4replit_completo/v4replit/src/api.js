const BASE = '/api'

export async function fetchChamados(date = null) {
  const url = date ? `${BASE}/chamados?date=${date}` : `${BASE}/chamados`
  const r = await fetch(url)
  if (!r.ok) throw new Error('Erro ao buscar chamados')
  return r.json()
}

export async function fetchSnapshots() {
  const r = await fetch(`${BASE}/snapshots`)
  if (!r.ok) throw new Error('Erro ao buscar snapshots')
  return r.json()
}

export async function fetchComparativo() {
  const r = await fetch(`${BASE}/comparativo`)
  if (!r.ok) throw new Error('Erro ao buscar comparativo')
  return r.json()
}

export async function fetchHistorico(ticketId) {
  const r = await fetch(`${BASE}/historico/${ticketId}`)
  if (!r.ok) throw new Error('Erro ao buscar histórico')
  return r.json()
}

export async function uploadPlanilha(file, date) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_date', date)
  const r = await fetch(`${BASE}/upload`, { method: 'POST', body: fd })
  const data = await r.json()
  if (!r.ok) throw new Error(data.error || 'Erro no upload')
  return data
}
