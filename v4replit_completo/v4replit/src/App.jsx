import { useState, useMemo, useCallback } from 'react'
import { CHAMADOS, CATEGORIAS } from './data'
import { gerarResumoIA, extractLinks } from './gemini'
import { V4LogoFull } from './V4Logo'

// ── helpers ───────────────────────────────────────────────────────────
const STATUS_LABEL = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  pendencia: 'Pendência',
  concluido: 'Concluído',
  desviado: 'Desviado',
}
const PRIO_COLOR = { P1: '#E8000D', P2: '#FF9500', P3: '#6B6B6B', P4: '#444' }
const CONF_COLOR = { alta: '#34C759', media: '#FF9500', baixa: '#E8000D' }

function slaColor(dias, categoria) {
  const slaH = CATEGORIAS[categoria]?.sla || 24
  const diasSla = slaH / 24
  if (dias > diasSla * 3) return '#E8000D'
  if (dias > diasSla) return '#FF9500'
  return '#34C759'
}

function formatDias(dias) {
  if (dias < 1) return `${Math.round(dias * 24)}h`
  if (dias < 2) return `${Math.floor(dias)}d ${Math.round((dias % 1) * 24)}h`
  return `${Math.round(dias)}d`
}

// ── CSS global ────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --black: #0A0A0A; --gray900: #111111; --gray800: #1A1A1A;
    --gray700: #242424; --gray600: #333333; --gray500: #6B6B6B;
    --gray300: #A0A0A0; --gray100: #E8E8E8; --white: #FFFFFF;
    --red: #E8000D; --red-dark: #B8000A;
    --danger: #FF3B3B; --warning: #FF9500; --success: #34C759; --info: #0A84FF;
  }
  html, body, #root { height: 100%; }
  body {
    font-family: 'Inter', sans-serif;
    background: var(--black);
    color: var(--white);
    font-size: 13px;
    line-height: 1.5;
  }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: var(--gray900); }
  ::-webkit-scrollbar-thumb { background: var(--gray600); border-radius: 2px; }
  button { cursor: pointer; font-family: inherit; }
  input, select, textarea { font-family: inherit; }
