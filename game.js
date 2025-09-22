const {
  PAPEIS_DETALHES,
  LISTA_PAPEIS_CLASSICO,
  TOWN_KILLING_ROLES,
  RANDOM_TOWN_ROLES,
} = require("./papeisClassico.js");
const _ = require("lodash");

function gerarNomesFicticios(jogadores) {
  const nomesFicticios = [
    "Cotton Mather",
    "Deodat Lawson",
    "Edward Bishop",
    "Giles Corey",
    "James Bayley",
    "James Russel",
    "John Hathorne",
    "John Proctor",
    "John Willard",
    "Jonathan Corwin",
    "Samuel Parris",
    "Samuel Sewall",
    "Thomas Danforth",
    "William Hobbs",
    "William Phips",
    "Abigail Hobbs",
    "Alice Young",
    "Ann Hibbins",
    "Ann Putnam",
    "Ann Sears",
    "Betty Parris",
    "Dorothy Good",
    "Lydia Dustin",
    "Martha Corey",
    "Mary Eastey",
    "Mary Johnson",
    "Mary Warren",
    "Sarah Bishop",
    "Sarah Good",
    "Sarah Wildes",
  ];

  const nomesEmbaralhados = _.shuffle(nomesFicticios);

  jogadores.forEach((jogador, i) => {
    jogador.nomeFicticio = nomesEmbaralhados[i];
  });

  return _.shuffle(jogadores);
}

function sortearPapeisModoClassico(numJogadores) {
  let roleList = _.cloneDeep(LISTA_PAPEIS_CLASSICO);

  const tkIndex = roleList.indexOf("Town Killing");
  roleList[tkIndex] = _.sample(TOWN_KILLING_ROLES);

  const rtIndex = roleList.indexOf("Random Town");
  roleList[rtIndex] = _.sample(RANDOM_TOWN_ROLES);

  const listaEmbaralhada = _.shuffle(roleList);
  return listaEmbaralhada.slice(0, numJogadores);
}

class Game {
  constructor(id, nome) {
    this.id = id;
    this.nome = nome;
    this.minJogadores = 1;
    this.maxJogadores = 15;
    this.jogadores = [];
    this.estado = "lobby";
    this.observers = [];
    this.lobbyTimer = null;
    this.fase = null;
    this.dia = 0;
    this.jogadoresVivos = [];
    this.acoesNoturnas = new Map();
    this.votos = new Map();
    this.jogadoresEmJulgamento = null;
    this.votosJulgamento = new Map();
    this.doctorsSelfHealed = new Set();
    this.prisioneiro = null;
    this.jailorExecutions = 3;
    this.jailorDecisao = null;
    this.seanceAlvos = new Map();
    this.mediumQueUsaramSeance = new Set();
    this.veteransOnAlert = new Set();
  }

  addPlayer(jogador) {
    if (this.jogadores.length >= this.maxJogadores) {
      this.notifyObservers("sala_cheia", { jogadorId: jogador.id });
      return;
    }
    if (this.jogadores.some((j) => j.id === jogador.id)) {
      this.notifyObservers("sala_ja_existe", { jogadorId: jogador.id });
      return;
    }
    this.jogadores.push(jogador);
    this.notifyObservers("jogador_entrou", {
      jogadorId: jogador.id,
      nomeJogador: jogador.nome,
    });
  }

  addObserver(observer) {
    this.observers.push(observer);
  }

