const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'steampunk',
    },
    character: {
      description: ['description'],
    },
    npc: {
      description: ['description'],
    },
    crew: {
      description: ['description'],
    },
  },
};

const gear = ['item'];
for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
