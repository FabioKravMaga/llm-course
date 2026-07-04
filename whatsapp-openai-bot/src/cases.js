export const CASE_TYPE_IDS = [
  'golpe_pix',
  'vinculo_trabalhista',
  'restabelecimento_auxilio',
  'aposentadoria_invalidez',
  'planejamento_previdenciario',
  'revisao_aposentadoria',
  'midias_sociais',
  'outro'
];

export const CASES = {
  golpe_pix: {
    number: 1,
    label: 'Fui vítima de golpe/fraude (Pix, boleto falso, clonagem)',
    keywords: /pix|fraude|golpe|clona|transferi|boleto fals|roub|estelionato|conta invadida/i,
    thesis: [
      'Entendo a situação, e é mais comum do que parece. 😔',
      `O que você viveu tem respaldo jurídico sólido. A justiça reconhece a *responsabilidade objetiva do banco* — isso significa que o banco pode ser responsabilizado mesmo sem culpa direta, porque tem obrigação de garantir a segurança do sistema.

✅ Em casos como o seu, buscamos:
• Devolução de *100% do valor transferido*
• *Indenização por dano moral*
• Bloqueio imediato de negativações

Para confirmar se o seu caso tem os mesmos elementos, preciso de 3 informações:

1️⃣ Qual banco?
2️⃣ Qual foi o valor perdido?
3️⃣ Você já registrou boletim de ocorrência?`
    ],
    proposal: `Com base no que você me contou, o caso tem *fundamento jurídico sólido*. ✅

*O que fazemos:*
• Notificação extrajudicial ao banco (resultado rápido em muitos casos)
• Ajuizamento da ação se não houver acordo
• Acompanhamento completo até o recebimento

*Modelo de honorários:* apenas em caso de êxito — você não paga nada adiantado.

Posso preparar o contrato agora para você analisar sem compromisso. Qual é o seu nome completo?`,
    feeModel: 'apenas em caso de êxito — sem custo antecipado',
    scope: 'Ação de responsabilidade civil contra a instituição financeira, buscando devolução integral dos valores transferidos e indenização por dano moral.',
    followUp: {
      socialProof:
        'essa semana tivemos uma decisão favorável em um caso de golpe bancário — o cliente vai recuperar o valor com correção',
      urgency:
        'quanto mais tempo passa, mais difícil fica rastrear o dinheiro e reunir as provas da falha do banco'
    }
  },

  vinculo_trabalhista: {
    number: 2,
    label: 'Trabalhei sem carteira assinada e quero reconhecer meu vínculo',
    keywords:
      /sem carteira|carteira assinada|vínculo|vinculo|clt|registro.*trabalho|trabalhei.*sem registro|informal|reconhecimento.*emprego|verbas trabalhistas|fgts.*não.*deposit/i,
    thesis: [
      'Você fez bem em procurar. Trabalhar sem registro é mais comum do que deveria — e a lei está do seu lado. 💼',
      `Se você trabalhou com *habitualidade, subordinação, pessoalidade e recebendo salário*, a Justiça do Trabalho pode *reconhecer o vínculo de emprego* mesmo sem carteira assinada (art. 3º da CLT).

✅ Com o reconhecimento do vínculo, você pode receber:
• *Anotação na carteira* de todo o período trabalhado
• *FGTS* de todos os meses + multa de 40%
• *13º salário, férias + 1/3* de todo o período
• *Verbas rescisórias* completas se foi dispensado
• Recolhimento do *INSS* (conta para aposentadoria!)

Para analisar seu caso, me conta:

1️⃣ Por quanto tempo trabalhou? (de quando a quando)
2️⃣ Qual era a função e o salário combinado?
3️⃣ Tem provas do trabalho? (mensagens, fotos, testemunhas, comprovantes de pagamento)`
    ],
    proposal: `Com base no seu relato, há *bons elementos para o reconhecimento do vínculo*. ✅

*O que fazemos:*
• Levantamento e organização de todas as provas
• Cálculo completo de todas as verbas devidas (FGTS, 13º, férias, rescisão)
• Ajuizamento da reclamação trabalhista no TRT
• Acompanhamento em audiência até o final

*Modelo de honorários:* percentual apenas sobre o que você *efetivamente receber* — sem êxito, sem custo.

Posso preparar o contrato agora. Qual é o seu nome completo?`,
    feeModel: 'percentual sobre o valor efetivamente recebido — sem êxito, sem custo',
    scope:
      'Reclamação trabalhista para reconhecimento de vínculo empregatício e cobrança das verbas devidas (FGTS, 13º, férias, rescisão).',
    followUp: {
      socialProof:
        'recentemente conseguimos o reconhecimento de vínculo de um cliente que trabalhou 4 anos sem registro — ele vai receber FGTS, 13º e férias de todo o período',
      urgency:
        'os direitos trabalhistas prescrevem: você só pode cobrar os últimos 5 anos, e tem até 2 anos após a saída para entrar com a ação'
    }
  },

  restabelecimento_auxilio: {
    number: 3,
    label: 'Meu auxílio-doença foi cortado pelo INSS e quero restabelecer',
    keywords:
      /auxílio.doença|auxilio.doença|auxilio.doenca|benefício cortad|beneficio cortad|inss cortou|cessou.*benefício|perícia.*cortou|alta.*inss|restabelec/i,
    thesis: [
      'Sinto muito pelo que está passando — ter o benefício cortado quando ainda não se recuperou é uma situação muito difícil. 🙏',
      `A boa notícia: se você *ainda está incapacitado para o trabalho*, o corte do INSS pode ser revertido na justiça. Isso se chama *restabelecimento do auxílio por incapacidade temporária*.

✅ Com a ação, buscamos:
• *Restabelecimento imediato* do benefício (pedido de liminar/tutela)
• Pagamento de *todas as parcelas atrasadas* desde o corte
• Nova perícia com *médico judicial independente* (não o do INSS)

Para avaliar seu caso, preciso saber:

1️⃣ Qual é o problema de saúde? (doença/lesão)
2️⃣ Quando o INSS cortou o benefício?
3️⃣ Você tem laudos e atestados médicos recentes?`
    ],
    proposal: `Analisando o que você relatou, há *boa perspectiva de restabelecimento*. ✅

*O que fazemos:*
• Organização de todo o histórico médico e documentação
• Ação judicial com *pedido de liminar* para restabelecer o benefício rapidamente
• Acompanhamento da perícia judicial
• Cobrança de todas as parcelas atrasadas

*Modelo de honorários:* percentual sobre as parcelas atrasadas recebidas — você não paga nada do próprio bolso.

Posso preparar o contrato agora. Qual é o seu nome completo?`,
    feeModel: 'percentual sobre as parcelas atrasadas recebidas — sem custo antecipado',
    scope:
      'Ação de restabelecimento de auxílio por incapacidade temporária, com pedido de tutela de urgência e cobrança de parcelas em atraso.',
    followUp: {
      socialProof:
        'essa semana um cliente teve o auxílio restabelecido por liminar — voltou a receber em poucas semanas, com os atrasados garantidos',
      urgency:
        'cada mês sem o benefício é um mês de renda perdida — e os laudos médicos recentes são a prova mais forte que você tem agora'
    }
  },

  aposentadoria_invalidez: {
    number: 4,
    label:
      'Recebo auxílio-doença mas não tenho condições de voltar a trabalhar (aposentadoria por invalidez)',
    keywords:
      /invalidez|incapacidade permanente|converter.*aposentadoria|aposentadoria.*invalidez|não consigo mais voltar|nunca mais.*trabalhar/i,
    thesis: [
      'Entendo. Quando a recuperação não é mais possível, existe um caminho legal mais adequado para você. 🤝',
      `Se a sua incapacidade para o trabalho é *permanente* — sem perspectiva de recuperação ou reabilitação para outra função — você pode ter direito à *conversão do auxílio-doença em aposentadoria por incapacidade permanente* (antiga aposentadoria por invalidez).

✅ Vantagens da conversão:
• Benefício *sem prazo de revisão constante* como o auxílio
• Possibilidade de *acréscimo de 25%* se precisar de ajuda de terceiro para atividades diárias
• *Estabilidade* e segurança financeira definitiva

Para avaliar a viabilidade, me conta:

1️⃣ Qual é a doença ou lesão?
2️⃣ Há quanto tempo recebe o auxílio-doença?
3️⃣ Os médicos indicam possibilidade de recuperação ou reabilitação?`
    ],
    proposal: `Pelo seu relato, há *elementos para buscar a conversão em aposentadoria permanente*. ✅

*O que fazemos:*
• Análise completa dos laudos e do histórico do benefício
• Ação judicial de conversão com acompanhamento pericial
• Pedido do *adicional de 25%* quando cabível
• Acompanhamento até a implantação definitiva

*Modelo de honorários:* percentual sobre os valores retroativos recebidos — sem custo antecipado.

Posso preparar o contrato agora. Qual é o seu nome completo?`,
    feeModel: 'percentual sobre os retroativos recebidos — sem custo antecipado',
    scope:
      'Ação de conversão de auxílio-doença em aposentadoria por incapacidade permanente, com pedido de adicional de 25% quando cabível.',
    followUp: {
      socialProof:
        'recentemente um cliente conseguiu a conversão para aposentadoria permanente com o adicional de 25% — segurança definitiva para a família',
      urgency:
        'enquanto o benefício continua como auxílio temporário, você fica sujeito a cortes em cada revisão do INSS'
    }
  },

  planejamento_previdenciario: {
    number: 5,
    label: 'Quero planejar minha aposentadoria da melhor forma',
    keywords:
      /planejamento previdenci|quando.*aposentar|posso me aposentar|tempo de contribuição|cnis|regra de transição|simulaç.*aposentadoria|melhor aposentadoria/i,
    thesis: [
      'Excelente decisão! Planejar a aposentadoria com antecedência pode significar *anos a menos de contribuição* ou *um benefício muito maior*. 📊',
      `O *planejamento previdenciário* é um estudo técnico completo do seu histórico de contribuições que responde:

✅ *Quando* você pode se aposentar (em cada regra disponível)
✅ *Qual regra* dá o melhor benefício no seu caso
✅ Se vale a pena *pagar contribuições em atraso* ou complementar
✅ Se há *períodos não computados* (trabalho especial, rural, militar, tempo sem registro)
✅ Simulação do *valor exato* do benefício em cada cenário

Muitos clientes descobrem que podem se aposentar *antes do que imaginavam* — ou que esperando alguns meses o valor sobe significativamente.

Para começar, me diz:

1️⃣ Qual sua idade e desde quando contribui?
2️⃣ Sempre trabalhou com carteira assinada ou teve períodos como autônomo/rural?
3️⃣ Você tem acesso ao seu CNIS ou senha do Meu INSS?`
    ],
    proposal: `Perfeito! Vamos montar o seu *estudo previdenciário completo*. ✅

*O que você recebe:*
• Análise integral do CNIS e correção de pendências
• Simulação de *todos os cenários* de aposentadoria disponíveis
• Relatório com a *melhor data e melhor regra* para o seu caso
• Plano de ação: o que fazer (e o que evitar) até lá

*Investimento:* valor fixo pelo estudo — informado após a análise preliminar gratuita do seu CNIS.

Posso dar início agora. Qual é o seu nome completo?`,
    feeModel: 'valor fixo pelo estudo, apresentado após análise preliminar gratuita do CNIS',
    scope:
      'Elaboração de planejamento previdenciário: análise do CNIS, simulação de cenários de aposentadoria e relatório com a melhor estratégia.',
    followUp: {
      socialProof:
        'um cliente descobriu no estudo que podia se aposentar 3 anos antes do que imaginava — só organizando períodos que não estavam no CNIS',
      urgency:
        'as regras de transição mudam os cálculos a cada ano — o cenário que vale hoje pode não ser o melhor daqui a alguns meses'
    }
  },

  revisao_aposentadoria: {
    number: 6,
    label:
      'Já sou aposentado e quero revisar meu benefício (incluindo ganhos de ação trabalhista no cálculo)',
    keywords:
      /revis(ar|ão|ao).*aposent|aposentadoria.*revis|revis(ar|ão|ao).*benef|benef.*revis|ganhei.*trabalhista.*aposent|ação trabalhista.*inss|acao trabalhista.*inss|incluir.*trabalhista.*c[aá]lculo|verbas.*reconhecidas.*aposent|salário.*maior.*aposentadoria|recalcul.*aposent/i,
    thesis: [
      'Ótima iniciativa! Muitos aposentados recebem menos do que teriam direito — e isso pode ser corrigido. 📈',
      `A *revisão de aposentadoria* verifica se o INSS calculou seu benefício corretamente. Um dos casos mais fortes é quando você *ganhou uma ação trabalhista* (vínculo ou verbas reconhecidas) e esses valores *não entraram no cálculo* do seu benefício.

✅ Com a revisão, buscamos:
• *Recálculo do benefício* incluindo os salários e períodos reconhecidos na Justiça do Trabalho
• *Aumento definitivo* do valor mensal da aposentadoria
• Pagamento das *diferenças retroativas* (até 5 anos para trás)

Para avaliar seu caso, me conta:

1️⃣ Quando você se aposentou e qual o valor atual do benefício?
2️⃣ Você teve alguma ação trabalhista ganha? (vínculo, salário, verbas reconhecidas)
3️⃣ Tem a sentença ou os documentos da ação trabalhista?`
    ],
    proposal: `Pelo que você relatou, há *bons elementos para a revisão do seu benefício*. ✅

*O que fazemos:*
• Análise do cálculo original do INSS e da sentença trabalhista
• Recálculo do benefício com a inclusão dos valores reconhecidos
• Pedido administrativo e, se necessário, ação judicial de revisão
• Cobrança das *diferenças retroativas* dos últimos 5 anos

*Modelo de honorários:* percentual sobre as diferenças retroativas recebidas — sem custo antecipado.

Posso preparar o contrato agora. Qual é o seu nome completo?`,
    feeModel: 'percentual sobre as diferenças retroativas recebidas — sem custo antecipado',
    scope:
      'Revisão de benefício previdenciário com inclusão de verbas e períodos reconhecidos em ação trabalhista no cálculo, cobrança das diferenças retroativas e majoração definitiva da renda mensal.',
    followUp: {
      socialProof:
        'recentemente um cliente aposentado incluiu no cálculo os salários reconhecidos numa ação trabalhista — o benefício subiu e ele recebeu as diferenças de 5 anos de uma vez',
      urgency:
        'as diferenças retroativas prescrevem: cada mês que passa é um mês de atrasados que você perde o direito de cobrar'
    }
  },

  midias_sociais: {
    number: 7,
    label: 'Preciso de ajuda com mídias sociais — parceria SmartAdv (gestão, conteúdo, presença digital)',
    keywords:
      /mídias sociais|midias sociais|smartadv|smart adv|instagram|rede social|redes sociais|conteúdo|conteudo|seguidores|marketing digital|presença digital|stories|reels/i,
    thesis: [
      'Que bom que chegou até aqui! 🚀',
      `Em parceria com a *SmartAdv*, ajudamos profissionais e negócios a construírem *presença digital estratégica*: posicionamento, conteúdo que atrai clientes e sistemas de captação pelo Instagram e WhatsApp.

✅ O que entregamos:
• *Estratégia de conteúdo* personalizada para o seu nicho
• *Criativos e roteiros* para posts, Reels e Stories
• *Sistema de captação* de clientes via redes sociais
• Estruturação de *funil de atendimento* automatizado

Para entender como podemos ajudar, me conta:

1️⃣ Qual é o seu negócio ou área de atuação?
2️⃣ Você já produz conteúdo hoje? Em quais redes?
3️⃣ Qual seu principal objetivo? (mais seguidores, mais clientes, autoridade)`
    ],
    proposal: `Ótimo! Com base no seu perfil, temos um caminho claro para acelerar seus resultados — em parceria com a *SmartAdv*. ✅

*Como funciona:*
• Diagnóstico gratuito da sua presença digital atual
• Proposta de estratégia personalizada (conteúdo + captação)
• Acompanhamento mensal com métricas e ajustes, com a equipe SmartAdv

*Investimento:* planos a partir de valor mensal fixo — apresentados no diagnóstico.

Posso agendar seu diagnóstico gratuito. Qual é o seu nome completo?`,
    feeModel: 'plano mensal fixo (parceria SmartAdv) — valor apresentado após diagnóstico gratuito',
    scope:
      'Consultoria e gestão de presença digital em parceria com a SmartAdv: estratégia de conteúdo, criativos, sistema de captação e acompanhamento mensal.',
    followUp: {
      socialProof:
        'um cliente que começou o acompanhamento há 3 meses já está captando clientes direto pelo Instagram, sem depender de indicação',
      urgency:
        'cada semana sem estratégia é espaço que a concorrência ocupa no seu nicho'
    }
  },

  outro: {
    number: 8,
    label: 'Outro assunto',
    keywords: /outro|outra coisa|diferente/i,
    thesis: [
      'Obrigado por compartilhar sua situação.',
      `Vou verificar com nossa equipe qual é a melhor linha de atuação para o seu caso.

Pode me dar mais detalhes sobre o que aconteceu? Quanto mais informações você compartilhar, mais rápido conseguimos te dar uma resposta precisa.`
    ],
    proposal: `Com base no que você me contou, vou preparar uma proposta personalizada. ✅

Nossa equipe vai analisar seu caso e retornar em breve com o modelo de atuação e valores adequados.

Posso adiantar o contato registrando seus dados. Qual é o seu nome completo?`,
    feeModel: 'a definir após análise do caso',
    scope: 'Atuação a ser definida após análise detalhada do caso pela equipe.',
    followUp: {
      socialProof:
        'nossa equipe já resolveu situações em diversas áreas — mesmo casos que pareciam sem solução tiveram um caminho',
      urgency: 'quanto antes começamos a analisar, mais opções estratégicas você tem em mãos'
    }
  }
};

