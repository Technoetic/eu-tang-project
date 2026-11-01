import { HomeScreen } from './screens/home-screen.js';
import { entryDecision } from './services/entry-service.js';
import { HeroMotion } from './components/hero-motion.js';

const build = document.querySelector('meta[name="app-build"]').content;
const basePath = document.querySelector('meta[name="app-base"]')?.content || '/';
const decision = await entryDecision({ loadedBuild: build, basePath });
if (decision.kind === 'document') location.replace(decision.url);
else {
  const screen = new HomeScreen({ build, basePath, projectURL: new URL('./project.json', import.meta.url).href });
  await screen.mount();
  const hero = document.querySelector('#home[data-hero-motion]');
  if (hero) {
    const motion = new HeroMotion(hero); motion.mount();
    const pagehide = event => {
      if (!event.persisted) { motion.dispose(); window.removeEventListener('pagehide', pagehide); }
    };
    window.addEventListener('pagehide', pagehide);
  }
}
