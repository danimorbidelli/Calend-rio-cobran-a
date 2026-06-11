# Calendário de Cobrança — Movimento Hora a Hora

Aplicação de página única (HTML + JS, sem servidor) para acompanhar o
movimento da equipe de cobrança **hora a hora**: pitches, objeções,
volumetria e demais atividades.

## Como usar

Abra o arquivo [`index.html`](index.html) em qualquer navegador. Não precisa
de instalação nem internet.

## Recursos

- **Grade hora a hora** por dia, com navegação de datas (anterior / próximo / hoje).
- **CRUD completo** pelos usuários: incluir, alterar e excluir atividades.
- **Categorias** com cores: Pitch, Objeção, Volumetria, Movimento, Reunião, Outro.
- Cada atividade registra: horário, categoria, título, **responsável**,
  **volumetria (qtd. de contatos)**, **pitch utilizado**, **objeções** e observações.
- **Resumo do dia**: total de atividades, pitches, objeções e volumetria somada.
- **Filtros** por categoria e por responsável/equipe.
- Faixa de horário configurável (início/fim).
- **Persistência automática** no navegador (`localStorage`).
- **Exportar / Importar** em JSON para backup ou compartilhamento entre máquinas.

## Observações

- Os dados ficam salvos no navegador de cada usuário. Para trabalho
  compartilhado entre várias pessoas em tempo real, seria necessário um
  backend (banco de dados / API) — posso evoluir nessa direção se desejado.
- Este projeto foi montado a partir da descrição do fluxo de cobrança. Se você
  enviar o rascunho original (`calendario_cobranca_junho.html`), consigo
  incorporar o layout e os campos já existentes.
