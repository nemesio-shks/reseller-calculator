// Завантажує довідник авто (assets/cars/cars.json) і робить його доступним як window.CARS_DB
window.CAR_CATEGORY_ICONS = {
  econom: '🚗',
  middle: '🚙',
  premium: '🏎️',
  trucks: '🚚',
  moto: '🏍️',
  water: '🚤',
  air: '🚁',
  rare: '💎',
  exclusive: '👑',
  rv: '🚐'
};

window.CARS_DB = null;
window.CARS_FLAT_LIST = [];

fetch('assets/cars/cars.json')
  .then(res => res.json())
  .then(db => {
    window.CARS_DB = db;
    const flat = [];
    for (const catKey in db) {
      const category = db[catKey];
      category.cars.forEach(car => {
        flat.push({
          id: car.id,
          name: car.name,
          price: car.price,
          info: car.info,
          image: car.image,
          category: catKey,
          categoryLabel: category.label,
          icon: window.CAR_CATEGORY_ICONS[catKey] || '🚘'
        });
      });
    }
    window.CARS_FLAT_LIST = flat;
    window.dispatchEvent(new Event('carsDbReady'));
  })
  .catch(err => {
    console.error('Не вдалося завантажити базу авто:', err);
  });
