const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'historical',
    },
    character: {
      description: ['details.appearance'],
    },
    npc: {
      description: ['details.biography.value'],
    },
    vehicle: {
      description: ['description'],
      drawingType: 'object',
    },
  },
};

const gear = ['weapon', 'armor', 'shield', 'gear', 'consumable'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
