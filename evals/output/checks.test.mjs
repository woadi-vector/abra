// Offline unit test for the deterministic output-format layer — no API calls.
//
//   node evals/output/checks.test.mjs
//
// Character Friend's LLM step is exercised live via the demo; here we prove the
// deterministic parts: stable visual identity, character-consistent illustration
// specs, narration, book assembly, and the premium animation gate/stub.

import { withVisualIdentity, stableSeed, slugify } from '../../src/agents/characterFriend.js';
import { illustrate, STORYBOOK_STYLE, matchKeywords } from '../../src/agents/illustrator.js';
import { narrate } from '../../src/agents/narrator.js';
import { bindBook } from '../../src/agents/bookbinder.js';
import { animationGate, animateBook, ANIMATION } from '../../src/agents/animator.js';
import { createCharacterLibrary } from '../../src/characterLibrary.js';

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

// --- stable, reusable visual identity ---------------------------------------
ok(stableSeed('rocket') === stableSeed('rocket'), 'stableSeed is deterministic');
ok(slugify('Max the Dog!') === 'max_the_dog', 'slugify makes a clean id');
const rocketA = withVisualIdentity({ id: 'Rocket', name: 'Rocket', species: 'rocket ship', canonical: 'a cardboard-box rocket wrapped in tape', attributes: {}, contradictions: [] });
const rocketB = withVisualIdentity({ id: 'rocket', name: 'Rocket', species: 'rocket ship', canonical: 'a cardboard-box rocket wrapped in tape', attributes: {}, contradictions: [] });
ok(rocketA.id === 'rocket' && rocketA.seed === rocketB.seed, 'same character ⇒ same id + same seed (reusable by animator)');
ok(rocketA.emoji === rocketB.emoji && rocketA.palette[0] === rocketB.palette[0], 'same character ⇒ same emoji + palette (consistent across pages)');
ok(rocketA.emoji === '🚀', 'species drives a meaningful emoji (rocket → 🚀)');

// --- placeholder emoji matches NAME/SPECIES (bug: birds → bear; people collide) ---
const emojiFor = (name, species, canonical = '') =>
  withVisualIdentity({ id: name, name, species, canonical, attributes: {}, contradictions: [] }).emoji;
ok(emojiFor('The Birds', 'birds') === '🐦', 'birds → 🐦 (the reported bug: was a bear)');
ok(emojiFor('The Birds', 'birds') !== '🐻', 'birds are never rendered as a bear');
ok(emojiFor('The Clouds', 'clouds') === '☁️', 'clouds → ☁️');
ok(emojiFor('The Star', 'star') === '⭐', 'star → ⭐');
ok(emojiFor('Space Soup', 'soup') === '🍲', 'soup → 🍲');
ok(emojiFor('The Spaceman', 'spaceman') === '👨‍🚀', 'spaceman → astronaut');
ok(emojiFor('Mom', 'mother') === '👩', 'mom → 👩');
ok(emojiFor('The Spaceman', 'spaceman') !== emojiFor('Mom', 'mother'), 'spaceman and his mom get DIFFERENT images');
const spacemanCast = [['The Spaceman', 'spaceman'], ['The Birds', 'birds'], ['The Clouds', 'clouds'], ['The Star', 'star'], ['Space Soup', 'soup'], ['The Plane', 'plane']].map(([n, s]) => emojiFor(n, s));
ok(new Set(spacemanCast).size === spacemanCast.length, 'spaceman-story cast: every placeholder distinct');
ok(!spacemanCast.includes('🐻'), 'spaceman-story cast: no accidental bear');
const coCast = [['Pip', 'fox'], ['Rocket', 'rocket ship'], ['Grandpa', 'grandpa'], ['The Moon', 'moon'], ['The Waffles', 'waffles']].map(([n, s]) => emojiFor(n, s));
ok(new Set(coCast).size === coCast.length, 'co-write cast: every placeholder distinct');
const genericPerson = emojiFor('Zorp', 'a mysterious person');
ok(!['🐻', '🦊', '🐰', '🐱', '🐶', '🐸'].includes(genericPerson), 'an unmatched person is a person, never an animal');
// species beats a person-word in the name ("Grandpa house" IS a house)
ok(emojiFor('Grandpa house', 'house') === '🏠', 'species wins over the name: Grandpa house → 🏠');
ok(emojiFor('Grandpa house', 'house') !== emojiFor('Grandpa', 'grandpa'), 'the house and grandpa get different images');
// a both-true "star who is his mom" reads as the star (lead noun), and still appears
ok(emojiFor('The Star (his mom)', 'star who is his mom') === '⭐', 'the star that is his mom → ⭐');

