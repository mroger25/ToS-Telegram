require("dotenv").config();
const TOKEN = process.env.TELEGRAM_TOKEN;
const TelegramBot = require("node-telegram-bot-api");
const options = { polling: true };
const bot = new TelegramBot(TOKEN, options);

const usernameBot = "IamRogerbot";

const Game = require("./game.js");
const TelegramBotObserver = require("./telegramObserver.js");
const { GameManagerObserver } = require("./gameManagerObserver.js");

const games = new Map();
exports.games = games;
const links = new Map();
exports.links = links;
const playerGames = new Map(); // Armazena groupId por playerId
exports.playerGames = playerGames;

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

bot.onText(/\/jail (.+)/, (msg, match) => {
  const atorId = msg.from.id;
  const alvoNome = match[1];

  const groupId = playerGames.get(atorId);
  if (!groupId || !games.has(groupId)) {
    bot.sendMessage(atorId, "Você não está em um jogo ativo.");
    return;
  }

  const game = games.get(groupId);
  if (game.fase !== "discussao") {
    bot.sendMessage(atorId, "Você só pode prender alguém durante o dia.");
    return;
  }

  game.registrarPrisao(atorId, alvoNome);
});

bot.onText(/\/execute/, (msg) => {
  const atorId = msg.from.id;

  if (msg.chat.type !== "private") return; // Comando apenas privado

  const groupId = playerGames.get(atorId);
  if (!groupId || !games.has(groupId)) return;

  const game = games.get(groupId);
  game.registrarExecucao(atorId);
});

bot.on("message", (msg) => {
  if (msg.text && msg.text.startsWith("/")) return;

  const remetenteId = msg.from.id;
  // O chat da prisão só funciona em privado
  if (msg.chat.type === "private" && playerGames.has(remetenteId)) {
    const groupId = playerGames.get(remetenteId);
    const game = games.get(groupId);
    if (game) {
      game.encaminharMensagemPrisao(remetenteId, msg.text);
    }
  }
});

bot.on("callback_query", (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  const atorId = callbackQuery.from.id;

  if (data.startsWith("votar_") || data.startsWith("julgar_")) {
    const groupId = msg.chat.id;
    if (!games.has(groupId)) return;
    const game = games.get(groupId);
    if (data.startsWith("votar_")) {
      const alvoNome = data.substring(6);
      game.registrarVoto(atorId, alvoNome);
      bot.answerCallbackQuery(callbackQuery.id, {
        text: `Você votou em ${alvoNome}`,
      });
    } else if (data.startsWith("julgar_")) {
      const veredito = data.substring(7);
      if (veredito !== "abster") {
        game.registrarVotoJulgamento(atorId, veredito);
      }
      bot.answerCallbackQuery(callbackQuery.id, {
        text: `Você votou: ${
          veredito.charAt(0).toUpperCase() + veredito.slice(1)
        }`,
      });
    }
  } else if (data.startsWith("habil_")) {
    const alvoNome = data.substring(6);
    const groupId = playerGames.get(atorId);
    if (!groupId || !games.has(groupId)) {
      bot.answerCallbackQuery(callbackQuery.id, {
        text: "Erro: Não foi possível encontrar seu jogo.",
      });
      return;
    }
    const game = games.get(groupId);
    game.registrarAcaoNoturna(atorId, alvoNome);
    bot.editMessageText(`Você escolheu usar sua habilidade em *${alvoNome}*.`, {
      chat_id: msg.chat.id,
      message_id: msg.message_id,
      parse_mode: "Markdown",
    });
    bot.answerCallbackQuery(callbackQuery.id);
  }
});
