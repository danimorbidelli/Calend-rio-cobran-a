# Calendário de Cobrança — Movimento Hora a Hora

Calendário interativo para acompanhar o movimento da equipe de cobrança
**hora a hora**: pitches, objeções, volumetria e demais atividades — com
visões **Dia / Semana / Mês** e **edição compartilhada** entre toda a equipe.

## Como rodar (modo compartilhado — recomendado)

Requer [Node.js](https://nodejs.org) instalado.

```bash
npm install
npm start
```

Acesse **http://localhost:3000**. Para que toda a equipe use o mesmo
calendário, rode o servidor em uma máquina/servidor acessível na rede e os
demais acessam pelo IP dela (ex.: `http://192.168.0.10:3000`). Use a variável
`PORT` para trocar a porta (`PORT=8080 npm start`).

Os dados ficam em `data/events.json` (criado automaticamente). Faça backup
desse arquivo ou use o botão **Exportar**.

## Como usar sem servidor

Basta abrir `public/index.html` direto no navegador. Nesse modo os dados são
salvos só naquele navegador (`localStorage`) — o indicador no topo mostra
**"Offline (local)"**. Quando o servidor está no ar, mostra **"Servidor
conectado"** e as alterações passam a ser compartilhadas.

## Recursos

- **Visões Dia, Semana e Mês**, com navegação (anterior / próximo / hoje).
  - *Dia*: grade hora a hora.
  - *Semana*: grade dias × horas; clique no dia para abrir a visão diária.
  - *Mês*: calendário com indicadores agregados por dia (atividades,
    volumetria, objeções); clique no dia para detalhar.
- **CRUD completo** pelos usuários: incluir, alterar e excluir atividades.
- **Categorias** coloridas: Pitch, Objeção, Volumetria, Movimento, Reunião, Outro.
- Cada atividade registra: data, horário, categoria, título, **responsável**,
  **volumetria (qtd. de contatos)**, **pitch utilizado**, **objeções** e observações.
- **Resumo** do período (dia/semana/mês): atividades, pitches, objeções e
  volumetria somada.
- **Filtros** por categoria e por responsável/equipe.
- Faixa de horário configurável (início/fim).
- **Exportar / Importar** em JSON para backup ou migração.
- Funciona online (compartilhado) com **fallback automático** para uso local.

## Deploy no Render (link público + edição compartilhada)

O repositório já vem com um blueprint (`render.yaml`).

1. Crie uma conta gratuita em https://render.com (pode entrar com o GitHub).
2. **New +** → **Blueprint** → selecione este repositório
   (`danimorbidelli/Calend-rio-cobran-a`) → **Apply**.
   - Ou, sem blueprint: **New +** → **Web Service** → conecte o repo →
     Build Command `npm install`, Start Command `npm start`.
3. Ao final, o Render fornece uma URL pública, ex.:
   `https://calendario-cobranca.onrender.com`. É esse o link de acesso da equipe.

### Persistência dos dados
- No **plano free**, o disco é efêmero: os dados (`data/events.json`) são
  reiniciados a cada novo deploy, e o serviço hiberna após ~15 min sem uso
  (a primeira visita depois disso demora alguns segundos). Ótimo para validar.
- Para **dados duráveis**, edite o `render.yaml`: troque `plan: free` por
  `plan: starter` (pago) e descomente o bloco `disk` + a variável `DATA_DIR`.
  Alternativamente, posso adaptar para um banco de dados — é só pedir.

## Arquitetura

- `server.js` — API REST (Node + Express) e servidor estático. Persistência
  em arquivo JSON, com gravações serializadas e atômicas.
- `public/index.html` — aplicação frontend (HTML + JS puro, sem build).
- Endpoints: `GET/POST /api/events`, `PUT/DELETE /api/events/:id`,
  `POST /api/import`, `GET /api/health`.

## Observações

- Para autenticação por usuário, histórico de auditoria ou banco de dados
  relacional, a base já está pronta para evoluir — é só pedir.
- Se você enviar o rascunho original (`calendario_cobranca_junho.html`),
  consigo incorporar o layout e campos que vocês já tinham.
