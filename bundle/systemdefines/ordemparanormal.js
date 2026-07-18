const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'cartoon',
      drawingType: 'object',
      behavior: 'horror',
    },
    character: {
      description: ['biography'],
    },
    enemy: {
      description: ['biography'],
    },
  },
};

const gear = ['armament', 'generalEquipment', 'protection'];
for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
