export const IDENTITY_KEY = 'breakline99-rider-identity-v1';
export const RIDER_NAME_LIMIT = 20;

const blankIdentity = () => ({ name: '', tutorialComplete: false });

/** Keep names readable while counting Unicode characters instead of UTF-16 halves. */
export function sanitizeRiderName(value) {
  if (typeof value !== 'string') return '';
  const clean = value.normalize('NFC').replace(/\s+/gu, ' ')
    .replace(/[\p{Cc}\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '').trim();
  return Array.from(clean).slice(0, RIDER_NAME_LIMIT).join('').trim();
}

export function loadRiderIdentity(storage) {
  try {
    const saved = JSON.parse(storage.getItem(IDENTITY_KEY));
    if (!saved || Array.isArray(saved) || typeof saved.name !== 'string' || typeof saved.tutorialComplete !== 'boolean') return blankIdentity();
    const name = sanitizeRiderName(saved.name);
    if (saved.tutorialComplete && !name) return blankIdentity();
    return { name, tutorialComplete: saved.tutorialComplete };
  } catch {
    return blankIdentity();
  }
}

/** A single write keeps the chosen name and first-visit completion together. */
export function saveRiderIdentity(storage, value) {
  const name = sanitizeRiderName(value);
  if (!name) throw new Error('Enter a name for your rider before continuing.');
  const identity = { name, tutorialComplete: true };
  try {
    storage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch (cause) {
    throw new Error('Your browser could not save your rider name. Please allow storage and try again.', { cause });
  }
  return identity;
}
