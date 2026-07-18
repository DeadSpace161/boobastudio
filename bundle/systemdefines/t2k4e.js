const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'postapocalyptic',
    },
    character: {
      description: ['bio.appearance'],
    },
    npc: {
      description: ['description'],
    },
    party: {
      description: ['bio.appearance'],
    },
    unit: {
      description: ['description'],
    },
    vehicle: {
      description: ['bio.appearance'],
      drawingType: 'object',
    },
  },
};

const gear = ['weapon', 'armor', 'ammunition', 'grenade', 'gear'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
