export const getByValue = (map, searchValue) => {
  for (let [key, value] of map) {
    if (value === searchValue) return key;
  }
};
