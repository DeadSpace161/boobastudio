const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'scifi',
    },
    character: {
      description: ['notes'],
    },
    npc: {
      description: ['notes'],
    },
    ship: {
      description: ['notes'],
    },
  },
};

const gear = ['gear', 'weapon', 'armor', 'shipModule'];
for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
