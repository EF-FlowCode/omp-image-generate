declare module "bun:test" {
  export const describe: (name: string, fn: () => void) => void;
  export const test: (name: string, fn: () => void) => void;
  export const expect: <T>(actual: T) => {
    toEqual(expected: unknown): void;
  };
}
