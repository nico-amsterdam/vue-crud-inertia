export function createRequire(_url: string) {
  return () => {
    throw new Error('createRequire is not supported in this environment')
  }
}
