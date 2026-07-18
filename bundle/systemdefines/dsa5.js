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
    career: {
      drawingType: 'character',
    },
    culture: {
      drawingType: 'character',
    },
    money: {
      drawingType: 'object',
    },
    species: {
      drawingType: 'character',
    },
  },
  translationHints: {},
};

for (const type of Item.TYPES) {
  if (
    !game.dsa5.config.equipmentCategories.has(type) &&
    !systemInfo.itemTypes[type]
  ) {
    systemInfo.itemTypes[type] = {
      drawingType: 'symbol',
    };
  }
}

export default systemInfo;
