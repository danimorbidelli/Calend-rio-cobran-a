"use strict";

/**
 * Conteúdo inicial dos diretórios da Biblioteca (Pitches, Objeções, Estratégias).
 * Ids "lib-*" são reaplicados quando LIB_SEED_VERSION muda (substitui só o
 * conteúdo-modelo; o que a equipe incluir é preservado).
 */
module.exports = [
  // ---------------- PITCHES ----------------
  { id: "lib-pitch-1", dir: "pitch", title: "Abordagem padrão de cobrança",
    body: "Bom dia, [Nome]? Aqui é [analista] da [empresa]. Vi que você tem [N] faturas em aberto, totalizando R$ XXX. O que faz mais sentido pra resolver agora — Pix à vista ou parcelar em até 3x no cartão?" },
  { id: "lib-pitch-2", dir: "pitch", title: "Cobrança + notificação extrajudicial",
    body: "[Nome], aqui é [analista]. Você tem [N] faturas em aberto somando R$ XXX, e recebeu também uma notificação formal sobre isso. Posso te ajudar a resolver agora — Pix à vista ou parcelar em até 3x no cartão. O que prefere?" },
  { id: "lib-pitch-3", dir: "pitch", title: "Fechamento antes da virada de fluxo",
    body: "[Nome], antes de mudarmos pra próxima etapa do processo, queria fechar isso com você hoje — Pix à vista ou parcelamento em até 3x no cartão. Topa resolver agora? Te mando o link na hora." },
  { id: "lib-pitch-4", dir: "pitch", title: "Cancelamento — Regras de ouro & checklist",
    body: "NUNCA dizer: \"Só cancelo se você pagar.\" — cobrança e cancelamento são assuntos paralelos, nunca condicionais.\nSEMPRE: apresentar a cobrança como cuidado (\"pra você não ter problema depois\") e oferecer reunião com o gerente de contas.\n\nOrdem de execução: 1) Acolher o pedido sem travar o processo; 2) Oferecer o link de pagamento como cuidado, nunca como condição; 3) Agendar reunião com o gerente de contas; 4) Seguir o trâmite normal de cancelamento.\n\nChecklist: ☐ Verifiquei valor em aberto? ☐ Ofereci o link sem condicionar? ☐ Agendei reunião com o gerente (dia/horário)? ☐ Segui o trâmite de cancelamento?" },
  { id: "lib-pitch-5", dir: "pitch", title: "Cancelamento — Cliente neutro (sem motivo claro)",
    body: "Compreendo seu pedido e já vou te orientar sobre o processo. Aproveitando que estamos falando, vi aqui que existe um valor em aberto na sua conta — para te poupar de juros ou restrição futura, posso já te enviar o link de pagamento agora? E, antes de finalizarmos, como você é um cliente importante pra gente, já estou acionando a agenda do seu gerente de contas para uma conversa rápida — às vezes ele consegue resolver o que está te incomodando." },
  { id: "lib-pitch-6", dir: "pitch", title: "Cancelamento — Cliente colaborativo",
    body: "Sem problemas, vou seguir com sua solicitação. Só pra já deixar tudo certo do seu lado e não sobrar pendência no seu nome, você consegue regularizar esse valor em aberto comigo agora? E separado disso, vou agendar uma conversa com o gerente de contas — ele costuma trazer alternativas que muita gente não conhece." },
  { id: "lib-pitch-7", dir: "pitch", title: "Cancelamento — Cliente apressado",
    body: "Entendo perfeitamente. Antes de seguir, deixa eu já agendar uma conversa rápida com o seu gerente de contas — ele tem autonomia pra rever condições e muitas vezes resolve o motivo do cancelamento. Posso confirmar [dia/horário]? Aproveito também e te mando o link do valor em aberto, assim você já deixa tudo certinho enquanto aguarda essa conversa." },
  { id: "lib-pitch-8", dir: "pitch", title: "Cancelamento — Cliente insatisfeito",
    body: "Faz sentido você estar incomodado, e é por isso que quero que o gerente de contas fale com você o quanto antes — ele tem mais autonomia que eu pra resolver isso. Vou agendar essa conversa pra [dia]. E só aproveitando: identifiquei um valor pendente aqui, posso te passar o link agora pra você já deixar resolvido?" },

  // ---------------- OBJEÇÕES ----------------
  { id: "lib-obj-1", dir: "objecao", title: "\"Estou sem dinheiro / sem saldo\"",
    body: "Validar a situação e fracionar: \"Entendo. Justamente por isso temos o parcelamento em até 3x no cartão — fica mais leve no mês. Posso simular pra você agora?\" Se persistir, oferecer o menor valor de entrada possível e registrar a promessa com data." },
  { id: "lib-obj-2", dir: "objecao", title: "\"Já paguei\"",
    body: "\"Perfeito, me ajuda a localizar: foi por Pix, boleto ou cartão, e em que data? Pode me enviar o comprovante por aqui que eu já dou baixa e confirmo na hora.\" Nunca confrontar — tratar como verificação conjunta." },
  { id: "lib-obj-3", dir: "objecao", title: "\"Esqueci / não lembrava\"",
    body: "\"Acontece! Já que estamos resolvendo agora, te mando o link e em 1 minuto fica quitado. Prefere Pix à vista ou em até 3x no cartão?\" Oferecer lembrete/recorrência para evitar reincidência." },
  { id: "lib-obj-4", dir: "objecao", title: "\"Estou insatisfeito com o serviço\"",
    body: "Acolher a reclamação e separar do pagamento: \"Faz sentido o seu incômodo e vou registrar isso pro gerente de contas te retornar. Sobre o valor em aberto, pra não virar restrição no seu nome, posso já te enviar o link enquanto resolvemos a parte do serviço?\"" },
  { id: "lib-obj-5", dir: "objecao", title: "Quebra de acordo anterior (renegociação)",
    body: "Tom de retomada de compromisso: \"O que impediu o cumprimento do acordo anterior?\" Para quebra dupla, exigir garantia adicional — cartão como meio de pagamento (não boleto) e registrar a nova promessa com data e valor." },
  { id: "lib-obj-6", dir: "objecao", title: "\"Não tenho como falar agora\"",
    body: "\"Sem problema, é rápido — só pra não deixar a pendência crescer. Te envio o resumo e o link por WhatsApp agora e qual o melhor horário pra eu confirmar com você hoje?\" Agendar retorno com horário definido." },

  // ---------------- ESTRATÉGIAS ----------------
  { id: "lib-estr-1", dir: "estrategia", title: "Ciclo 11–30/06 — visão geral",
    body: "Recuperação ativa (rolagem) de 11 a 26/06, com dias de pico (17, 18 e 25/06) e virada para o fluxo crônico em 29–30/06. Expediente 9h-18h, almoço 12h-13h. Todas as faixas (F1-F4) acionadas todos os dias úteis, cobertura de 100-200% da base/dia (598-1196 toques entre ligação, WhatsApp e e-mail)." },
  { id: "lib-estr-2", dir: "estrategia", title: "Faixas da base (F1-F4)",
    body: "F1 (acima de R$5k): 188 clientes, ticket médio R$7.576. F2 (R$2k-5k): 299 clientes, R$3.416. F3 (R$1k-2k): 92 clientes, R$1.588. F4 (abaixo de R$1k): 19 clientes, R$730. Total: 598 clientes / R$2.605.570,81. Priorizar maiores valores e renegociações no topo de cada faixa." },
  { id: "lib-estr-3", dir: "estrategia", title: "Cenários de conversão (meta R$1,5M)",
    body: "40% (~239 clientes) → R$1.042.228 (69% da meta). 50% (~299) → R$1.302.785 (87%). 60% (~359) → R$1.563.342 (104% — meta atingida dentro do ciclo). Acionamentos são diários; conversão é acumulada no ciclo (quem paga/acorda sai do estoque de pendentes)." },
  { id: "lib-estr-4", dir: "estrategia", title: "Reports de gestão (12h e 18h)",
    body: "12h00 — report de resultados parciais (acionamentos, atendimentos, promessas, pagamentos da manhã). 18h00 — report consolidado do dia + análise de objeções (motivos de recusa mais frequentes), usado para ajustar pitch e priorização do dia seguinte." },
  { id: "lib-estr-5", dir: "estrategia", title: "Cadência multicanal por dia",
    body: "9h00 e-mail automático (saldo atualizado, 100% da base) → 9h05 WhatsApp (simulação até 3x) → blocos de ligação por faixa (F1+F3 manhã, F2+F4 tarde, alternando) → áudio WhatsApp para não atendidos → 16h ação preventiva (reforço de quem prometeu/fechou) → 17h tagueamento e fila do dia seguinte." },
  { id: "lib-estr-6", dir: "estrategia", title: "Virada para crônico (29–30/06)",
    body: "Reforço da notificação extrajudicial (e-mail + carta com AR acima do ponto de corte) para 100% dos casos sem regularização. Link de autoatendimento (simulador de acordo + assinatura digital). Quebra dupla exige cartão como garantia. Meta de formalização ~8-10%." },
];
