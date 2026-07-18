const systemInfo = {
  itemTypes: {
    default: {
      description: ['description'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'scifi',
    },
    character: {
      description: ['biography'],
    },
    homestead: {
      description: ['biography'],
      drawingType: 'object',
    },
    minion: {
      description: ['biography'],
    },
    nemesis: {
      description: ['biography'],
    },
    rival: {
      description: ['biography'],
    },
    vehicle: {
      description: ['description.value'],
      drawingType: 'object',
    },
  },
};

const gear = ['armour', 'career', 'gear', 'itemattachment', 'itemmodifier', 'shipattachment', 'shipweapon', 'homesteadupgrade', 'species', 'weapon'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
