"""
V4 Company · Financeiro CAF
Parser de planilha XLSX exportada do Pipefy
Colunas esperadas:
  Ticket ID, Etiquetas, Título, Mais informações,
  Usuário Afetado, Nome da unidade, Ações que foram tomadas,
  Especialista responsável, Criado em,
  Primeira vez que entrou na fase FINANCEIRO CAF
"""
import pandas as pd
from datetime import datetime, timezone
import re

REQUIRED_COLS = [
    'Ticket ID',
    'Criado em',
    'Primeira vez que entrou na fase FINANCEIRO CAF',
]

def categorizar(titulo, descricao, etiqueta, acoes):
    t = str(titulo or '').lower()
    d = str(descricao or '').lower()
    e = str(etiqueta or '').lower()
    a = str(acoes or '').lower()
    c = f"{t} {d} {e} {a}"

    if any(x in c for x in [
        'antecipada','antecipar','so paga com nf','só paga com nf',
        'antes do pagamento','antes de realizar','para realizar o pagamento',
        'precisa da nota para','nf para pagamento','variavel','variável',
        'nota para pagar','para pagar a fatura','cliente só paga','cliente so paga',
        'emitir antes','nf antes']):
        return 'NF Antecipada', 'P1'

    if any(x in c for x in [
        'repasse','não recebi','nao recebi','repasse em atraso',
        'repasse do finance','repasse pendente','repasse ck',
        'repasse de multa','não estou recebendo','repasse apra',
        'multa rescisória','calvin klein','não recebido']):
        return 'Repasse', 'P1'

    if any(x in c for x in [
        'reembolso do fee','reembolso fee integral','reembolso para cliente',
        'reembolso de cliente','reembolso urgente','churn','labteste',
        'credpress','proseg','esconderijo','devolução ao cliente',
        'devolveu o valor','cliente pediu reembolso']):
        return 'Reembolso Cliente', 'P1'

    if any(x in c for x in [
        'cancelamento','cancelar nf','cancelar nota','cancel',
        'duplicada','duplicidade','nf duplicada','indevida',
        'emitida incorretamente','cancelamento nf']):
        return 'Cancelamento NF', 'P2'

    if any(x in c for x in [
        'ajuste','nota errada','nf errada','valor errado',
        'nota incorreta','irregular','retenção','retencao',
        'emitida para unidade anterior','nf incorreta']):
        return 'Ajuste NF', 'P2'

    if any(x in c for x in [
        'baixa','pagamento não identificado','pagamento nao identificado',
        'pix para matriz','baixa do pagamento','dar baixa',
        'lançamento no finance','nao subiu','não subiu',
        'alterar conta','alteração de conta','trocar a conta',
        'descadastramento','centralizar recebimento','parcelas indevidas',
        'indevidas no finance','churnados ativos','cadastrar no finance']):
        return 'Finance', 'P2'
    if 'finance' in e:
        return 'Finance', 'P2'

    if any(x in c for x in [
        'reembolso','estorno de royalties','estorno roy','roy cobrado',
        'devolução de roy','devoluçao de roy','reembolso de roy',
        'reembolso roy','devolução de royalties','aguardando pagamento',
        'royalties cobrado','royalties descontado','débito a mais']):
        return 'Reembolso Royalties', 'P2'

    if any(x in c for x in [
        'emitir','emissão','emissao','nota fiscal','notas fiscais',
        'segunda via','nfs pendentes','nf do mes','nf faltando',
        'nota do mês','nf de março','nf de fevereiro']):
        return 'Emissão NF', 'P3'

    return 'Análise Manual', 'P3'

def extrair_links(texto):
    if not texto:
        return []
    urls = re.findall(r'https?://[^\s]+', str(texto))
    result = []
    for url in urls[:3]:
        url = url.rstrip('.,;)')
        if 'spreadsheet' in url:
            label, icon = 'Planilha Google', 'sheet'
        elif 'pipefy' in url:
            label, icon = 'Card Pipefy', 'pipefy'
        elif 'finance.mktlab' in url or 'payment' in url or 'checkout' in url:
            label, icon = 'Link de pagamento', 'payment'
        elif 'docs.google' in url:
            label, icon = 'Documento Google', 'doc'
        else:
            label, icon = 'Link', 'link'
        result.append({'url': url, 'label': label, 'icon': icon})
    return result

