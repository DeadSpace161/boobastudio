const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'fantasy',
    },
    character: {
      description: ['description'],
    },
    creature: {
      description: ['details.biography'],
    },
    container: {
      description: ['description'],
    },
    vehicle: {
      description: ['description'],
    },
    vehicle_npc: {
      description: ['description'],
    },
  },
};

const gear = ['weapon', 'ammo', 'container', 'armor', 'hat', 'cargo'];
for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
