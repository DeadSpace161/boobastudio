const systemInfo = {
  itemTypes: {
    default: {
      description: ['attributes.comment.value'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'scifi',
    },
    character: {
      description: ['notes'],
    },
    synthetic: {
      description: ['notes'],
    },
    planet: {
      description: ['notes'],
      drawingType: 'symbol',
    },
    vehicles: {
      description: ['notes'],
    },
    creature: {
      description: ['notes'],
    },
    territory: {
      description: ['notes'],
      drawingType: 'symbol',
    },
    spacecraft: {
      description: ['notes'],
    },
    colony: {
      description: ['notes'],
      drawingType: 'symbol',
    },
  },
};

const gear = ['item', 'weapon', 'armor', 'spacecraftmods', 'spacecraftweapons'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
