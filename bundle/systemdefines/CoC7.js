const systemInfo = {
  itemTypes: {
    default: {
      description: ['description.value'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'horror',
    },
    character: {},
    npc: {
      description: ['biography.personalDescription.value'],
    },
    container: {
      description: ['description.value'],
    },
    creature: {
      description: ['biography.personalDescription.value'],
    },
  },
};

const gear = ['item', 'weapon', 'occupation', 'archetype', 'book'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
