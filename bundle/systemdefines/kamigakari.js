const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'cartoon',
      drawingType: 'object',
      behavior: 'modern',
    },
    character: {
      description: ['details.biography'],
    },
    enemy: {
      description: ['details.biography'],
    },
  },
};

const gear = ['equipment', 'item', 'race'];
for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
