"""
V4 Company · Financeiro CAF
Backend Flask — API para o frontend React
"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os, json
from datetime import datetime, timezone
from parse_xlsx import parse_xlsx

# ── Supabase ──────────────────────────────────────────────────────────────
from supabase import create_client

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

def get_sb():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise Exception("Variáveis SUPABASE_URL e SUPABASE_KEY não configuradas.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# ── App ───────────────────────────────────────────────────────────────────
app = Flask(__name__, static_folder='dist', static_url_path='')
CORS(app)

# Servir o frontend React (build)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# ─────────────────────────────────────────────────────────────────────────
# POST /api/upload
# Recebe o arquivo XLSX, parseia, salva no Supabase
# ─────────────────────────────────────────────────────────────────────────
@app.route('/api/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    f = request.files['file']
    if not f.filename.endswith(('.xlsx', '.xls', '.csv')):
        return jsonify({'error': 'Formato inválido. Use .xlsx, .xls ou .csv'}), 400

    upload_date = request.form.get('upload_date', datetime.now(timezone.utc).date().isoformat())

    # Salvar temporariamente
    tmp_path = f'/tmp/upload_{datetime.now().timestamp()}.xlsx'
    f.save(tmp_path)

    try:
        chamados, snapshot, erros = parse_xlsx(tmp_path, upload_date)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    if erros:
        return jsonify({'error': 'Erros no arquivo', 'detalhes': erros}), 422

    sb = get_sb()

    # 1. Upsert snapshot do dia
    sb.table('snapshots').upsert(snapshot, on_conflict='upload_date').execute()

    # 2. Deletar chamados do mesmo dia (substituir pela versão nova)
    sb.table('chamados').delete().eq('upload_date', upload_date).execute()

    # 3. Inserir todos os chamados em lotes de 50
    links_map = {}
    for c in chamados:
        links_map[c['ticket_id']] = c.pop('links', [])

    batch_size = 50
    for i in range(0, len(chamados), batch_size):
        sb.table('chamados').insert(chamados[i:i+batch_size]).execute()

    # 4. Inserir histórico (append — nunca sobrescreve)
    historico = [{
        'ticket_id':    c['ticket_id'],
        'upload_date':  upload_date,
        'dias_na_fila': c['dias_na_fila'],
        'categoria':    c['categoria'],
        'prioridade':   c['prioridade'],
        'status_interno': c['status_interno'],
        'especialista': c['especialista'],
        'acoes':        c['acoes'],
    } for c in chamados]

    for i in range(0, len(historico), batch_size):
        sb.table('historico_chamados').insert(historico[i:i+batch_size]).execute()

    return jsonify({
        'sucesso': True,
        'total_importados': len(chamados),
        'upload_date': upload_date,
        'snapshot': snapshot,
    })

# ─────────────────────────────────────────────────────────────────────────
# GET /api/chamados?date=YYYY-MM-DD
# ─────────────────────────────────────────────────────────────────────────
@app.route('/api/chamados')
def get_chamados():
    sb = get_sb()
    date = request.args.get('date')

    if date:
        res = sb.table('chamados').select('*').eq('upload_date', date).order('prioridade').order('dias_na_fila', desc=True).execute()
    else:
        # Pega o upload mais recente
        snap = sb.table('snapshots').select('upload_date').order('upload_date', desc=True).limit(1).execute()
        if not snap.data:
            return jsonify([])
        latest = snap.data[0]['upload_date']
        res = sb.table('chamados').select('*').eq('upload_date', latest).order('prioridade').order('dias_na_fila', desc=True).execute()

    return jsonify(res.data)

# ─────────────────────────────────────────────────────────────────────────
# GET /api/snapshots
# Lista todos os snapshots ordenados
# ─────────────────────────────────────────────────────────────────────────
@app.route('/api/snapshots')
def get_snapshots():
    sb = get_sb()
    res = sb.table('snapshots').select('*').order('upload_date', desc=True).execute()
    return jsonify(res.data)

# ─────────────────────────────────────────────────────────────────────────
# GET /api/historico/<ticket_id>
# Evolução de um chamado ao longo dos dias
# ─────────────────────────────────────────────────────────────────────────
@app.route('/api/historico/<ticket_id>')
def get_historico(ticket_id):
    sb = get_sb()
    res = sb.table('historico_chamados').select('*').eq('ticket_id', ticket_id).order('upload_date').execute()
    return jsonify(res.data)

# ─────────────────────────────────────────────────────────────────────────
# GET /api/comparativo
# Hoje vs ontem
# ─────────────────────────────────────────────────────────────────────────
@app.route('/api/comparativo')
def get_comparativo():
    sb = get_sb()
    res = sb.table('snapshots').select('*').order('upload_date', desc=True).limit(2).execute()
    if len(res.data) < 2:
        return jsonify({'hoje': res.data[0] if res.data else None, 'ontem': None})
    return jsonify({'hoje': res.data[0], 'ontem': res.data[1]})

# ─────────────────────────────────────────────────────────────────────────
# GET /api/health
# ─────────────────────────────────────────────────────────────────────────
@app.route('/api/health')
def health():
    try:
        sb = get_sb()
        sb.table('snapshots').select('id').limit(1).execute()
        return jsonify({'status': 'ok', 'supabase': 'conectado'})
    except Exception as e:
        return jsonify({'status': 'erro', 'detalhe': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