  encaminharMensagemChatMortos(remetenteId, texto, remetenteInfo) {
    const nomeRemetente = remetenteInfo.jogador.nomeFicticio;
    const mortos = this.jogadores.filter((j) => j.status === "morto");
    const mediumsVivos = this.jogadoresVivos.filter(
      (j) => j.papel.nome === "Medium"
    );

    // Quem pode ouvir: todos os mortos e os médiuns vivos (que não estejam presos)
    const ouvintes = [...mortos, ...mediumsVivos];
    ouvintes.forEach((ouvinte) => {
      // O remetente não recebe a própria mensagem de volta
      if (ouvinte.jogador.id !== remetenteId) {
        const estaPreso =
          this.prisioneiro &&
          this.prisioneiro.jogador.id === ouvinte.jogador.id;
        // Médium preso ainda ouve, mas não pode falar (essa regra é tratada no processarMensagemPrivada)
        this.notifyObservers("mensagem_chat_mortos", {
          destinatarioId: ouvinte.jogador.id,
          nomeRemetente,
          texto,
        });
      }
    });
  }

  encaminharMensagemPrisao(remetenteId, texto) {
    if (!this.prisioneiro) return;

    const jailor = this.jogadores.find((j) => j.papel.nome === "Jailor");
    const eJailor = remetenteId === jailor.jogador.id;
    const ePrisioneiro = remetenteId === this.prisioneiro.jogador.id;

    if (this.fase === "noite" && (eJailor || ePrisioneiro)) {
      const destinatarioId = eJailor
        ? this.prisioneiro.jogador.id
        : jailor.jogador.id;
      const nomeRemetente = eJailor ? "Jailor" : "Prisioneiro";
      this.notifyObservers("mensagem_prisao", {
        destinatarioId,
        nomeRemetente,
        texto,
      });
    }
  }

  encaminharMensagemSeance(remetenteId, texto, remetenteInfo) {
    const alvoId = this.seanceAlvos.get(remetenteId) || remetenteId;
    const mediumsNestaSeance = Array.from(this.seanceAlvos.entries())
      .filter(([mid, tid]) => tid === alvoId)
      .map(([mid, tid]) => mid);

    const alvo = this.jogadores.find((j) => j.jogador.id === alvoId);

    // Se o remetente é o alvo da séance
    if (remetenteId === alvoId) {
      // A mensagem vai para todos os médiuns que estão fazendo séance com ele
      mediumsNestaSeance.forEach((mediumId) => {
        this.notifyObservers("mensagem_seance", {
          destinatarioId: mediumId,
          nomeRemetente: alvo.jogador.nomeFicticio,
          texto,
        });
      });
    } else {
      // Se o remetente é um dos médiuns
      // A mensagem vai para o alvo
      this.notifyObservers("mensagem_seance", {
        destinatarioId: alvoId,
        nomeRemetente: "Medium",
        texto,
      });
      // E para outros médiuns na mesma séance
      mediumsNestaSeance.forEach((outroMediumId) => {
        if (outroMediumId !== remetenteId) {
          this.notifyObservers("mensagem_seance", {
            destinatarioId: outroMediumId,
            nomeRemetente: "Medium",
            texto,
          });
        }
      });
    }
  }

  executarLinchamento() {
    const jogadorMorto = this.jogadorEmJulgamento;
    // Remove o jogador da lista de vivos
    this.jogadoresVivos = this.jogadoresVivos.filter(
      (j) => j.jogador.id !== jogadorMorto.jogador.id
    );

    this.notifyObservers("jogador_linchado", { jogadorMorto: jogadorMorto });

    if (this.verificarFimDeJogo()) return;

    this.iniciarNoite();
  }

  iniciarDia() {
    this.dia++;
    this.fase = "discussao";

    const eventosDaNoite =
      this.dia > 1 ? this.processarAcoesNoturnas() : { mortes: [] };

    if (this.verificarFimDeJogo()) return;

    this.notifyObservers("dia_iniciou", {
      dia: this.dia,
      jogadoresVivos: this.jogadoresVivos,
      mortes: eventosDaNoite.mortes,
    });

    if (this.dia === 1) {
      setTimeout(() => this.iniciarNoite(), 30000);
    } else {
      setTimeout(() => this.iniciarVotacao(), 120000);
    }
  }

