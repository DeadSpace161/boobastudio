const systemInfo = {
  itemTypes: {
    default: {
      description: ['description.value'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'scifi',
    },
    character: {
      description: ['details.biography.value'],
    },
    drone: {
      description: ['details.biography.value'],
    },
    hazard: {
      description: ['details.description.value'],
      drawingType: 'object',
    },
    npc: {
      description: ['details.biography.value'],
    },
    npc2: {
      description: ['details.biography.value'],
    },
    starship: {
      description: ['details.notes'],
      drawingType: 'object',
    },
    vehicle: {
      description: ['details.description.value'],
      drawingType: 'object',
    },
  },
};

const gear = [
  'archetypes',
  'class',
  'race',
  'asi',
  'chassis',
  'mod',
  'starshipAblativeArmor',
  'starshipArmor',
  'starshipComputer',
  'starshipCrewQuarter',
  'starshipDefensiveCountermeasure',
  'starshipDriftEngine',
  'starshipExpansionBay',
  'starshipFortifiedHull',
  'starshipFrame',
  'starshipOtherSystem',
  'starshipPowerCore',
  'starshipReinforcedBulkhead',
  'starshipSecuritySystem',
  'starshipSensor',
  'starshipShield',
  'starshipThruster',
  'starshipWeapon',
  'vehicleAttack',
  'vehicleSystem',
  'ammunition',
  'augmentation',
  'consumable',
  'container',
  'equipment',
  'fusion',
  'goods',
  'hybrid',
  'shield',
  'weapon',
  'weaponAccessory',
];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
