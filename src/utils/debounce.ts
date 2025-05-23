export const debounce = <T extends (...a: any[]) => void>(fn: T, ms: number) => {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};
