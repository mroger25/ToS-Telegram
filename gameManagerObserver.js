const { games, links, playerGames } = require("./bot.js");

class GameManagerObserver {
  constructor() { }
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
exports.GameManagerObserver = GameManagerObserver;