  iniciarDefesa() {
    this.fase = "defesa";
    this.notifyObservers("defesa_iniciou", {
      acusado: this.jogadorEmJulgamento,
    });

    // 30 segundos para defesa
    setTimeout(() => this.iniciarJulgamento(), 30000);
  }

  iniciarJulgamento() {
    this.fase = "julgamento";
    this.votosJulgamento.clear();
    this.notifyObservers("julgamento_iniciou", {
      acusado: this.jogadorEmJulgamento,
    });

    // 30 segundos para votar
    setTimeout(() => this.processarJulgamento(), 30000);
  }

  iniciarNoite() {
    this.fase = "noite";
    this.acoesNoturnas.clear();

    this.seanceAlvos.forEach((alvoId, mediumId) => {
      this.notifyObservers("seance_iniciada", { alvoId });
      this.mediumQueUsaramSeance.add(mediumId);
    });

    this.notifyObservers("noite_iniciou", {
      dia: this.dia,
      jogadoresVivos: this.jogadoresVivos,
    });
    setTimeout(() => this.iniciarDia(), 60000);
  }

  iniciarPrisao(jailorId) {
    if (this.fase !== "discussao") return;
    const jailor = this.jogadoresVivos.find(
      (j) => j.jogador.id === jailorId && j.papel.nome === "Jailor"
    );
    if (jailor) {
      const alvos = this.jogadoresVivos.filter(
        (j) => j.jogador.id !== jailorId
      );
      this.notifyObservers("exibir_alvos_prisao", { jailorId, alvos });
    }
  }

  iniciarSeance(mediumId) {
    if (this.fase === "noite") return;
    const medium = this.jogadores.find(
      (j) =>
        j.jogador.id === mediumId &&
        j.papel.nome === "Medium" &&
        j.status === "morto"
    );
    if (medium && !this.mediumQueUsaramSeance.has(mediumId)) {
      this.notifyObservers("exibir_alvos_seance", {
        mediumId,
        alvos: this.jogadoresVivos,
      });
    }
  }

  iniciarUltimasPalavras() {
    this.fase = "ultimas_palavras";
    this.notifyObservers("ultimas_palavras_iniciou", {
      acusado: this.jogadorEmJulgamento,
    });

    // 15 segundos para últimas palavras
    setTimeout(() => this.executarLinchamento(), 15000);
  }

  iniciarVotacao() {
    this.fase = "votacao";
    this.votos.clear();
    this.notifyObservers("votacao_iniciou", {
      jogadoresVivos: this.jogadoresVivos,
    });
    setTimeout(() => this.processarVotos(), 60000);
  }

  notifyObservers(evento, dados) {
    this.observers.forEach((observer) => observer.update(evento, dados, this));
  }

