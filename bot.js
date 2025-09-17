require("dotenv").config();
const TOKEN = process.env.TELEGRAM_TOKEN;
const TelegramBot = require("node-telegram-bot-api");
const options = { polling: true };
const bot = new TelegramBot(TOKEN, options);

const usernameBot = "IamRogerbot";

const Game = require("./game.js");
const TelegramBotObserver = require("./telegramObserver.js");

const games = new Map();
const links = new Map();
const playerGames = new Map(); // Armazena groupId por playerId

class GameManagerObserver {
  constructor() {}
  update(evento, dados, jogo) {
    if (evento === "jogo_finalizado" || evento === "falha_ao_iniciar") {
      games.delete(jogo.id);

      for (const [key, value] of links.entries()) {
        if (value === jogo.id) {
          links.delete(key);
          break;
        }
      }

      jogo.jogadores.forEach((p) => {
        const playerId = p.id || p.jogador.id;
        if (playerGames.has(playerId)) {
          playerGames.delete(playerId);
        }
      });

      console.log(`Jogo ${jogo.id} finalizado e removido da memória.`);
    }
  }
}

const gerarUid = () => {
  const timestamp = Date.now().toString(16);
  const randomNum = (Math.random() * 16).toString(16).split(".")[1];
  return timestamp + randomNum;
};

bot.onText(/\/startclassic/, (msg) => {
  const chatId = msg.chat.id;
  const nomeSala = msg.chat.title;

  if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
    bot.sendMessage(chatId, "Este comando só pode ser usado em grupos.");
    return;
  }

  if (games.has(chatId)) {
    bot.sendMessage(chatId, "Já existe uma sala nesse grupo");
    return;
  }

  const game = new Game(chatId, nomeSala);
  const telegramObserver = new TelegramBotObserver(bot, chatId);
  const gameManagerObserver = new GameManagerObserver();

  game.addObserver(telegramObserver);
  game.addObserver(gameManagerObserver);

  games.set(chatId, game);
  const link = gerarUid();
  links.set(link, chatId);
  game.notifyObservers("sala_criada", { link: link, usernameBot: usernameBot });
  game.startLobbyTimer(30000);
});

bot.onText(/\/start (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const link = match[1];
  const groupId = links.get(link);

  if (!groupId || !games.has(groupId)) {
    bot.sendMessage(chatId, "Link inválido ou sala não encontrada.");
    return;
  }

  const game = games.get(groupId);
  const jogador = { id: msg.from.id, nome: msg.from.first_name };

  // Apenas chamamos o método do jogo. A notificação é responsabilidade do jogo.
  game.addPlayer(jogador);
  playerGames.set(jogador.id, groupId);
});

bot.onText(/\/habilidade (.+)/, (msg, match) => {
  const atorId = msg.from.id;
  const alvoNome = match[1];

  if (msg.chat.type !== "private") {
    bot.sendMessage(
      msg.chat.id,
      "Use este comando no seu chat privado comigo."
    );
    return;
  }

  const groupId = playerGames.get(atorId);
  if (!groupId || !games.has(groupId)) {
    bot.sendMessage(atorId, "Você não está em um jogo ativo.");
    return;
  }

  const game = games.get(groupId);
  game.registrarAcaoNoturna(atorId, alvoNome);
});

bot.on("callback_query", (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  const votadorId = callbackQuery.from.id;
  const groupId = msg.chat.id;

  if (!games.has(groupId)) return;
  const game = games.get(groupId);

  if (data.startsWith("votar_")) {
    const alvoNome = data.substring(6);
    game.registrarVoto(votadorId, alvoNome);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: `Você votou em ${alvoNome}`,
    });
  } else if (data.startsWith("julgar_")) {
    const veredito = data.substring(7);

    if (veredito !== "abster") {
      game.registrarVotoJulgamento(votadorId, veredito);
    }
    bot.answerCallbackQuery(callbackQuery.id, {
      text: `Você votou: ${
        veredito.charAt(0).toUpperCase() + veredito.slice(1)
      }`,
    });
  }
});
