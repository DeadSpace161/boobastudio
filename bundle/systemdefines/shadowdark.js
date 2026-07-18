const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'fantasy',
    },
    NPC: {
      description: ['notes'],
    },
    Player: {
      description: ['notes'],
    },
  },
};

const gear = ['Armor', 'Gem', 'Potion', 'Scroll', 'Wand', 'Weapon'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