  processarAcoesNoturnas() {
    let mortes = [];
    let resultadosPrivados = [];
    let curas = new Map();
    let bloqueios = new Set();
    let frames = new Set();
    let visitasNoturnas = new Map();

    const registrarVisita = (visitante, visitado) => {
      if (!visitado) return;
      if (!visitasNoturnas.has(visitado.jogador.id)) {
        visitasNoturnas.set(visitado.jogador.id, []);
      }
      visitasNoturnas
        .get(visitado.jogador.id)
        .push(visitante.jogador.nomeFicticio);
    };

    if (this.prisioneiro) {
      bloqueios.add(this.prisioneiro.jogador.id);
    }

    if (this.prisioneiro && this.jailorDecisao === "executar") {
      this.jailorExecutions--;
      mortes.push(this.prisioneiro.jogador.nomeFicticio);

      if (this.prisioneiro.papel.alignment.startsWith("Town")) {
        this.jailorExecutions = 0;
        const jailor = this.jogadores.find((j) => j.papel.nome === "Jailor");
        if (jailor) {
          resultadosPrivados.push({
            jogadorId: jailor.jogador.id,
            mensagem:
              "Você executou um membro da cidade e " +
              "perdeu suas execuções restantes.",
          });
        }
      }
    }

    const acoesOrdenadas = Array.from(this.acoesNoturnas.values()).sort(
      (a, b) => (a.ator.papel.priority || 99) - (b.ator.papel.priority || 99)
    );

    // Primeira passagem
    acoesOrdenadas.forEach(({ ator, alvo }) => {
      this.veteransOnAlert.forEach((veteranId) => {
        if (bloqueios.has(veteranId)) {
          bloqueios.delete(veteranId);
        }
        curas.set(veteranId, "alert");
      });

      // if (ator.papel.nome !== "Lookout") {
      registrarVisita(ator, alvo);
      // }

      switch (ator.papel.nome) {
        case "Tavern Keeper":
          bloqueios.add(alvo.jogador.id);
          break;
        case "Doctor":
          const isMayorRevealed =
            alvo.papel.nome === "Mayor" && alvo.isMayorRevealed;
          if (isMayorRevealed) {
            resultadosPrivados.push({
              jogadorId: ator.jogador.id,
              mensagem: "Você não pode curar um Mayor que já se revelou.",
            });
            return;
          }
          if (ator.jogador.id === alvo.jogador.id) {
            if (this.doctorsSelfHealed.has(ator.jogador.id)) {
              resultadosPrivados.push({
                jogadorId: ator.jogador.id,
                mensagem: "Você não pode se curar mais de uma vez.",
              });
              return;
            }
            this.doctorsSelfHealed.add(ator.jogador.id);
          }
          curas.set(alvo.jogador.id, ator.jogador.id);
          break;
        case "Framer":
          frames.add(alvo.jogador.id);
          break;
      }
    });

    const acoesDoTavernKeeper = acoesOrdenadas.filter(
      (a) => a.ator.papel.nome === "Tavern Keeper"
    );
    acoesDoTavernKeeper.forEach(({ ator, alvo }) => {
      const isSKPreso =
        this.prisioneiro && this.prisioneiro.jogador.id === alvo.jogador.id;
      if (alvo.papel.nome === "Serial Killer" && !isSKPreso) {
        if (!curas.has(ator.jogador.id)) {
          mortes.push(ator.jogador.nomeFicticio);
        }
        resultadosPrivados.push({
          jogadorId: ator.jogador.id,
          mensagem: "Você foi atacado pelo Serial Killer que você visitou!",
        });
        if (curas.has(ator.jogador.id)) {
          const doctorId = curas.get(ator.jogador.id);
          resultadosPrivados.push({
            jogadorId: doctorId,
            mensagem: `Seu alvo foi atacado, mas você o salvou!`,
          });
        }
      }
    });

    this.veteransOnAlert.forEach((veteranId) => {
      const veteran = this.jogadores.find((j) => j.jogador.id === veteranId);
      const visitantes = visitasNoturnas.get(veteranId) || [];

      visitantes.forEach((nomeVisitante) => {
        mortes.push(nomeVisitante);
        resultadosPrivados.push({
          jogadorId: veteranId,
          mensagem: `Você atirou em alguém que te visitou!`,
        });
      });
    });

    // Segunda passagem
    acoesOrdenadas.forEach(({ ator, alvo }) => {
      if (
        bloqueios.has(ator.jogador.id) &&
        !ator.papel.immunities?.includes("Role block Immunity")
      ) {
        return;
      }
      const isFramed = frames.has(alvo.jogador.id);
      switch (ator.papel.nome) {
        case "Sheriff":
          const checkResult = ator.papel.checkSuspicious(alvo.papel);
          let finalResult = checkResult;
          if (isFramed) {
            finalResult = "suspeito";
          }
          let mensagemSheriff = "";
          if (finalResult === "suspeito") {
            mensagemSheriff = `Seu alvo é suspeito ou foi incriminado!`;
          } else {
            mensagemSheriff = `Você não conseguiu encontrar evidências de irregularidades. Seu alvo é inocente ou sabe esconder segredos!`;
          }
          resultadosPrivados.push({
            jogadorId: ator.jogador.id,
            mensagem:
              `Resultado da interrogação em *${alvo.jogador.nomeFicticio}*:\n` +
              `${mensagemSheriff}`,
          });
          break;
        case "Investigator":
          let resultadoInvestigator;
          if (isFramed) {
            resultadoInvestigator =
              "Seu alvo pode ser um: Framer, Vampire, or Jester.";
          } else {
            resultadoInvestigator = ator.papel.getResult(alvo.papel.nome);
          }
          resultadosPrivados.push({
            jogadorId: ator.jogador.id,
            mensagem:
              `Resultado da investigação em *${alvo.jogador.nomeFicticio}*:\n` +
              `${resultadoInvestigator}`,
          });
          break;
        case "Lookout":
          const visitantes = visitasNoturnas.get(alvo.jogador.id) || [];
          let mensagemLookout;
          if (visitantes.length > 0) {
            mensagemLookout =
              `Alguém visitou seu alvo (*${alvo.jogador.nomeFicticio}*) na noite passada!\n\n` +
              `Visitantes:\n${visitantes.join(`\n`)}`;
          } else {
            mensagemLookout = `Ninguém visitou seu alvo (*${alvo.jogador.nomeFicticio}*) na noite passada.`;
          }
          resultadosPrivados.push({
            jogadorId: ator.jogador.id,
            mensagem: mensagemLookout,
          });
          break;
        case "Mafioso":
        case "Godfather":
        case "Serial Killer":
          const tavernKeeperQueBloqueou = acoesDoTavernKeeper.find(
            (a) => a.alvo.jogador.id === ator.jogador.id
          );
          if (
            ator.papel.nome === "Serial Killer" &&
            tavernKeeperQueBloqueou &&
            alvo.jogador.id === tavernKeeperQueBloqueou.ator.jogador.id
          ) {
            return;
          }
          // Se o alvo não foi curado, ele morre.
          if (curas.has(alvo.jogador.id)) {
            const doctorId = curas.get(alvo.jogador.id);
            resultadosPrivados.push({
              jogadorId: doctorId,
              mensagem: `Seu alvo foi atacado, mas você o salvou!`,
            });
          } else {
            mortes.push(alvo.jogador.nomeFicticio);
          }
          break;
      }
    });

    const mortesUnicas = [...new Set(mortes)];
    mortesUnicas.forEach((nomeMorto) => {
      const jogadorMorto = this.jogadores.find(
        (j) => j.jogador.nomeFicticio === nomeMorto
      );
      if (jogadorMorto) jogadorMorto.status = "morto";
    });

    this.jogadoresVivos = this.jogadores.filter((j) => j.status === "vivo");
    this.prisioneiro = null;
    this.jailorDecisao = null;

    return { mortes: mortesUnicas, resultadosPrivados };
  }

