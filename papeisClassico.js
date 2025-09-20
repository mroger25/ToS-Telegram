// Este objeto mapeia o nome de cada papel para seus atributos detalhados.
const PAPEIS_DETALHES = {
  // --- TOWN ---
  Sheriff: {
    alignment: "Town Investigative",
    attack: "None",
    defense: "None",
    priority: 4,
    goal: "Lynch every criminal and evildoer.",
    temAcaoNoturna: true,
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
    temAcaoNoturna: true,
  },
  Investigator: {
    alignment: "Town Investigative",
    priority: 4,
    goal: "Lynch every criminal and evildoer.",
    temAcaoNoturna: true,
    getResult: (targetRoleName) => {
      const roleToGroupMap = {
        Vigilante: "Vigilante, Veteran, Mafioso, or Ambusher.",
        Veteran: "Vigilante, Veteran, Mafioso, or Ambusher.",
        Mafioso: "Vigilante, Veteran, Mafioso, or Ambusher.",
        Medium: "Medium, Janitor, or Retributionist.",
        Janitor: "Medium, Janitor, or Retributionist.",
        Retributionist: "Medium, Janitor, or Retributionist.",
        Survivor: "Survivor, Vampire Hunter, or Amnesiac.",
        "Vampire Hunter": "Survivor, Vampire Hunter, or Amnesiac.",
        Amnesiac: "Survivor, Vampire Hunter, or Amnesiac.",
        Spy: "Spy, Blackmailer, or Jailor.",
        Blackmailer: "Spy, Blackmailer, or Jailor.",
        Jailor: "Spy, Blackmailer, or Jailor.",
        Sheriff: "Sheriff, Executioner, or Werewolf.",
        Executioner: "Sheriff, Executioner, or Werewolf.",
        Werewolf: "Sheriff, Executioner, or Werewolf.",
        Framer: "Framer, Vampire, or Jester.",
        Vampire: "Framer, Vampire, or Jester.",
        Jester: "Framer, Vampire, or Jester.",
        Lookout: "Lookout, Forger, or Witch.",
        Forger: "Lookout, Forger, or Witch.",
        Witch: "Lookout, Forger, or Witch.",
        "Tavern Keeper":
          "Tavern Keeper, Transporter, Bootlegger, or Hypnotist.",
        Transporter: "Tavern Keeper, Transporter, Bootlegger, or Hypnotist.",
        Doctor: "Doctor, Disguiser, or Serial Killer.",
        Disguiser: "Doctor, Disguiser, or Serial Killer.",
        "Serial Killer": "Doctor, Disguiser, or Serial Killer.",
        Investigator: "Investigator, Consigliere, or Mayor.",
        Consigliere: "Investigator, Consigliere, or Mayor.",
        Mayor: "Investigator, Consigliere, or Mayor.",
        Bodyguard: "Bodyguard, Godfather, or Arsonist.",
        Godfather: "Bodyguard, Godfather, or Arsonist.",
        Arsonist: "Bodyguard, Godfather, or Arsonist.",
      };
      const result = roleToGroupMap[targetRoleName];
      return result
        ? `Seu alvo pode ser um: ${result}`
        : "Não foi possível obter uma pista sobre o papel do seu alvo.";
    },
  },
  Jailor: {
    alignment: "Town Killing",
    unique: true,
    priority: 1, // Prioridade para prender
    executionPriority: 5, // Prioridade para executar
    goal: "Lynch every criminal and evildoer.",
    // temAcaoNoturna: true,
  },
  Doctor: {
    alignment: "Town Protective",
    priority: 3,
    goal: "Lynch every criminal and evildoer.",
    temAcaoNoturna: true,
  },
  "Tavern Keeper": {
    alignment: "Town Support",
    priority: 2,
    goal: "Lynch every criminal and evildoer.",
    temAcaoNoturna: true,
    immunities: ["Role block Immunity"],
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
    temAcaoNoturna: true,
  },
  Veteran: {
    alignment: "Town Killing",
    priority: 1, // Prioridade alta para ficar em alerta
    goal: "Lynch every criminal and evildoer.",
    temAcaoNoturna: true,
  },
  Mayor: {
    alignment: "Town Support",
    unique: true,
    goal: "Lynch every criminal and evildoer.",
  },
  // --- MAFIA ---
  Godfather: {
    alignment: "Mafia Killing",
    defense: "Basic",
    priority: 5,
    immunities: ["Detection Immunity"], // Aparece inocente para o Sheriff
    goal: "Kill anyone that will not submit to the Mafia.",
    temAcaoNoturna: true,
  },
  Mafioso: {
    alignment: "Mafia Killing",
    priority: 5,
    goal: "Kill anyone that will not submit to the Mafia.",
    temAcaoNoturna: true,
  },
  Framer: {
    alignment: "Mafia Deception",
    priority: 3,
    goal: "Kill anyone that will not submit to the Mafia.",
    temAcaoNoturna: true,
  },
  // --- NEUTRAL ---
  "Serial Killer": {
    alignment: "Neutral Killing",
    defense: "Basic",
    priority: 5,
    immunities: ["Role block Immunity"],
    goal: "Kill everyone who would oppose you.",
    temAcaoNoturna: true,
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
  "Mayor",
];

module.exports = {
  PAPEIS_DETALHES,
  LISTA_PAPEIS_CLASSICO,
  TOWN_KILLING_ROLES,
  RANDOM_TOWN_ROLES,
};
