const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'fantasy',
    },
    discipline: {
      drawingType: 'character',
    },
    namegiver: {
      drawingType: 'character',
    },
  },
};

const gear = ['armor', 'equipment', 'shield', 'weapon'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