  processarJulgamento() {
    let votosCulpado = 0;
    let votosInocente = 0;

    for (const [votadorId, veredito] of this.votosJulgamento.entries()) {
      const votador = this.jogadores.find((j) => j.jogador.id === votadorId);
      const pesoVoto =
        votador && votador.papel.nome === "Mayor" && votador.isMayorRevealed
          ? 3
          : 1;
      if (veredito === "culpado") votosCulpado += pesoVoto;
      if (veredito === "inocente") votosInocente += pesoVoto;
    }

    const resultado = {
      culpado: votosCulpado,
      inocente: votosInocente,
      votos: this.votosJulgamento,
      jogadores: this.jogadores,
    };

    this.notifyObservers("julgamento_finalizado", resultado);

    if (votosCulpado > votosInocente) {
      this.iniciarUltimasPalavras();
    } else {
      this.notifyObservers("jogador_inocentado", {
        jogador: this.jogadorEmJulgamento,
      });
      this.iniciarNoite();
    }
  }

  processarMensagemPrivada(remetenteId, texto) {
    const jogador = this.jogadores.find((j) => j.jogador.id === remetenteId);
    if (!jogador) return;

    // Se for o Jailor ou o Prisioneiro, usa o chat da prisão
    if (
      this.prisioneiro &&
      (remetenteId === this.prisioneiro.jogador.id ||
        (jogador.papel.nome === "Jailor" && jogador.status === "vivo"))
    ) {
      this.encaminharMensagemPrisao(remetenteId, texto);
      return;
    }

    // Se estiver em séance (seja como Medium ou alvo)
    const estaEmSeance =
      Array.from(this.seanceAlvos.values()).includes(remetenteId) ||
      this.seanceAlvos.has(remetenteId);
    if (this.fase === "noite" && estaEmSeance) {
      this.encaminharMensagemSeance(remetenteId, texto, jogador);
      return;
    }

    // Se for um Medium vivo falando com os mortos
    if (
      this.fase === "noite" &&
      jogador.papel.nome === "Medium" &&
      jogador.status === "vivo"
    ) {
      this.encaminharMensagemChatMortos(remetenteId, texto, jogador);
      return;
    }

    // Se for um jogador morto falando
    if (jogador.status === "morto") {
      this.encaminharMensagemChatMortos(remetenteId, texto, jogador);
      return;
    }
  }

