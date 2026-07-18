const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'superhero',
    },
    personnage: {
      description: ['bio.appearance'],
    },
    qg: {
      description: ['description'],
    },
    vehicule: {
      description: ['bio.appearance'],
      drawingType: 'object',
    },
    pouvoir: {
      description: ['notes'],
    },
  },
};

const gear = ['equipement'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
