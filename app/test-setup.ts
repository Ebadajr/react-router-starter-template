import '@testing-library/jest-dom';

// Mock sessionStorage and localStorage for all tests
const makeStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
};

Object.defineProperty(window, 'localStorage', { value: makeStorage(), writable: true });
Object.defineProperty(window, 'sessionStorage', { value: makeStorage(), writable: true });

// Clear storages between tests
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