  processarVotos() {
    if (this.votos.size === 0) {
      this.notifyObservers("votacao_sem_votos", {});
      this.iniciarNoite();
      return;
    }

    const contagem = new Map();
    for (const [votadorId, alvoId] of this.votos.entries()) {
      const votador = this.jogadores.find((j) => j.jogador.id === votadorId);
      const pesoVoto =
        votador && votador.papel.nome === "Mayor" && votador.isMayorRevealed
          ? 3
          : 1;
      contagem.set(alvoId, (contagem.get(alvoId) || 0) + pesoVoto);
    }

    let maisVotadoId = null;
    let maxVotos = 0;
    for (const [jogadorId, numVotos] of contagem.entries()) {
      if (numVotos > maxVotos) {
        maxVotos = numVotos;
        maisVotadoId = jogadorId;
      }
    }

    // Verificar se houve empate
    const empates = Array.from(contagem.values()).filter(
      (v) => v === maxVotos
    ).length;

    if (
      empates > 1 ||
      maxVotos < Math.floor(this.jogadoresVivos.length / 2) + 1
    ) {
      // Precisa de maioria simples
      this.notifyObservers("votacao_sem_julgamento", {});
      this.iniciarNoite();
      return;
    }

    this.jogadorEmJulgamento = this.jogadoresVivos.find(
      (j) => j.jogador.id === maisVotadoId
    );
    this.iniciarDefesa();
  }

  registrarAcaoNoturna(atorId, alvoNomeFicticio) {
    if (this.fase !== "noite") return;
    const ator = this.jogadoresVivos.find((j) => j.jogador.id === atorId);
    const alvo = this.jogadoresVivos.find(
      (j) => j.jogador.nomeFicticio === alvoNomeFicticio
    );
    if (ator && alvo) {
      this.acoesNoturnas.set(atorId, { ator, alvo });
      this.notifyObservers("acao_registrada", {
        jogadorId: atorId,
        nomeAlvo: alvo.jogador.nomeFicticio,
      });
    }
  }

  registrarAlerta(veteranId) {
    if (this.fase !== "noite") return;
    const veteran = this.jogadoresVivos.find(
      (j) => j.jogador.id === veteranId && j.papel.nome === "Veteran"
    );
    if (veteran && veteran.alertsRemaining > 0) {
      this.veteransOnAlert.add(veteran.jogador.id);
      veteran.alertsRemaining--;
      this.notifyObservers("alerta_ativado", {
        veteranId,
        remaining: veteran.alertsRemaining,
      });
    }
  }

