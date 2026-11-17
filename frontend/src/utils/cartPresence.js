// Decides "the cart is there" from many camera checks, so one missed check does not flip the answer.
//   - the cart counts as there after it is seen in 2 of the last 3 checks
//   - once there, it only counts as gone after it is missed 6 checks in a row (about 3 seconds)
export function makePresence({ look = 3, need = 2, exitAfter = 6 } = {}) {
  let recent = [];
  let present = false;
  let misses = 0;
  let seen = 0;

  return {
    push(found) {
      seen += 1;
      recent.push(found);
      if (recent.length > look) recent.shift();
      misses = found ? 0 : misses + 1;
      if (!present && recent.filter(Boolean).length >= need) {
        present = true;
      } else if (present && misses >= exitAfter) {
        present = false;
        recent = [];
      }
    },
    reset() {
      recent = [];
      present = false;
      misses = 0;
      seen = 0;
    },
    ready: () => seen >= 3 || present,
    present: () => present,
  };
}
