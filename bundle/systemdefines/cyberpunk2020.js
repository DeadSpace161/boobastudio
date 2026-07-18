const systemInfo = {
  itemTypes: {
    default: {
      description: ['notes'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'cyberpunk',
    },
  },
};

const gear = ['weapon', 'armor', 'cyberware', 'vehicle', 'misc'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
