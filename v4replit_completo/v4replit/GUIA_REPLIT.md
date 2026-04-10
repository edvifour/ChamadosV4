# V4 Company · Financeiro CAF
## Guia completo: Replit + Supabase — do zero ao ar

---

## PARTE 1 — Supabase (banco de dados)

### 1.1 Criar conta
1. Acesse **supabase.com** e clique em **Start your project**
2. Entre com sua conta Google ou GitHub
3. Clique em **New project**
4. Preencha:
   - **Name:** `v4-financeiro`
   - **Database Password:** crie uma senha forte (anote — vai precisar)
   - **Region:** South America (São Paulo)
5. Clique em **Create new project** e aguarde ~2 minutos

### 1.2 Criar as tabelas
1. No menu esquerdo, clique em **SQL Editor**
2. Clique em **New query**
3. Copie TODO o conteúdo do arquivo `supabase_schema.sql` e cole aqui
4. Clique em **Run** (ou Ctrl+Enter)
5. Deve aparecer "Success. No rows returned" — tabelas criadas

### 1.3 Pegar as credenciais
1. No menu esquerdo, clique em **Project Settings** (ícone de engrenagem)
2. Clique em **API**
3. Copie e guarde esses dois valores:
   - **Project URL** → ex: `https://xyzabc.supabase.co`
   - **anon public** key → string longa começando com `eyJ...`

---

## PARTE 2 — Replit (servidor + frontend)

### 2.1 Criar conta
1. Acesse **replit.com** e clique em **Sign up**
2. Entre com Google (mais rápido)

### 2.2 Criar o projeto
1. Clique em **Create Repl**
2. Escolha **Python** como linguagem
3. Nome: `v4-financeiro-caf`
4. Clique em **Create Repl**

### 2.3 Fazer upload dos arquivos
No painel esquerdo do Replit, você verá os arquivos. Faça upload de cada arquivo:

Clique nos **3 pontinhos** ao lado de "Files" → **Upload file**

Arquivos para fazer upload (todos estão no zip que o Claude gerou):
```
main.py
parse_xlsx.py
requirements.txt
.replit
replit.nix
src/api.js
src/App.jsx
src/data.js      ← deixa vazio por enquanto, o banco vai substituir
src/gemini.js
src/config.js
src/V4Logo.jsx
src/v4logo.svg
src/main.jsx
index.html
vite.config.js
package.json
```

### 2.4 Configurar as variáveis de ambiente (segredos)
1. No painel esquerdo, clique em **Secrets** (ícone de cadeado)
2. Adicione os seguintes segredos:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | URL do seu projeto (ex: `https://xyzabc.supabase.co`) |
| `SUPABASE_KEY` | Chave anon public do Supabase |
| `GEMINI_API_KEY` | Sua chave do Google AI Studio |

> **IMPORTANTE:** Nunca coloque essas chaves diretamente no código.

### 2.5 Instalar dependências Python
No terminal do Replit (aba **Shell** na parte inferior):
```bash
pip install -r requirements.txt
```
Aguarde terminar (pode demorar 1-2 minutos).

### 2.6 Instalar dependências Node (frontend)
No mesmo terminal:
```bash
npm install
```

### 2.7 Fazer o build do frontend
```bash
npm run build
```
Isso gera a pasta `dist/` que o Flask vai servir.

### 2.8 Rodar o projeto
Clique no botão verde **Run** no topo.
Ou no terminal:
```bash
python main.py
```

O Replit vai abrir uma janela de preview. Se aparecer a interface V4, está funcionando.

---

## PARTE 3 — Usar o sistema

### 3.1 Primeiro upload
1. Na sidebar do sistema, clique em **Fazer Upload**
2. Selecione o arquivo `.xlsx` exportado do Pipefy
3. O sistema vai ler, categorizar e salvar no Supabase automaticamente
4. A fila atualiza em tempo real

### 3.2 Próximos uploads (rotina diária)
Cada vez que você exportar uma nova planilha do Pipefy:
1. Clique em **Fazer Upload** no sistema
2. Selecione o novo `.xlsx`
3. O sistema detecta a data automaticamente e salva como novo snapshot
4. O histórico é preservado — você pode comparar com dias anteriores

### 3.3 Ver histórico
- No Dashboard Gerencial, selecione uma data passada no seletor
- O comparativo "hoje vs ontem" aparece automaticamente
- Clique em qualquer chamado → aba "Histórico" mostra a evolução dia a dia

---

## PARTE 4 — Deixar no ar permanentemente (deploy)

O Replit gratuito "dorme" após inatividade. Para manter acordado:

### Opção gratuita: UptimeRobot
1. Acesse **uptimerobot.com** e crie conta gratuita
2. Clique em **Add New Monitor**
3. Tipo: **HTTP(s)**
4. URL: `https://seu-repl.seu-usuario.repl.co/api/health`
5. Intervalo: **5 minutes**
6. Salve — o UptimeRobot vai "pingar" o servidor a cada 5min, mantendo vivo

### Opção paga: Replit Core (~$7/mês)
- Always-on garantido
- Mais performance
- Domínio personalizado

---

## PARTE 5 — Estrutura do banco (referência)

### Tabela `chamados`
Cada upload substitui os chamados daquele dia.
| Campo | Tipo | Descrição |
|-------|------|-----------|
| ticket_id | text | ID do ticket no Pipefy |
| categoria | text | Categoria calculada pela IA |
| prioridade | text | P1 / P2 / P3 |
| dias_na_fila | number | Calculado na hora do upload |
| upload_date | date | Data do upload |

### Tabela `snapshots`
Uma linha por dia — foto do estado da fila.
| Campo | Tipo | Descrição |
|-------|------|-----------|
| upload_date | date | Data (chave única) |
| total_chamados | int | Total na fila |
| p1_urgentes | int | Chamados P1 |
| fora_sla | int | Chamados atrasados |
| total_reembolso | int | Por categoria... |

### Tabela `historico_chamados`
Acumula — nunca apaga. Guarda o estado de cada ticket em cada upload.
| Campo | Tipo | Descrição |
|-------|------|-----------|
| ticket_id | text | ID do ticket |
| upload_date | date | Data do registro |
| dias_na_fila | number | Dias naquela data |
| categoria | text | Categoria naquela data |

---

## Dúvidas frequentes

**O upload deu erro "coluna não encontrada"**
→ A planilha precisa ter exatamente estas colunas:
`Ticket ID`, `Título`, `Mais informações`, `Etiquetas`, `Usuário Afetado`,
`Nome da unidade`, `Ações que foram tomadas`, `Especialista responsável`,
`Criado em`, `Primeira vez que entrou na fase FINANCEIRO CAF`

**O resumo IA não aparece**
→ Configure a `GEMINI_API_KEY` nos Secrets do Replit.
Vá em aistudio.google.com → Get API key → gere uma chave nova.

**O sistema ficou lento / adormeceu**
→ Configure o UptimeRobot conforme Parte 4.

**Quero adicionar um novo especialista ou mudar a lógica de triagem**
→ Edite o arquivo `parse_xlsx.py`, função `categorizar()`.
As regras são em Python simples, fácil de ajustar.
