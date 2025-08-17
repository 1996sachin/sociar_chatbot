export const getByValue = (map: Map<string, any>, searchValue: string) => {
  for (const [key, value] of map) {
    if (value === searchValue) return key;
  }
};