  registrarExecucao(jailorId) {
    if (this.fase !== "noite" || !this.prisioneiro) return;

    const jailor = this.jogadores.find(
      (j) => j.jogador.id === jailorId && j.papel.nome === "Jailor"
    );
    // Verifica se o Jailor está vivo e se tem execuções restantes
    if (jailor && jailor.status === "vivo" && this.jailorExecutions > 0) {
      this.jailorDecisao = "executar";
      this.notifyObservers("execucao_registrada", { jailorId: jailorId });
    }
  }

  registrarPrisao(jailorId, alvoNomeFicticio) {
    if (this.fase !== "discussao") return;
    const jailor = this.jogadoresVivos.find(
      (j) => j.jogador.id === jailorId && j.papel.nome === "Jailor"
    );
    const alvo = this.jogadoresVivos.find(
      (j) => j.jogador.nomeFicticio === alvoNomeFicticio
    );
    if (jailor && alvo) {
      this.prisioneiro = alvo;
      this.notifyObservers("prisao_sucesso", {
        jailor: jailor,
        prisioneiro: this.prisioneiro,
      });
    } else {
      this.notifyObservers("prisao_falhou", { jogadorId: jailorId });
    }
  }

  registrarSeance(mediumId, alvoNomeFicticio) {
    if (this.fase !== "discussao" && this.fase !== "votacao") return;

    const medium = this.jogadores.find((j) => j.jogador.id === medium);
    const alvo = this.jogadoresVivos.find(
      (j) => j.jogador.nomeFicticio === alvoNomeFicticio
    );

    if (medium && alvo && !this.mediumQueUsaramSeance.has(mediumId)) {
      this.seanceAlvos.set(mediumId, alvo.jogador.id);
      this.notifyObservers("seance_registrada", {
        mediumId,
        alvoNome: alvo.jogador.nomeFicticio,
      });
    }
  }

  registrarVoto(votadorId, alvoNomeFicticio) {
    if (this.fase !== "votacao") return;

    const votador = this.jogadoresVivos.find((j) => j.jogador.id === votadorId);
    const alvo = this.jogadoresVivos.find(
      (j) => j.jogador.nomeFicticio === alvoNomeFicticio
    );

    if (votador && alvo && votador.jogador.id === alvo.jogador.id) {
      this.notifyObservers("erro_votacao", {
        jogadorId: votadorId,
        motivo: "Você não pode votar em si mesmo.",
      });
      return;
    }

    if (votador && alvo) {
      this.votos.set(votadorId, alvo.jogador.id);
      this.notifyObservers("voto_registrado", {
        votador: votador.jogador.nomeFicticio,
        alvo: alvo.jogador.nomeFicticio,
      });
    }
  }

  registrarVotoJulgamento(votadorId, veredito) {
    if (this.fase !== "julgamento") return;
    // Não permite que o acusado vote no próprio julgamento
    if (votadorId === this.jogadorEmJulgamento.jogador.id) return;

    this.votosJulgamento.set(votadorId, veredito);
    const votador = this.jogadores.find((j) => j.jogador.id === votadorId);
    this.notifyObservers("voto_julgamento_registrado", {
      votador: votador.jogador.nomeFicticio,
    });
  }

  revealMayor(playerId) {
    if (this.fase !== "discussao" && this.fase !== "votacao") return;
    const mayor = this.jogadoresVivos.find(
      (j) => j.jogador.id === playerId && j.papel.nome === "Mayor"
    );
    if (mayor && !mayor.isMayorRevealed) {
      mayor.isMayorRevealed = true;
      this.notifyObservers("mayor_revealed", { mayor });
    }
  }