export const MENU_CASOS = `Para agilizar, você se identifica em alguma dessas situações?

1️⃣ *Fui vítima de golpe/fraude* (Pix, boleto falso, clonagem)
2️⃣ *Trabalhei sem carteira assinada* e quero reconhecer meu vínculo
3️⃣ *Meu auxílio-doença foi cortado* pelo INSS e quero restabelecer
4️⃣ *Recebo auxílio-doença* mas não tenho condições de voltar a trabalhar (aposentadoria por invalidez)
5️⃣ *Quero planejar minha aposentadoria* da melhor forma
6️⃣ *Já sou aposentado e quero revisar meu benefício* (incluir ganhos de ação trabalhista no cálculo)
7️⃣ *Preciso de ajuda com mídias sociais* — parceria SmartAdv (gestão, conteúdo, presença digital)
8️⃣ *Outro assunto*

Responda com o número ou descreva sua situação.`;

export function findCase(id) {
  return CASES[id] || null;
}

export function detectCaseFromText(text) {
  const trimmed = String(text || '').trim();
  const numeric = trimmed.match(/^([1-8])\b/);
  if (numeric) {
    const idx = Number(numeric[1]) - 1;
    return CASE_TYPE_IDS[idx] || null;
  }
  const lower = trimmed.toLowerCase();
  const order = [
    'revisao_aposentadoria',
    'aposentadoria_invalidez',
    'restabelecimento_auxilio',
    'planejamento_previdenciario',
    'vinculo_trabalhista',
    'midias_sociais',
    'golpe_pix',
    'outro'
  ];
  for (const id of order) {
    if (CASES[id].keywords.test(lower)) return id;
  }
  return null;
}
