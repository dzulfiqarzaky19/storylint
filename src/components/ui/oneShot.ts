export interface OneShot {
  fire: (cb: () => void) => void;
  reset: () => void;
  fired: () => boolean;
}

export function createOneShot(): OneShot {
  let spent = false;
  return {
    fire(cb: () => void) {
      if (spent) return;
      spent = true;
      cb();
    },
    reset() {
      spent = false;
    },
    fired() {
      return spent;
    },
  };
}
