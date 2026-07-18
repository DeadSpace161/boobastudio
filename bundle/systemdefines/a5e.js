const systemInfo = {
  itemTypes: {
    default: {
      description: ['description.value'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'fantasy',
    },
    character: {
      description: ['details.biography.value'],
    },
    npc: {
      description: ['details.biography.value'],
    },
  },
};

const gear = ['item', 'armor', 'container', 'currency', 'potion', 'race', 'weapon'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
