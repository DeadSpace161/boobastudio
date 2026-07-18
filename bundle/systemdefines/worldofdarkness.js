const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'mystery',
    },
    ghoul: {
      description: ['appearance'],
    },
    hunter: {
      description: ['appearance'],
    },
    vampire: {
      description: ['appearance'],
    },
    werewolf: {
      description: ['appearance'],
    },
    mortal: {
      description: ['appearance'],
    },
    spc: {
      description: ['appearance'],
    },
  },
};

const gear = [];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