  startGame() {
    const numJogadores = this.jogadores.length;
    if (numJogadores < this.minJogadores || numJogadores > this.maxJogadores) {
      this.estado = "finalizado";
      this.notifyObservers("falha_ao_iniciar", {
        motivo: "jogadores_insuficientes",
      });
      return;
    }

    this.estado = "em_jogo";
    this.notifyObservers("jogo_iniciando", {});

    const nomesFicticios = gerarNomesFicticios(this.jogadores);
    const listaDePapeis = sortearPapeisModoClassico(this.jogadores.length);

    const jogadoresComPapeis = [];
    nomesFicticios.forEach((jogador, i) => {
      const nomePapel = listaDePapeis[i];
      jogadoresComPapeis.push({
        jogador: jogador,
        papel: {
          nome: nomePapel,
          ...PAPEIS_DETALHES[nomePapel],
        },
        status: "vivo",
        alvoExecutioner: null,
        isMayorRevealed: false,
        alertsRemaining: PAPEIS_DETALHES[nomePapel]?.alertsRemaining,
      });
    });

    this.jogadores = jogadoresComPapeis;

    const executioner = this.jogadores.find(
      (j) => j.papel.nome === "Executioner"
    );
    if (executioner) {
      const alvosPossiveis = this.jogadores.filter(
        (j) =>
          j.papel.alignment.startsWith("Town") &&
          ["Jailor", "Mayor"].includes(j.papel.nome)
      );
      if (alvosPossiveis.length > 0) {
        executioner.alvoExecutioner =
          _.sample(alvosPossiveis).jogador.nomeFicticio;
      }
    }

    this.jogadoresVivos = [...this.jogadores];
    this.notifyObservers("papeis_distribuidos", {
      executionerTarget: executioner?.alvoExecutioner,
    });
    setTimeout(() => this.iniciarDia(), 5000);
  }

  startLobbyTimer(timeoutMs, onTimerEndCallback) {
    if (this.lobbyTimer) {
      clearTimeout(this.lobbyTimer);
    }

    this.lobbyTimer = setTimeout(() => {
      this.startGame();

      if (onTimerEndCallback) {
        onTimerEndCallback();
      }
    }, timeoutMs);
  }

  verificarFimDeJogo() {
    const vivos = this.jogadoresVivos;
    if (vivos.length === 0) {
      this.estado = "finalizado";
      this.notifyObservers("jogo_finalizado", {
        vencedores: "Ninguém (Empate)",
      });
      return true;
    }
    const contagemFaccao = _.countBy(
      vivos,
      (j) => j.papel.alignment.split(" ")[0]
    );
    const townVivos = contagemFaccao["Town"] || 0;
    const mafiaVivos = contagemFaccao["Mafia"] || 0;
    const neutralKillingVivos = vivos.filter(
      (j) => j.papel.alignment === "Neutral Killing"
    ).length;

    let fimDeJogo = false;
    let vencedores = null;

    if (mafiaVivos === 0 && neutralKillingVivos === 0 && townVivos > 0) {
      fimDeJogo = true;
      vencedores = "A Cidade (Town)";
    } else if (
      mafiaVivos >= townVivos &&
      mafiaVivos > 0 &&
      neutralKillingVivos === 0
    ) {
      fimDeJogo = true;
      vencedores = "A Máfia";
    } else if (townVivos === 0 && mafiaVivos === 0 && neutralKillingVivos > 0) {
      fimDeJogo = true;
      vencedores = "O Serial Killer";
    } else if (
      vivos.length === 1 &&
      vivos[0].papel.alignment.startsWith("Neutral")
    ) {
      fimDeJogo = true;
      vencedores = "Ninguém (Empate, objetivo impossível)";
    }
    // Adicionar outras condições de vitória aqui (Executioner, Jester)

    if (fimDeJogo) {
      this.estado = "finalizado";
      this.notifyObservers("jogo_finalizado", { vencedores });
    }
    return fimDeJogo;
  }
}

module.exports = Game;