`

// ── Badge components ──────────────────────────────────────────────────
function PrioBadge({ p }) {
  return (
    <span style={{
      background: PRIO_COLOR[p], color: p === 'P2' ? '#000' : '#fff',
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600,
      padding: '2px 6px', borderRadius: 3, letterSpacing: '0.05em',
    }}>{p}</span>
  )
}

function CatBadge({ cat }) {
  const c = CATEGORIAS[cat]
  if (!c) return null
  return (
    <span style={{
      background: c.cor + '22', color: c.cor, border: `1px solid ${c.cor}44`,
      fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 3,
      whiteSpace: 'nowrap',
    }}>{c.label}</span>
  )
}

function StatusBadge({ s }) {
  const colors = {
    nao_iniciado: '#6B6B6B', em_andamento: '#0A84FF',
    pendencia: '#FF9500', concluido: '#34C759', desviado: '#444',
  }
  return (
    <span style={{
      background: colors[s] + '22', color: colors[s],
      fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 3,
    }}>{STATUS_LABEL[s]}</span>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────
function Sidebar({ active, setActive, counts }) {
  const items = [
    { id: 'fila', label: 'Fila de Triagem', count: counts.total },
    { id: 'dashboard', label: 'Dashboard Gerencial', count: null },
  ]
  return (
    <aside style={{
      width: 220, background: '#E8000D', borderRight: '1px solid rgba(0,0,0,0.25)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '16px 14px 14px', borderBottom: '1px solid rgba(0,0,0,0.25)' }}>
        <V4LogoFull width={170} />
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 8, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>Triagem Financeira · CAF</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {items.map(item => (
          <button key={item.id} onClick={() => setActive(item.id)} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 16px', background: active === item.id ? 'rgba(0,0,0,0.3)' : 'transparent',
            borderLeft: active === item.id ? '2px solid #fff' : '2px solid transparent',
            border: 'none', color: active === item.id ? 'var(--white)' : 'rgba(255,255,255,0.65)',
            fontSize: 12, fontWeight: active === item.id ? 500 : 400, cursor: 'pointer',
            transition: 'all 150ms',
          }}>
            <span>{item.label}</span>
            {item.count != null && (
              <span style={{
                background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.7)',
                fontSize: 10, padding: '1px 6px', borderRadius: 10,
                fontFamily: "'JetBrains Mono', monospace",
              }}>{item.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.2)', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
        <div>Atualizado às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </aside>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────
function Drawer({ chamado, onClose, onStatusChange }) {
  const [resumo, setResumo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  const [acoesText, setAcoesText] = useState(chamado.acoes || '')

  const links = useMemo(() => extractLinks(chamado.descricao), [chamado.descricao])

  const fetchResumo = useCallback(async () => {
    if (resumo) return
    setLoading(true)
    const r = await gerarResumoIA(chamado)
    setResumo(r)
    setLoading(false)
    if (r.confianca === 'baixa') setDescOpen(true)
  }, [chamado, resumo])

  // auto-fetch on open
  useState(() => { fetchResumo() }, [])
  if (!resumo && !loading) fetchResumo()

  const cat = CATEGORIAS[chamado.categoria]
  const confColor = resumo ? CONF_COLOR[resumo.confianca] : 'var(--gray500)'
  const confLabel = { alta: 'Alta confiança — pode executar diretamente', media: 'Confiança média — verifique o descritivo antes', baixa: 'Baixa confiança — leia o chamado original' }

  return (
    <>
      {/* overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40,
      }} />
      {/* drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 500,
        background: 'var(--gray900)', borderLeft: '1px solid var(--gray700)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        animation: 'slideIn 150ms ease-out',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(40px); opacity:0 } to { transform: translateX(0); opacity:1 } }`}</style>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray700)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 500, color: '#FF9500' }}>
                {chamado.ticket_id}
              </span>
              <PrioBadge p={chamado.prioridade} />
              <CatBadge cat={chamado.categoria} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {chamado.pipefy_url && (
                <a href={chamado.pipefy_url} target="_blank" rel="noreferrer" style={{
                  fontSize: 11, color: 'var(--info)', textDecoration: 'none',
                  border: '1px solid var(--gray700)', borderRadius: 4, padding: '4px 8px',
                }}>↗ Pipefy</a>
              )}
              <button onClick={onClose} style={{
                background: 'none', border: 'none', color: 'var(--gray500)',
                fontSize: 18, lineHeight: 1, padding: 4,
              }}>✕</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              color: slaColor(chamado.dias, chamado.categoria), fontWeight: 600,
            }}>
              {formatDias(chamado.dias)}
            </span>
            <span style={{ color: 'var(--gray600)' }}>·</span>
            <select value={chamado.status} onChange={e => onStatusChange(chamado.id, e.target.value)} style={{
              background: 'var(--gray800)', border: '1px solid var(--gray700)',
              color: 'var(--white)', borderRadius: 4, padding: '3px 8px',
              fontSize: 11, cursor: 'pointer',
            }}>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gray300)', fontWeight: 500 }}>
            {chamado.titulo}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gray500)', marginTop: 2 }}>{chamado.unidade}</div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* AI Summary */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray500)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Resumo IA
            </div>

            {loading && (
              <div style={{ background: 'var(--gray800)', border: '1px solid var(--gray700)', borderRadius: 6, padding: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--gray500)', fontSize: 12 }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                  <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                  Analisando chamado...
                </div>
              </div>
            )}

            {resumo && !loading && (
              <>
                {/* Low confidence warning */}
                {resumo.confianca === 'baixa' && (
                  <div style={{
                    background: 'rgba(232,0,13,0.08)', border: '1px solid rgba(232,0,13,0.3)',
                    borderRadius: 6, padding: '10px 12px', marginBottom: 10,
                    fontSize: 12, color: '#FF6B6B',
                  }}>
                    ⚠ Este chamado tem informações insuficientes para execução segura. Leia o descritivo completo antes de agir.
                    {resumo.motivo_confianca_baixa && (
                      <div style={{ marginTop: 4, color: 'var(--gray300)', fontSize: 11 }}>{resumo.motivo_confianca_baixa}</div>
                    )}
                  </div>
                )}

                <div style={{ background: 'var(--gray800)', border: '1px solid var(--gray700)', borderRadius: 6, padding: 14 }}>
                  {/* Action */}
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    🎯 O que precisa ser feito
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)', marginBottom: 14, lineHeight: 1.5 }}>
                    {resumo.acao_principal}
                  </div>

                  {/* Context */}
                  {resumo.contexto?.length > 0 && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                        📋 Contexto relevante
                      </div>
                      <ul style={{ paddingLeft: 0, listStyle: 'none', marginBottom: resumo.atencao ? 14 : 0 }}>
                        {resumo.contexto.map((c, i) => (
                          <li key={i} style={{ fontSize: 12, color: 'var(--gray100)', marginBottom: 4, paddingLeft: 12, position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 0, color: 'var(--gray500)' }}>·</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {/* Alert */}
                  {resumo.atencao && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                        ⚠ Atenção
                      </div>
                      <div style={{ fontSize: 12, color: '#FF9500', lineHeight: 1.5 }}>{resumo.atencao}</div>
                    </>
                  )}
                </div>

                {/* Confidence badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: confColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: confColor }}>{confLabel[resumo.confianca]}</span>
                </div>
              </>
            )}
          </div>

          {/* Attachments */}
          {links.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray500)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                Anexos · {links.length} link{links.length > 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {links.map((lk, i) => (
                  <a key={i} href={lk.url} target="_blank" rel="noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'var(--gray800)', border: '1px solid var(--gray700)',
                    borderRadius: 4, padding: '5px 10px', fontSize: 11,
                    color: 'var(--gray100)', textDecoration: 'none',
                    transition: 'border-color 150ms',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--red)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray700)'}
                  >
                    <span style={{ fontSize: 13 }}>
                      {lk.icon === 'sheet' ? '📊' : lk.icon === 'pipefy' ? '🔗' : lk.icon === 'payment' ? '💳' : '🔗'}
                    </span>
                    {lk.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Original description */}
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setDescOpen(!descOpen)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--gray800)', border: '1px solid var(--gray700)', borderRadius: 6,
              padding: '10px 14px', color: 'var(--gray300)', fontSize: 12, fontWeight: 500,
            }}>
              <span>Ver chamado original</span>
              <span style={{ transition: 'transform 150ms', transform: descOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            {descOpen && (
              <div style={{
                background: 'var(--gray800)', border: '1px solid var(--gray700)', borderTop: 'none',
                borderRadius: '0 0 6px 6px', padding: '12px 14px',
                fontSize: 12, color: 'var(--gray300)', lineHeight: 1.7,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {chamado.descricao}
                {chamado.pre_triagem && (
                  <div style={{ marginTop: 8, fontSize: 10, color: 'var(--gray500)', fontFamily: "'JetBrains Mono', monospace" }}>
                    Pré-triagem original: {chamado.pre_triagem}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Acoes tomadas */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray500)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Ações tomadas
            </div>
            <textarea value={acoesText} onChange={e => setAcoesText(e.target.value)}
              placeholder="Registre aqui o que foi feito..."
              style={{
                width: '100%', minHeight: 80, background: 'var(--gray800)',
                border: '1px solid var(--gray700)', borderRadius: 6, padding: '10px 12px',
                color: 'var(--white)', fontSize: 12, resize: 'vertical', lineHeight: 1.6,
              }}
            />
          </div>

          {/* Timeline */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray500)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
              Histórico
            </div>
            {[
              { label: 'Criado', time: chamado.criado_em },
              { label: 'Entrou no financeiro', time: chamado.entrou_financeiro },
              chamado.status !== 'nao_iniciado' && { label: `Status: ${STATUS_LABEL[chamado.status]}`, time: 'recente' },
            ].filter(Boolean).map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--gray600)', flexShrink: 0, marginTop: 4 }} />
                <div>
                  <span style={{ fontSize: 11, color: 'var(--gray500)', fontFamily: "'JetBrains Mono', monospace" }}>{ev.time}</span>
                  <span style={{ fontSize: 11, color: 'var(--gray300)', marginLeft: 8 }}>{ev.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray700)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={() => onStatusChange(chamado.id, 'concluido')} style={{
            flex: 1, background: '#34C759', border: 'none', borderRadius: 6,
            color: '#000', fontWeight: 600, fontSize: 12, padding: '9px 0',
          }}>
            ✓ Marcar como concluído
          </button>
          <button onClick={() => onStatusChange(chamado.id, 'desviado')} style={{
            background: 'var(--gray800)', border: '1px solid var(--gray700)', borderRadius: 6,
            color: 'var(--gray300)', fontWeight: 500, fontSize: 12, padding: '9px 14px',
          }}>
            Desviar
          </button>
        </div>
      </div>
    </>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────
function Dashboard({ chamados }) {
  const total = chamados.length
  const p1 = chamados.filter(c => c.prioridade === 'P1').length
  const atrasados = chamados.filter(c => {
    const slaH = CATEGORIAS[c.categoria]?.sla || 24
    return c.dias > slaH / 24
  }).length
  const pctSla = Math.round((1 - atrasados / total) * 100)

  const porCat = Object.entries(CATEGORIAS).map(([id, cat]) => ({
    ...cat, id,
    count: chamados.filter(c => c.categoria === id).length,
    avgDias: chamados.filter(c => c.categoria === id).length > 0
      ? chamados.filter(c => c.categoria === id).reduce((a, b) => a + b.dias, 0) / chamados.filter(c => c.categoria === id).length
      : 0,
  })).filter(c => c.count > 0).sort((a, b) => b.count - a.count)

  const maxCount = Math.max(...porCat.map(c => c.count))

  const unidades = {}
  chamados.forEach(c => {
    if (!unidades[c.unidade]) unidades[c.unidade] = 0
    unidades[c.unidade]++
  })
  const topUnidades = Object.entries(unidades).sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, marginBottom: 20, letterSpacing: '0.02em' }}>
        Dashboard Gerencial
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total backlog', value: total, color: 'var(--white)' },
          { label: 'P1 Urgentes', value: p1, color: 'var(--danger)' },
          { label: 'Fora do SLA', value: atrasados, color: 'var(--warning)' },
          { label: 'Dentro do SLA', value: `${pctSla}%`, color: 'var(--success)' },
        ].map((k, i) => (
          <div key={i} style={{
            background: 'var(--gray900)', border: '1px solid var(--gray700)',
            borderRadius: 8, padding: '16px 20px',
          }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: 'var(--gray500)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Volume por categoria */}
        <div style={{ background: 'var(--gray900)', border: '1px solid var(--gray700)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 16, color: 'var(--gray100)' }}>Volume por categoria · média de dias na fila</div>
          {porCat.map(cat => (
            <div key={cat.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--gray300)' }}>{cat.label}</span>
                <span style={{ fontSize: 11, color: 'var(--gray500)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {cat.count} · ⌀{formatDias(cat.avgDias)}
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--gray800)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${(cat.count / maxCount) * 100}%`,
                  background: cat.cor,
                  transition: 'width 600ms ease-out',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Top unidades */}
        <div style={{ background: 'var(--gray900)', border: '1px solid var(--gray700)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 16, color: 'var(--gray100)' }}>Unidades com mais chamados</div>
          {topUnidades.map(([unidade, count], i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 0', borderBottom: i < topUnidades.length - 1 ? '1px solid var(--gray700)' : 'none',
            }}>
              <span style={{ fontSize: 11, color: 'var(--gray300)' }}>{unidade.replace('V4 Company ', '').replace('V4 ', '')}</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600,
                color: count >= 3 ? 'var(--danger)' : count >= 2 ? 'var(--warning)' : 'var(--gray300)',
              }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Alertas */}
      <div style={{ background: 'var(--gray900)', border: '1px solid var(--gray700)', borderRadius: 8, padding: 20, marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 14, color: 'var(--gray100)' }}>Alertas operacionais</div>
        {[
          { cor: 'var(--danger)', titulo: 'Erro sistêmico de percentual de royalties', desc: 'Múltiplas unidades (Fagundes Primo, Vieira, Affonso, Elxai...) com o mesmo problema recorrente de percentual incorreto. Não é resolvível chamado a chamado — requer correção na configuração do Finance/IUGU.' },
          { cor: 'var(--warning)', titulo: '18+ chamados de Repasse SDR IA em diferentes unidades', desc: 'O processo de repasse do produto SDR IA está quebrado. Tratar como problema de processo, não como chamados individuais.' },
          { cor: 'var(--warning)', titulo: 'NF emitida em duplicidade — padrão recorrente', desc: '7+ chamados de cancelamento por NF duplicada. A mudança no processo de emissão de NFs gerou um problema recorrente que precisa ser corrigido no processo.' },
        ].map((a, i) => (
          <div key={i} style={{
            borderLeft: `3px solid ${a.cor}`, paddingLeft: 12, marginBottom: i < 2 ? 14 : 0,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--white)', marginBottom: 3 }}>{a.titulo}</div>
            <div style={{ fontSize: 11, color: 'var(--gray400)', lineHeight: 1.6 }}>{a.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────
export default function App() {
  const [nav, setNav] = useState('fila')
  const [chamados, setChamados] = useState(CHAMADOS)
  const [selected, setSelected] = useState(null)
  const [filterPrio, setFilterPrio] = useState('todos')
  const [filterCat, setFilterCat] = useState('todas')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [search, setSearch] = useState('')
  const [slaOnly, setSlaOnly] = useState(false)

  const filtered = useMemo(() => {
    return chamados
      .filter(c => filterPrio === 'todos' || c.prioridade === filterPrio)
      .filter(c => filterCat === 'todas' || c.categoria === filterCat)
      .filter(c => filterStatus === 'todos' || c.status === filterStatus)
      .filter(c => !slaOnly || c.dias > (CATEGORIAS[c.categoria]?.sla || 24) / 24)
      .filter(c => !search || c.ticket_id.toLowerCase().includes(search.toLowerCase()) || c.unidade.toLowerCase().includes(search.toLowerCase()) || c.titulo.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const pp = { P1: 0, P2: 1, P3: 2, P4: 3 }
        if (pp[a.prioridade] !== pp[b.prioridade]) return pp[a.prioridade] - pp[b.prioridade]
        return b.dias - a.dias
      })
  }, [chamados, filterPrio, filterCat, filterStatus, search, slaOnly])

  const handleStatusChange = (id, status) => {
    setChamados(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }))
  }

  const counts = { total: chamados.filter(c => c.status !== 'concluido' && c.status !== 'desviado').length }

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar active={nav} setActive={setNav} counts={counts} />

        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {nav === 'dashboard' ? (
            <Dashboard chamados={chamados} />
          ) : (
            <>
              {/* Top bar */}
              <div style={{
                padding: '14px 20px', borderBottom: '1px solid var(--gray700)',
                background: 'var(--black)', position: 'sticky', top: 0, zIndex: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: '0.02em' }}>Fila de Triagem</span>
                  <span style={{ fontSize: 11, color: 'var(--gray500)', marginLeft: 4 }}>
                    {filtered.length} chamados
                    {chamados.filter(c => c.prioridade === 'P1').length > 0 && (
                      <span style={{ color: 'var(--danger)', marginLeft: 6, fontWeight: 600 }}>
                        · {chamados.filter(c => c.prioridade === 'P1').length} P1 urgentes
                      </span>
                    )}
                  </span>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* Search */}
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar ID, unidade, título..."
                    style={{
                      background: 'var(--gray900)', border: '1px solid var(--gray700)',
                      borderRadius: 6, padding: '5px 10px', color: 'var(--white)',
                      fontSize: 11, width: 200,
                    }}
                  />

                  {/* Prio tabs */}
                  {['todos', 'P1', 'P2', 'P3', 'P4'].map(p => (
                    <button key={p} onClick={() => setFilterPrio(p)} style={{
                      background: filterPrio === p ? (p === 'todos' ? 'var(--gray700)' : PRIO_COLOR[p]) : 'var(--gray900)',
                      border: `1px solid ${filterPrio === p ? 'transparent' : 'var(--gray700)'}`,
                      color: filterPrio === p && p !== 'todos' && p !== 'P4' ? (p === 'P2' ? '#000' : '#fff') : 'var(--gray300)',
                      borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 500,
                    }}>{p === 'todos' ? 'Todos' : p}</button>
                  ))}

                  {/* Category filter */}
                  <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{
                    background: 'var(--gray900)', border: '1px solid var(--gray700)',
                    color: 'var(--gray300)', borderRadius: 6, padding: '5px 8px', fontSize: 11,
                  }}>
                    <option value="todas">Todas categorias</option>
                    {Object.entries(CATEGORIAS).map(([id, cat]) => (
                      <option key={id} value={id}>{cat.label}</option>
                    ))}
                  </select>

                  {/* Status filter */}
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
                    background: 'var(--gray900)', border: '1px solid var(--gray700)',
                    color: 'var(--gray300)', borderRadius: 6, padding: '5px 8px', fontSize: 11,
                  }}>
                    <option value="todos">Todos status</option>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>

                  {/* SLA toggle */}
                  <button onClick={() => setSlaOnly(!slaOnly)} style={{
                    background: slaOnly ? 'rgba(232,0,13,0.15)' : 'var(--gray900)',
                    border: `1px solid ${slaOnly ? 'var(--red)' : 'var(--gray700)'}`,
                    color: slaOnly ? 'var(--red)' : 'var(--gray500)',
                    borderRadius: 6, padding: '4px 10px', fontSize: 11,
                  }}>
                    Só atrasados
                  </button>
                </div>
              </div>

              {/* Table */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--gray700)', background: 'var(--gray900)' }}>
                      {['Prio', 'ID', 'SLA', 'Categoria', 'Título', 'Unidade', 'Status', 'Resumo'].map(h => (
                        <th key={h} style={{
                          padding: '8px 12px', textAlign: 'left', fontSize: 10,
                          fontWeight: 600, color: 'var(--gray500)', letterSpacing: '0.08em',
                          textTransform: 'uppercase', whiteSpace: 'nowrap', position: 'sticky', top: 0,
                          background: 'var(--gray900)', borderBottom: '1px solid var(--gray700)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.id} style={{
                        borderBottom: '1px solid var(--gray700)',
                        borderLeft: c.prioridade === 'P1' ? '2px solid var(--red)' : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'background 100ms',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--gray900)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}><PrioBadge p={c.prioridade} /></td>
                        <td style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#FF9500', whiteSpace: 'nowrap' }}>{c.ticket_id}</td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: slaColor(c.dias, c.categoria) }}>
                            {formatDias(c.dias)}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <CatBadge cat={c.categoria} />
                          <div style={{ fontSize: 10, color: 'var(--gray500)', marginTop: 2 }}>{c.subcategoria}</div>
                        </td>
                        <td style={{ padding: '8px 12px', maxWidth: 240 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--gray100)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titulo}</div>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--gray400)', whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.unidade.replace('V4 Company ', '').replace('V4 ', '')}
                        </td>
                        <td style={{ padding: '8px 12px' }}><StatusBadge s={c.status} /></td>
                        <td style={{ padding: '8px 12px' }}>
                          <button onClick={() => setSelected(c)} style={{
                            background: 'var(--gray800)', border: '1px solid var(--gray700)',
                            color: 'var(--gray300)', borderRadius: 4, padding: '4px 10px',
                            fontSize: 11, whiteSpace: 'nowrap',
                            transition: 'border-color 150ms, color 150ms',
                          }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--white)' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray700)'; e.currentTarget.style.color = 'var(--gray300)' }}
                          >
                            Ver resumo
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--gray500)', fontSize: 12 }}>
                        Nenhum chamado encontrado com os filtros aplicados.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>

        {/* Drawer */}
        {selected && (
          <Drawer
            chamado={selected}
            onClose={() => setSelected(null)}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </>
  )
}
