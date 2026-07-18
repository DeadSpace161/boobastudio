const untranslateableActorFields = new Set(['traits.size']);

const systemInfo = {
  itemTypes: {
    default: {
      description: ['description.value'],
      drawingStyle: 'realistic',
      drawingType: 'object',
      behavior: 'fantasy',
    },
    character: {
      description: ['details.description.value'],
    },
    npc: {
      description: ['details.description.value'],
    },
    vehicle: {
      description: ['details.description.value'],
    },
    group: {
      description: ['details.description.value'],
    },
  },
  connectButton: (app, html, callback) => {
    const randomContentButton = $('<a data-tooltip="cibola8.tooltip.randomContent" class=""><i class="cib8-icon icon-cibola8"></i></a>');

    randomContentButton.on('click', (ev) => {
      let elem = $(ev.currentTarget).next('.description-edit')[0];
      if (!elem) elem = $(ev.currentTarget).closest('[data-target]')[0];
      const attribute = elem.dataset.target;
      callback(attribute);
    });

    html.find('.description-edit,.editor-edit').before(randomContentButton);
  },
  nonTranslatableFields: ['IdentifierField'],
  nonTranslatablePaths: {
    character: untranslateableActorFields,
    npc: untranslateableActorFields,
  },
};

const gear = ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container', 'backpack'];

for (const type of Item.TYPES) {
  const drawingType = gear.includes(type) ? 'object' : 'symbol';
  systemInfo.itemTypes[type] = { drawingType };
}

export default systemInfo;
