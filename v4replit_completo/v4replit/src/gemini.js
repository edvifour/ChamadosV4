import { GEMINI_API_KEY, GEMINI_ENDPOINT } from './config'

const SYSTEM_PROMPT = `Você é um analista financeiro especialista em operações de franquias V4 Company.
Seu papel é ler chamados de suporte financeiro e gerar um resumo executivo para o especialista que vai executar a tarefa.

Regras:
1. Seja direto e objetivo — o especialista não tem tempo para interpretar.
2. Extraia CNPJ, número de NF, valores e datas quando mencionados no texto.
3. Identifique a ação exata que precisa ser executada.
4. Se o chamado for vago, incompleto ou ambíguo, retorne confianca: "baixa" e explique o que está faltando.
5. Nunca invente informações que não estão no texto.
6. Retorne SEMPRE um JSON válido, sem markdown, sem blocos de código.

Contexto do negócio:
- Finance = plataforma interna de cobrança da V4 (Stone/matriz)
- Royalties = percentual do fee do cliente pago à matriz (varia por unidade: 15%, 18%, 19%, 20%, 25%)
- Repasse = valor que a matriz deve transferir ao franqueado após receber do cliente
- NF Antecipada = nota fiscal emitida antes do pagamento, a pedido do cliente
- Pipefy = sistema de contas a pagar onde cards de reembolso são abertos
- IUGU = plataforma de pagamento anterior ao Finance

Retorne exatamente este JSON:
{
  "acao_principal": "uma frase direta dizendo o que fazer",
  "contexto": ["array de strings com dados relevantes extraídos: CNPJ, NFs, valores, datas, nomes de cliente"],
  "atencao": "string com alertas específicos ou null se não houver",
  "confianca": "alta | media | baixa",
  "motivo_confianca_baixa": "string explicando o que falta ou null"
}`

export async function gerarResumoIA(chamado) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'COLE_SUA_CHAVE_AQUI') {
    return {
      acao_principal: 'Configure a chave do Gemini em src/config.js para ativar os resumos IA.',
      contexto: [`Ticket: ${chamado.ticket_id}`, `Unidade: ${chamado.unidade}`],
      atencao: null,
      confianca: 'baixa',
      motivo_confianca_baixa: 'Chave de API não configurada.',
    }
  }

  const userMessage = `Chamado financeiro para análise:

TICKET ID: ${chamado.ticket_id}
CATEGORIA: ${chamado.categoria}
SUBCATEGORIA: ${chamado.subcategoria}
TÍTULO: ${chamado.titulo}
UNIDADE: ${chamado.unidade}
PRÉ-TRIAGEM ORIGINAL: ${chamado.pre_triagem || 'não informada'}
AÇÕES JÁ TOMADAS: ${chamado.acoes || 'nenhuma'}

DESCRITIVO DO FRANQUEADO:
${chamado.descricao}`

  const body = {
    contents: [
      { role: 'user', parts: [{ text: SYSTEM_PROMPT + '\n\n' + userMessage }] }
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 800,
    }
  }

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${err}`)
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // strip markdown fences if present
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch (e) {
    console.error('Gemini error:', e)
    return {
      acao_principal: 'Erro ao gerar resumo. Verifique a chave da API e tente novamente.',
      contexto: [],
      atencao: e.message,
      confianca: 'baixa',
      motivo_confianca_baixa: 'Falha na chamada à API do Gemini.',
    }
  }
}

export function extractLinks(text) {
  if (!text) return []
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const matches = text.match(urlRegex) || []
  return matches.map(url => {
    let label = 'Link externo'
    let icon = 'link'
    const clean = url.replace(/[.,;)]+$/, '')
    if (clean.includes('docs.google.com/spreadsheets')) { label = 'Planilha Google'; icon = 'sheet' }
    else if (clean.includes('docs.google.com/document')) { label = 'Documento Google'; icon = 'doc' }
    else if (clean.includes('drive.google.com')) { label = 'Google Drive'; icon = 'drive' }
    else if (clean.includes('pipefy.com')) { label = 'Card Pipefy'; icon = 'pipefy' }
    else if (clean.includes('iugu.com') || clean.includes('payment-link') || clean.includes('checkout') || clean.includes('finance.mktlab')) { label = 'Link de pagamento'; icon = 'payment' }
    return { url: clean, label, icon }
  })
}
