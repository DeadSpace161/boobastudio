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
    creature: {
      description: ['details.biography.value'],
    },
    vehicle: {
      description: ['details.description.value'],
      drawingType: 'object',
    },
  },
};

const gear = ['ammunition', 'armour', 'career', 'container', 'money', 'mutation', 'trapping', 'weapon', 'vehicleMod', 'cargo'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
