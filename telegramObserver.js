class TelegramBotObserver {
  constructor(bot, chatId) {
    this.bot = bot;
    this.chatId = chatId;
    this.messageIdListaJogadores = null;
    this.lobbyMessageIds = [];
    this.votacaoMessageId = null;
    this.julgamentoMessageId = null;
  }

  update(evento, dados, jogo) {
    switch (evento) {
      case "sala_criada":
        this.bot
          .sendMessage(
            this.chatId,
            `A sala ${jogo.nome} foi criada. Use o botão para entrar.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "Entrar na sala",
                      url: `https://t.me/${dados.usernameBot}?start=${dados.link}`,
                    },
                  ],
                ],
              },
            }
          )
          .then((msg) => {
            this.lobbyMessageIds.push(msg.message_id);
          });

        this.bot.sendMessage(this.chatId, `Jogadores: 0\n`).then((msg) => {
          this.messageIdListaJogadores = msg.message_id;
        });
        break;

      case "jogador_entrou":
        this.bot.sendMessage(
          dados.jogadorId,
          `Você entrou na sala ${jogo.nome}.`
        );
        if (this.messageIdListaJogadores) {
          const textoLista =
            `Jogadores: ${jogo.jogadores.length}\n` +
            jogo.jogadores.map((j) => j.nome).join(`\n`);
          this.bot.editMessageText(textoLista, {
            chat_id: this.chatId,
            message_id: this.messageIdListaJogadores,
          });
        }
        break;

      case "sala_cheia":
        this.bot.sendMessage(dados.jogadorId, "A sala já está cheia.");
        break;

      case "jogador_ja_existe":
        this.bot.sendMessage(dados.jogadorId, "Você já está na sala.");
        break;

      case "falha_ao_iniciar":
        this.bot.sendMessage(
          this.chatId,
          `A sala ${jogo.nome} foi excluída por não ter atingido o número mínimo de jogadores.`
        );

        this.lobbyMessageIds.forEach((id) => {
          this.bot
            .deleteMessage(this.chatId, id)
            .catch((err) =>
              console.log(
                "Não foi possível apagar a mensagem, talvez já tenha sido removida."
              )
            );
        });

        break;

      case "jogo_iniciando":
        this.bot.sendMessage(
          this.chatId,
          `O jogo já vai começar. Aguarde enquanto os papéis são distribuídos.`
        );

        this.lobbyMessageIds.forEach((id) => {
          this.bot
            .deleteMessage(this.chatId, id)
            .catch((err) =>
              console.log(
                "Não foi possível apagar a mensagem, talvez já tenha sido removida."
              )
            );
        });

        break;

      case "papeis_distribuidos":
        jogo.jogadores.forEach((jogadorInfo) => {
          const jogador = jogadorInfo.jogador;
          const papel = jogadorInfo.papel;
          const nomeFicticio = jogador.nomeFicticio;

          let mensagem =
            `Olá, ${jogador.nome}!\n\n` +
            `Seu nome no jogo é: *${nomeFicticio}*.\n` +
            `Seu papel é: *${papel.nome}*.\n` +
            `Alinhamento: ${papel.alignment}.\n\n`;
          if (papel.nome === "Executioner" && jogadorInfo.alvoExecutioner) {
            mensagem += `Seu alvo é *${jogadorInfo.alvoExecutioner}*. Sua missão é fazer com que a cidade o linche!\n\n`;
          }
          mensagem += `Aguarde o início do primeiro dia.`;

          this.bot.sendMessage(jogador.id, mensagem, {
            parse_mode: "Markdown",
          });
        });
        this.bot.sendMessage(
          this.chatId,
          "Os papéis foram distribuídos! O jogo começa agora. Que se inicie o primeiro dia!"
        );
        break;

      case "dia_iniciou":
        let mensagemDia = `*Dia ${dados.dia}*\n\n`;
        if (dados.dia > 1 && dados.mortes.length > 0) {
          mensagemDia += `A noite passada foi agitada. *${dados.mortes.join(
            ", "
          )}* foi encontrado(a) morto(a).\n\n`;
        } else if (dados.dia > 1) {
          mensagemDia += "A noite foi calma e ninguém morreu.\n\n";
        }
        mensagemDia +=
          "Os seguintes jogadores estão vivos:\n" +
          dados.jogadoresVivos
            .map((j) => `- ${j.jogador.nomeFicticio}`)
            .join(`\n`);
        mensagemDia += "\n\nVocês têm 2 minutos para discutir.";
        this.bot.sendMessage(this.chatId, mensagemDia, {
          parse_mode: "Markdown",
        });

        if (dados.resultadosPrivados && dados.resultadosPrivados.length > 0) {
          dados.resultadosPrivados.forEach((resultado) => {
            this.bot.sendMessage(resultado.jogadorId, resultado.mensagem, {
              parse_mode: "Markdown",
            });
          });
        }

        jogo.jogadores.forEach((p) => {
          if (
            p.status === "morto" &&
            p.papel.nome === "Medium" &&
            !jogo.mediumsQueUsaramSeance.has(p.jogador.id)
          ) {
            this.bot.sendMessage(
              p.jogador.id,
              "Você está morto, mas tem uma última chance de falar com os vivos. Use /seance [nome] durante o dia para escolher um alvo para contatar esta noite."
            );
          }
        });
        break;

      case "votacao_iniciou":
        if (this.votacaoMessageId) {
          this.bot
            .deleteMessage(this.chatId, this.votacaoMessageId)
            .catch(() => {});
        }

        const tecladoVotacao = dados.jogadoresVivos.map((j) => [
          {
            text: j.jogador.nomeFicticio,
            callback_data: `votar_${j.jogador.nomeFicticio}`,
          },
        ]);

        this.bot
          .sendMessage(
            this.chatId,
            "A votação começou! Escolham quem vocês querem levar a julgamento. Vocês têm 1 minuto.",
            {
              reply_markup: {
                inline_keyboard: tecladoVotacao,
              },
            }
          )
          .then((msg) => {
            this.votacaoMessageId = msg.message_id;
          });
        break;

      case "voto_registrado":
        // Opcional: Anunciar cada voto para tornar a votação aberta
        this.bot.sendMessage(
          this.chatId,
          `️️✔️ ${dados.votador} votou em ${dados.alvo}.`
        );
        break;

      case "votacao_sem_julgamento":
        this.bot.sendMessage(
          this.chatId,
          "A votação terminou em empate ou ninguém recebeu votos suficientes. Ninguém irá a julgamento hoje."
        );
        break;

      case "defesa_iniciou":
        this.bot.sendMessage(
          this.chatId,
          `O povo de Salem decidiu! *${dados.acusado.jogador.nomeFicticio}* foi levado(a) à forca. Você tem 30 segundos para se defender.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "julgamento_iniciou":
        if (this.julgamentoMessageId) {
          this.bot
            .deleteMessage(this.chatId, this.julgamentoMessageId)
            .catch(() => {});
        }
        const tecladoJulgamento = [
          [
            { text: "Culpado", callback_data: `julgar_culpado` },
            { text: "Inocente", callback_data: `julgar_inocente` },
            { text: "Abster-se", callback_data: `julgar_abster` },
          ],
        ];
        this.bot
          .sendMessage(
            this.chatId,
            `O tempo de defesa acabou. Agora, votem. Qual o veredito para *${dados.acusado.jogador.nomeFicticio}*?`,
            {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: tecladoJulgamento },
            }
          )
          .then((msg) => {
            this.julgamentoMessageId = msg.message_id;
          });
        break;

      case "erro_votacao":
        this.bot.sendMessage(dados.jogadorId, dados.motivo);
        break;

      case "voto_julgamento_registrado":
        // Anuncia que o jogador votou, mas não o voto (votação secreta)
        this.bot.sendMessage(this.chatId, `⚖️ ${dados.votador} votou.`);
        break;

      case "julgamento_finalizado":
        let resumoVotos = `Votação encerrada!\n\nCulpado: ${dados.culpado}\nInocente: ${dados.inocente}\n`;
        this.bot.sendMessage(this.chatId, resumoVotos);
        break;

      case "jogador_inocentado":
        this.bot.sendMessage(
          this.chatId,
          `O povo decidiu! *${dados.jogador.jogador.nomeFicticio}* foi considerado(a) inocente e desce da forca.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "ultimas_palavras_iniciou":
        this.bot.sendMessage(
          this.chatId,
          `O povo decidiu! *${dados.acusado.jogador.nomeFicticio}* foi considerado(a) culpado(a)! Você tem 15 segundos para suas últimas palavras.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "jogador_linchado":
        const morto = dados.jogadorMorto;
        let mensagemMorte = `As últimas palavras foram ditas. *${morto.jogador.nomeFicticio}* foi linchado(a).\n\nSeu papel era: *${morto.papel.nome}*.`;
        // Aqui você também revelaria a "Last Will" (última vontade/testamento) se tivesse implementado.
        this.bot.sendMessage(this.chatId, mensagemMorte, {
          parse_mode: "Markdown",
        });
        break;

      case "votacao_encerrada":
        this.bot.sendMessage(this.chatId, "A votação foi encerrada.");
        // Aqui você anunciaria quem foi o mais votado.
        break;

      case "noite_iniciou":
        // Mensagem para o grupo
        this.bot.sendMessage(
          this.chatId,
          `O sol se põe.\n\n` +
            `*Começa a noite ${dados.dia}*.\n\n` +
            `Se você tem uma ação noturna, use-a em seu chat privado comigo.\n` +
            `Vocês têm 1 minuto.`,
          { parse_mode: "Markdown" }
        );

        // Enviar mensagens privadas para papéis com ações
        dados.jogadoresVivos.forEach((jogadorInfo) => {
          // Lógica especial para o Veteran
          if (
            jogadorInfo.papel.nome === "Veteran" &&
            jogadorInfo.alertsRemaining > 0
          ) {
            this.bot.sendMessage(
              jogadorInfo.jogador.id,
              `Você tem ${jogadorInfo.alertsRemaining} alertas restantes. Deseja ficar em alerta esta noite?`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "Sim, ficar em alerta",
                        callback_data: `habil_alerta`,
                      },
                    ],
                  ],
                },
              }
            );
          }

          // Lógica especial para o Vigilante
          else if (jogadorInfo.papel.nome === "Vigilante") {
            if (jogo.dia === 1) {
              this.bot.sendMessage(
                jogadorInfo.jogador.id,
                "Você recarrega sua arma, mas decide" +
                  " esperar um dia antes de usá-la."
              );
            } else if (jogadorInfo.bulletsRemaining > 0) {
              const alvos = dados.jogadoresVivos
                .filter((alvo) => alvo.jogador.id !== jogadorInfo.jogador.id)
                .map((alvo) => [
                  {
                    text: alvo.jogador.nomeFicticio,
                    callback_data: `habil_${alvo.jogador.nomeFicticio}`,
                  },
                ]);
              this.bot.sendMessage(
                jogadorInfo.jogador.id,
                `Você tem ${jogadorInfo.bulletsRemaining} bala(s) restante(s).\n\n` +
                  `Escolha um alvo, se quiser atirar:`,
                { reply_markup: { inline_keyboard: alvos } }
              );
            } else {
              this.bot.sendMessage(
                jogadorInfo.jogador.id,
                "Você não tem mais balas."
              );
            }
          }

          // Lógica para os outros papéis
          else if (jogadorInfo.papel.temAcaoNoturna) {
            let alvos = dados.jogadoresVivos
              .filter((alvo) => alvo.jogador.id !== jogadorInfo.jogador.id)
              .map((alvo) => [
                {
                  text: alvo.jogador.nomeFicticio,
                  callback_data: `habil_${alvo.jogador.nomeFicticio}`,
                },
              ]);
            if (jogadorInfo.papel.nome === "Doctor") {
              alvos.unshift([
                {
                  text: "Curar a si mesmo",
                  callback_data: `habil_${jogadorInfo.jogador.nomeFicticio}`,
                },
              ]);
            }
            if (alvos.length > 0) {
              this.bot.sendMessage(
                jogadorInfo.jogador.id,
                "É noite. Escolha seu alvo:",
                { reply_markup: { inline_keyboard: alvos } }
              );
            } else {
              this.bot.sendMessage(
                jogadorInfo.jogador.id,
                "É noite, mas não há alvos disponíveis."
              );
            }
          }
        });
        break;

      case "alerta_ativado":
        this.bot.sendMessage(
          dados.veteranId,
          `Você está em alerta! Você tem ${dados.remaining} alertas restantes.`
        );
        break;

      case "acao_registrada":
        this.bot.sendMessage(
          dados.jogadorId,
          `Sua ação contra *${dados.nomeAlvo}* foi registrada.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "jogo_finalizado":
        this.bot.sendMessage(
          this.chatId,
          `O jogo acabou!\n*Vencedores: ${dados.vencedores}*`,
          { parse_mode: "Markdown" }
        );
        break;

      case "prisao_sucesso":
        // Mensagem para o grupo
        // this.bot.sendMessage(
        //   this.chatId,
        //   "O Jailor decidiu prender alguém esta noite."
        // );

        // Mensagem para o Jailor
        this.bot.sendMessage(
          dados.jailor.jogador.id,
          `Você prendeu *${dados.prisioneiro.jogador.nomeFicticio}*.\n` +
            `Vocês podem conversar anonimamente durante a noite.\n` +
            `Use /execute se decidir matá-lo(a).\n` +
            "Esta ação não pode ser desfeita.",
          { parse_mode: "Markdown" }
        );

        // Mensagem para o Prisioneiro
        this.bot.sendMessage(
          dados.prisioneiro.jogador.id,
          `Você foi preso(a) pelo Jailor!\n` +
            `Vocês podem conversar anonimamente.\n` +
            `Você não poderá usar sua habilidade esta noite.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "prisao_falhou":
        this.bot.sendMessage(
          dados.jogadorId,
          "Ação falhou. Ou você não é o Jailor, ou o alvo não foi encontrado."
        );
        break;

      case "execucao_registrada":
        this.bot.sendMessage(
          dados.jailorId,
          "Sua decisão de executar o prisioneiro foi registrada."
        );
        break;

      case "mensagem_prisao":
        this.bot.sendMessage(
          dados.destinatarioId,
          `*${dados.nomeRemetente}:* ${dados.texto}`,
          { parse_mode: "Markdown" }
        );
        break;

      case "mayor_revealed":
        this.bot.sendMessage(
          this.chatId,
          `*REVELAÇÃO DE CARGO!*\n\n` +
            `*${dados.mayor.jogador.nomeFicticio}* revelou-se como o *Mayor*!\n\n` +
            `Seus votos agora contam como 3.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "seance_registrada":
        this.bot.sendMessage(
          dados.mediumId,
          `Você escolheu fazer um contato espiritual com *${dados.alvoNome}*. Você falará com ele(a) esta noite.`,
          { parse_mode: "Markdown" }
        );
        break;

      case "seance_iniciada":
        this.bot.sendMessage(
          dados.alvoId,
          "Um Medium está tentando falar com você do além... Você pode responder diretamente nesta conversa."
        );
        break;

      case "mensagem_chat_mortos":
        this.bot.sendMessage(
          dados.destinatarioId,
          `👻 *${dados.nomeRemetente}:* ${dados.texto}`,
          { parse_mode: "Markdown" }
        );
        break;

      case "mensagem_seance":
        this.bot.sendMessage(
          dados.destinatarioId,
          `🗣️ *${dados.nomeRemetente}:* ${dados.texto}`,
          { parse_mode: "Markdown" }
        );
        break;

      case "exibir_alvos_prisao":
        const tecladoPrisao = dados.alvos.map((alvo) => [
          {
            text: alvo.jogador.nomeFicticio,
            callback_data: `jail_${alvo.jogador.nomeFicticio}`,
          },
        ]);

        if (tecladoPrisao.length > 0) {
          this.bot.sendMessage(
            dados.jailorId,
            "Quem você deseja prender esta noite?",
            {
              reply_markup: {
                inline_keyboard: tecladoPrisao,
              },
            }
          );
        } else {
          this.bot.sendMessage(dados.jailorId, "Não há ninguém para prender.");
        }
        break;

      case "exibir_alvos_seance":
        const tecladoSeance = dados.alvos.map((alvo) => [
          {
            text: alvo.jogador.nomeFicticio,
            callback_data: `seance_${alvo.jogador.nomeFicticio}`,
          },
        ]);

        if (tecladoSeance.length > 0) {
          this.bot.sendMessage(
            dados.mediumId,
            "Com quem você deseja falar do além?",
            {
              reply_markup: {
                inline_keyboard: tecladoSeance,
              },
            }
          );
        } else {
          this.bot.sendMessage(
            dados.mediumId,
            "Não há ninguém vivo para contatar."
          );
        }
        break;
    }
  }
}

module.exports = TelegramBotObserver;