// --- per-page character matching (bug: star-mom & plane missing on their pages) ---
const mkC = (id, name, species, canonical) => withVisualIdentity({ id, name, species, canonical, attributes: {}, contradictions: [] });
const spCast = [
  mkC('spaceman', 'The Spaceman', 'spaceman (astronaut)', 'a friendly spaceman'),
  mkC('birds', 'The Birds', 'birds', 'small birds'),
  mkC('clouds', 'The Clouds', 'clouds', 'fluffy clouds'),
  mkC('plane', 'The Plane', 'airplane that can talk', 'a friendly talking airplane'),
  mkC('star_mom', 'The Star (his mom)', 'star who is his mom', 'a big star who is his mom, both at once'),
  mkC('soup', 'Space Soup', 'soup (object)', 'bowls of space soup'),
];
const idsOn = (page) => illustrate([page], spCast)[0].illustration.characters;
ok(matchKeywords(spCast[4]).includes('star') && matchKeywords(spCast[4]).includes('mom'), 'star-mom keywords include star + mom');
const planePage = idsOn({ text: 'past the clouds and past the birds and past a plane and the plane says hi', illustration_note: 'The spaceman passing clouds, then birds, then an airplane.' });
ok(planePage.includes('plane'), 'the PLANE now appears on the clouds/birds/plane page');
ok(planePage.includes('clouds') && planePage.includes('birds'), 'clouds + birds still appear on that page');
const starPage = idsOn({ text: "and there's a star and the star is his mom", illustration_note: 'A big star in space; the star is his mom, both at once.' });
ok(starPage.includes('star_mom'), 'the STAR-MOM now appears on her own page (was missing → rocket)');
const soupPage = idsOn({ text: 'and they eat space soup together forever and ever', illustration_note: 'The spaceman and the star-mom eating bowls of space soup together.' });
ok(soupPage.includes('star_mom') && soupPage.includes('soup'), 'the star-mom + soup both appear on the eating-soup page');

// --- illustrator injects the canonical description on every page a character appears ---
const chars = [
  withVisualIdentity({ id: 'pip', name: 'Pip', species: 'fox', canonical: 'Pip is a small orange fox with a bushy tail.', attributes: {}, contradictions: [] }),
  withVisualIdentity({ id: 'rocket', name: 'Rocket', species: 'rocket ship', canonical: 'Rocket is a cardboard-box ship covered in tape.', attributes: {}, contradictions: [] }),
];
const pages = [
  { text: 'Pip the fox climbed into Rocket.', illustration_note: 'Pip getting into the rocket.' },
  { text: 'Rocket flew to the moon.', illustration_note: 'The rocket near a big moon.' },
  { text: 'The moon had a slide.', illustration_note: 'A slide on the moon.' },
];
const illustrated = illustrate(pages, chars);
ok(illustrated[0].illustration.characters.sort().join(',') === 'pip,rocket', 'page 1 detects both characters present');
ok(illustrated[0].illustration.prompt.includes('bushy tail') && illustrated[0].illustration.prompt.includes('covered in tape'), 'page 1 prompt injects BOTH canonicals verbatim');
ok(illustrated[1].illustration.characters.join(',') === 'rocket', 'page 2 detects only Rocket');
ok(illustrated[1].illustration.prompt.includes('covered in tape') && !illustrated[1].illustration.prompt.includes('bushy tail'), 'page 2 prompt has Rocket canonical, not Pip');
// consistency: the same character's canonical is byte-identical on every page it appears
const rocketOnP1 = chars[1].canonical;
ok(illustrated[0].illustration.prompt.includes(rocketOnP1) && illustrated[1].illustration.prompt.includes(rocketOnP1), 'Rocket renders identically across pages (same canonical injected)');
ok(illustrated[2].illustration.characters.length === 0, 'a page with no named character has no characters (scene-only)');
ok(illustrated[0].illustration.prompt.startsWith(STORYBOOK_STYLE.slice(0, 12)), 'shared style anchor leads every prompt');

// --- narrator keeps the child's words ---------------------------------------
const narrated = narrate(illustrated);
ok(narrated[0].narration.text === pages[0].text, 'narration is the child\'s exact words');

// --- bookbinder assembles the deliverable -----------------------------------
const book = bindBook({ title: 'Pip & Rocket', authors: ['Jason', 'Trenton'], characters: chars, pages: narrated, coWriting: true });
ok(book.pages.length === 3 && book.characters.length === 2, 'book has all pages + characters');
ok(book.layout.variants.join(',') === 'storybook,comic' && book.layout.default === 'storybook', 'two V1 layouts, storybook default');
ok(book.pages[0].illustration && book.pages[0].narration, 'each bound page carries illustration + narration');
ok(book.meta.coWriting === true && book.meta.characterCount === 2, 'book meta reflects co-writing + character count');

// --- premium animation: declared, gated, not implemented --------------------
ok(book.premium.animation.unlocked === false && book.premium.animation.tier === 'premium', 'animation is premium and LOCKED by default');
ok(book.premium.animation.requiresEntitlement === 'full_access', 'animation gate references the RevenueCat entitlement');
ok(animationGate({ isSubscriber: true }).unlocked === true, 'animation unlocks for a subscriber');
ok(animationGate({ credits: ANIMATION.creditCost }).unlocked === true, 'animation unlocks with a big-enough credit pack');
let threw = false;
try { await animateBook(book); } catch { threw = true; }
ok(threw, 'animateBook is a stub — throws NotImplemented (v2, not built)');

// --- character library holds a stable definition ----------------------------
const lib = createCharacterLibrary();
lib.clear();
lib.upsert(chars[0]);
lib.upsert({ ...chars[0], canonical: 'DRIFTED description' });
ok(lib.get('pip').canonical === chars[0].canonical, 'library HOLDS the first stable canonical (no drift on re-upsert)');
lib.clear();

console.log('');
if (failures) {
  console.log(`FAIL — ${failures} output-layer check(s) failed.`);
  process.exit(1);
}
console.log('PASS — output layer: character consistency, layouts, narration, and premium stub all sound.');
