const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'fantasy',
    },
    character: {
      description: ['appearance'],
    },
    npc: {
      description: ['description'],
    },
    monster: {
      description: ['description'],
    },
  },
};

const gear = ['armor', 'helmet', 'item', 'profession', 'weapon'];
for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