def parse_xlsx(filepath, upload_date=None):
    """
    Lê o xlsx e retorna (chamados: list[dict], snapshot: dict, erros: list[str])
    """
    erros = []

    try:
        df = pd.read_excel(filepath)
    except Exception as e:
        return [], {}, [f"Erro ao abrir arquivo: {e}"]

    # Validar colunas obrigatórias
    for col in REQUIRED_COLS:
        if col not in df.columns:
            erros.append(f"Coluna obrigatória não encontrada: '{col}'")
    if erros:
        return [], {}, erros

    if upload_date is None:
        upload_date = datetime.now(timezone.utc).date().isoformat()

    now = datetime.now(timezone.utc)
    chamados = []
    p1 = p2 = p3 = 0
    fora_sla = dentro_sla = 0
    cats = {
        'NF Antecipada': 0, 'Repasse': 0, 'Reembolso Cliente': 0,
        'Cancelamento NF': 0, 'Ajuste NF': 0, 'Finance': 0,
        'Reembolso Royalties': 0, 'Emissão NF': 0, 'Análise Manual': 0,
    }
    total_dias = []

    for _, row in df.iterrows():
        tid = str(row.get('Ticket ID', '') or '').strip()
        if not tid:
            continue

        titulo    = str(row.get('Título', '') or '').strip()
        descricao = str(row.get('Mais informações', '') or '').strip()
        etiqueta  = str(row.get('Etiquetas', '') or '').strip()
        unidade   = str(row.get('Nome da unidade', '') or '').replace('V4 Company ', '').strip()
        usuario   = str(row.get('Usuário Afetado', '') or '').strip()
        especialista = str(row.get('Especialista responsável', '') or '').strip()
        acoes     = str(row.get('Ações que foram tomadas', '') or '').strip()

        criado_raw = row.get('Criado em')
        entrou_raw = row.get('Primeira vez que entrou na fase FINANCEIRO CAF')

        try:
            criado_dt = pd.to_datetime(criado_raw).to_pydatetime()
            if criado_dt.tzinfo is None:
                criado_dt = criado_dt.replace(tzinfo=timezone.utc)
        except:
            criado_dt = now

        try:
            entrou_dt = pd.to_datetime(entrou_raw).to_pydatetime()
            if entrou_dt.tzinfo is None:
                entrou_dt = entrou_dt.replace(tzinfo=timezone.utc)
        except:
            entrou_dt = criado_dt

        dias = round((now - entrou_dt).total_seconds() / 86400, 1)
        total_dias.append(dias)

        cat, prio = categorizar(titulo, descricao, etiqueta, acoes)
        cats[cat] = cats.get(cat, 0) + 1

        if prio == 'P1': p1 += 1
        elif prio == 'P2': p2 += 1
        else: p3 += 1

        # SLA por categoria (horas)
        sla_h = {'NF Antecipada': 4, 'Repasse': 8, 'Reembolso Cliente': 8,
                  'Cancelamento NF': 24, 'Ajuste NF': 24, 'Finance': 24,
                  'Reembolso Royalties': 24, 'Emissão NF': 48}.get(cat, 48)
        if dias > sla_h / 24:
            fora_sla += 1
        else:
            dentro_sla += 1

        # Status interno
        if acoes and acoes not in ('nan', 'None', ''):
            status = 'em_andamento' if 'pipefy' in acoes.lower() else 'pendencia'
        else:
            status = 'nao_iniciado'

        links = extrair_links(descricao)

        chamados.append({
            'ticket_id':        tid,
            'titulo':           titulo[:500],
            'descricao':        descricao[:2000],
            'etiqueta':         etiqueta[:200],
            'unidade':          unidade[:200],
            'usuario_afetado':  usuario[:200],
            'especialista':     especialista[:200],
            'acoes':            acoes[:500],
            'categoria':        cat,
            'subcategoria':     '',
            'prioridade':       prio,
            'status_interno':   status,
            'criado_em':        criado_dt.isoformat(),
            'entrou_financeiro': entrou_dt.isoformat(),
            'dias_na_fila':     dias,
            'upload_date':      upload_date,
            'links':            links,
        })

    total = len(chamados)
    snapshot = {
        'upload_date':           upload_date,
        'total_chamados':        total,
        'p1_urgentes':           p1,
        'fora_sla':              fora_sla,
        'dentro_sla':            dentro_sla,
        'pct_fora_sla':          round(fora_sla / total * 100, 1) if total else 0,
        'media_dias':            round(sum(total_dias) / len(total_dias), 1) if total_dias else 0,
        'max_dias':              round(max(total_dias), 1) if total_dias else 0,
        'total_reembolso':       cats.get('Reembolso Royalties', 0),
        'total_repasse':         cats.get('Repasse', 0),
        'total_nf_antecipada':   cats.get('NF Antecipada', 0),
        'total_emissao_nf':      cats.get('Emissão NF', 0),
        'total_cancelamento_nf': cats.get('Cancelamento NF', 0),
        'total_ajuste_nf':       cats.get('Ajuste NF', 0),
        'total_finance':         cats.get('Finance', 0),
        'total_reembolso_cliente': cats.get('Reembolso Cliente', 0),
        'total_analise_manual':  cats.get('Análise Manual', 0),
    }

    return chamados, snapshot, erros
