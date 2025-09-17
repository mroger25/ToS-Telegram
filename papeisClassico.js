// Este objeto mapeia o nome de cada papel para seus atributos detalhados.
const PAPEIS_DETALHES = {
  // --- TOWN ---
  Sheriff: {
    alignment: "Town Investigative",
    attack: "None",
    defense: "None",
    priority: 4,
    goal: "Lynch every criminal and evildoer.",
    checkSuspicious: (targetRole) => {
      // Godfather aparece inocente
      if (["Godfather", "Executioner"].includes(targetRole.nome))
        return "inocente";
      if (["Mafioso", "Serial Killer", "Framer"].includes(targetRole.nome))
        return "suspeito";
      return "inocente";
    },
  },
  Lookout: {
    alignment: "Town Investigative",
    priority: 4,
    goal: "Lynch every criminal and evildoer.",
  },
  Investigator: {
    alignment: "Town Investigative",
    priority: 4,
    goal: "Lynch every criminal and evildoer.",
    getResult: (targetRole) => {
      const results = {
        Sheriff: "Sheriff, Executioner, or Werewolf.",
        Executioner: "Sheriff, Executioner, or Werewolf.",
        Doctor: "Doctor, Disguiser, or Serial Killer.",
        "Serial Killer": "Doctor, Disguiser, or Serial Killer.",
        Vigilante: "Vigilante, Veteran, Mafioso, or Ambusher.",
        Veteran: "Vigilante, Veteran, Mafioso, or Ambusher.",
        Mafioso: "Vigilante, Veteran, Mafioso, or Ambusher.",
        Medium: "Medium, Janitor, or Retributionist.",
        Retributionist: "Medium, Janitor, or Retributionist.",
        Spy: "Spy, Blackmailer, or Jailor.",
        Jailor: "Spy, Blackmailer, or Jailor.",
        Framer: "Framer, Vampire, or Jester.",
        Jester: "Framer, Vampire, or Jester.",
        Framed: "Framer, Vampire, or Jester.",
        Lookout: "Lookout, Forger, or Witch.",
        Witch: "Lookout, Forger, or Witch.",
        "Tavern Keeper":
          "Tavern Keeper, Transporter, Bootlegger, or Hypnotist.",
        Transporter: "Tavern Keeper, Transporter, Bootlegger, or Hypnotist.",
        Investigator: "Investigator, Consigliere, or Mayor.",
        Mayor: "Investigator, Consigliere, or Mayor.",
        Bodyguard: "Bodyguard, Godfather, or Arsonist.",
        Godfather: "Bodyguard, Godfather, or Arsonist.",
        Arsonist: "Bodyguard, Godfather, or Arsonist.",
      };
      return `Your target could be a ${
        results[targetRole.nome] || "unknown role"
      }.`;
    },
  },
  Jailor: {
    alignment: "Town Killing",
    unique: true,
    priority: 1, // Prioridade para prender
    executionPriority: 5, // Prioridade para executar
    goal: "Lynch every criminal and evildoer.",
  },
  Doctor: {
    alignment: "Town Protective",
    priority: 3,
    goal: "Lynch every criminal and evildoer.",
  },
  "Tavern Keeper": {
    alignment: "Town Support",
    priority: 2,
    goal: "Lynch every criminal and evildoer.",
  },
  Medium: {
    alignment: "Town Support",
    priority: 1,
    goal: "Lynch every criminal and evildoer.",
  },
  Vigilante: {
    alignment: "Town Killing",
    priority: 5,
    goal: "Lynch every criminal and evildoer.",
  },
  Veteran: {
    alignment: "Town Killing",
    priority: 1, // Prioridade alta para ficar em alerta
    goal: "Lynch every criminal and evildoer.",
  },
  // --- MAFIA ---
  Godfather: {
    alignment: "Mafia Killing",
    defense: "Basic",
    priority: 5,
    immunities: ["Detection Immunity"], // Aparece inocente para o Sheriff
    goal: "Kill anyone that will not submit to the Mafia.",
  },
  Mafioso: {
    alignment: "Mafia Killing",
    priority: 5,
    goal: "Kill anyone that will not submit to the Mafia.",
  },
  Framer: {
    alignment: "Mafia Deception",
    priority: 3,
    goal: "Kill anyone that will not submit to the Mafia.",
  },
  // --- NEUTRAL ---
  "Serial Killer": {
    alignment: "Neutral Killing",
    defense: "Basic",
    priority: 5,
    immunities: ["Role block Immunity"],
    goal: "Kill everyone who would oppose you.",
  },
  Executioner: {
    alignment: "Neutral Evil",
    immunities: ["Detection Immunity"],
    goal: "Get your target lynched at any cost.",
  },
  Jester: {
    alignment: "Neutral Evil",
    goal: "Get yourself lynched by any means necessary.",
  },
};

// Lista de papéis para o Modo Clássico
const LISTA_PAPEIS_CLASSICO = [
  "Jailor",
  "Sheriff",
  "Lookout",
  "Investigator",
  "Doctor",
  "Tavern Keeper",
  "Medium",
  "Town Killing", // Aleatório: Vigilante ou Veteran
  "Random Town", // Qualquer papel da cidade
  "Godfather",
  "Mafioso",
  "Framer",
  "Serial Killer",
  "Executioner",
  "Jester",
];

// Papeis possíveis para os slots aleatórios
const TOWN_KILLING_ROLES = ["Vigilante", "Veteran"];
const RANDOM_TOWN_ROLES = [
  "Doctor",
  "Medium",
  "Lookout",
  "Sheriff",
  "Investigator",
  "Tavern Keeper",
];

module.exports = {
  PAPEIS_DETALHES,
  LISTA_PAPEIS_CLASSICO,
  TOWN_KILLING_ROLES,
  RANDOM_TOWN_ROLES,
};
