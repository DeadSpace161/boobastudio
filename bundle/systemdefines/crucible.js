const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'fantasy',
    },
    hero: {
      description: ['details.biography.appearance'],
    },
    adversary: {
      description: ['details.biography.appearance'],
    },
    armor: {
      description: ['description.public'],
    },
    weapon: {
      description: ['description.public'],
    },
  },
};

const gear = ['armor', 'weapon'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
