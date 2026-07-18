const systemInfo = {
  itemTypes: {
    default: {
      description: ['description.value'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'fantasy',
    },
    character: {
      description: ['details.biography.appearance'],
    },
    npc: {
      description: ['details.publicNotes'],
    },
    hazard: {
      description: ['details.description'],
    },
    loot: {
      description: ['details.description'],
    },
    familiar: {
      description: ['details.description'],
    },
    vehicle: {
      description: ['details.description'],
    },
    army: {
      description: ['details.description'],
    },
  },
};

const gear = [
  'armor',
  'backpack',
  'book',
  'consumable',
  'equipment',
  'melee',
  'shield',
  'treasure',
  'weapon',
];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
