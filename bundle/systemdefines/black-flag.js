const systemInfo = {
  itemTypes: {
    default: {
      description: ['description.value'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'fantasy',
    },
    pc: {
      description: ['biography.backstory'],
    },
    npc: {
      description: ['biography.value'],
    },
  },
};

const gear = ['ammunition', 'armor', 'consumable', 'container', 'currency', 'gear', 'tool', 'weapon'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
