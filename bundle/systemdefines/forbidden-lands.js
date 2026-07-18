const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'fantasy',
    },
    character: {
      description: ['bio.note.value'],
    },
    monster: {
      description: ['features'],
    },
    party: {
      description: ['description'],
    },
    stronghold: {
      description: ['description'],
    },
    weapon: {
      description: ['features.others'],
    },
  },
};

const gear = ['armor', 'gear', 'weapon', 'rawMaterial', 'building', 'hireling'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
