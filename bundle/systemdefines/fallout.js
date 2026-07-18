const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'cartoon',
      drawingType: 'object',
      behavior: 'postapocalyptic',
    },
    character: {
      description: ['biography'],
    },
    npc: {
      description: ['biography'],
    },
    creature: {
      description: ['biography'],
    },
    robot: {
      description: ['biography'],
    },
    scavenging_location: {
      description: ['notes'],
      drawingType: 'symbol',
    },
    settlement: {
      description: ['biography'],
      drawingType: 'symbol',
    },
  },
};

const gear = ['ammo', 'apparel', 'apparel_mod', 'books_and_magz', 'consumable', 'miscellany', 'object_or_structure', 'robot_armor', 'robot_mod', 'weapon', 'weapon_mod'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
