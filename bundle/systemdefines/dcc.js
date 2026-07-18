const systemInfo = {
  itemTypes: {
    default: {
      description: ['description.value'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'fantasy',
    },
    character: {
      description: ['details.notes.value'],
    },
    npc: {
      description: ['details.notes.value'],
    },
  },
};

const gear = ['weapon', 'ammunition', 'armor', 'equipment', 'mount', 'treasure'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
