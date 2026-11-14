const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Generate a random uppercase alphanumeric code (access codes, task ids).
export const generateCode = (length = 6, random = Math.random) => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS.charAt(Math.floor(random() * CODE_CHARS.length));
  }
  return result;
};

// Uniform float in [0, 1) from the platform CSPRNG, for codes that guard access.
export const secureRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

// Access codes are secrets checked by the Firestore rules (which require at
// least 8 characters), so they use the CSPRNG rather than Math.random.
export const ACCESS_CODE_LENGTH = 8;
export const generateAccessCode = () => generateCode(ACCESS_CODE_LENGTH, secureRandom);
