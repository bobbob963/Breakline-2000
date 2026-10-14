import { inject } from '@vercel/analytics';

// Count visits to the published game, not local builds, offline copies or
// StackBlitz previews. Add any future production custom domain here too.
const productionHosts = ['breakline-2000.vercel.app', 'breakline99.com', 'www.breakline99.com'];
if (import.meta.env.PROD && location.protocol === 'https:' &&
    productionHosts.includes(location.hostname)) {
  inject({ mode: 'production' });
}
