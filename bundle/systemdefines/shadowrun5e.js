const systemInfo = {
  itemTypes: {
    default: {
      description: ['description.value'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'cyberpunk',
    },
  },
};

const gear = ['ammo', 'armor', 'bioware', 'contact', 'cyberware', 'device', 'echo', 'equipment', 'host', 'modification', 'weapon'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
