const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Generate a random uppercase alphanumeric code (access codes, task ids).
export const generateCode = (length = 6, random = Math.random) => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS.charAt(Math.floor(random() * CODE_CHARS.length));
  }
  return result;
};
