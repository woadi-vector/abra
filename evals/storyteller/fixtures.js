// Hand-authored Storyteller outputs used to unit-test the tell-CHECKERS offline.
// For each case:
//   good → a structure-preserving output; every `code` tell must PASS.
//   bad  → an output where THIS case's tidying instinct crept in; at least one
//          `code` tell must FAIL.
// This proves the checks discriminate before we ever spend an API call, and
// guards the regexes against silently passing everything.

export const FIXTURES = {
  bongo: {
    good: {
      title: 'Bongo',
      pages: [
        { text: "There's a robot and his name is Bongo and he has a jetpack and the jetpack is blue.", illustration_note: 'A robot named Bongo with a blue jetpack.' },
        { text: 'There is also a shark but he is a land shark and he walks on the ground and his name is Bongo too.', illustration_note: 'A shark walking on the ground, also called Bongo.' },
        { text: 'Bongo the robot flies up and up with the blue jetpack.', illustration_note: 'The robot Bongo rising with his blue jetpack.' },
        { text: "They go to grandma's house and grandma makes pancakes for the shark.", illustration_note: 'Grandma making pancakes for the land shark.' },
        { text: 'Then the tail breaks and it takes a hundred years to fix. A hundred whole years.', illustration_note: 'A broken tail with a "100 years" sign.' },
        { text: 'The end.', illustration_note: 'A closing "The end" title card.' },
        { text: 'Wait — no.', illustration_note: 'A pause — the storyteller changing their mind.' },
        { text: 'It was the moon the whole time. The moon was always there.', illustration_note: 'The big moon, which was there all along.' },
      ],
    },
    // Tidied: the "Wait — no." self-interruption was smoothed away.
    bad: {
      title: 'Bongo',
      pages: [
        { text: "There's a robot named Bongo with a blue jetpack, and a land shark also named Bongo.", illustration_note: 'Two Bongos: a robot and a land shark.' },
        { text: 'Bongo the robot flies up with the blue jetpack to grandma for pancakes.', illustration_note: 'Robot Bongo flying to grandma.' },
        { text: 'The tail breaks and takes a hundred years to fix, and then it was the moon the whole time.', illustration_note: 'A broken tail and the moon.' },
      ],
    },
  },

  'bike-girl': {
    good: {
      title: 'The Girl and the Bike',
      pages: [
        { text: "There's a girl and she has a bike and the bike is red and she rides it to the store to get gum.", illustration_note: 'A girl on a red bike heading to the store.' },
        { text: "But the store is closed so she rides to the park and there's a duck.", illustration_note: 'Closed store, then a park with a duck.' },
        { text: "The duck wants the gum but she doesn't have gum because the store was closed and then", illustration_note: 'The duck looking at her empty hands.' },
      ],
    },
    // Tidied: an ending was invented after "and then".
    bad: {
      title: 'The Girl and the Bike',
      pages: [
        { text: 'A girl rides her red bike to the store for gum, but it is closed.', illustration_note: 'A girl on a red bike at a closed store.' },
        { text: 'She rides to the park where a duck wants gum, and then she went home.', illustration_note: 'The girl waving goodbye to the duck.' },
      ],
    },
  },

  max: {
    good: {
      title: 'Max',
      pages: [
        { text: "My dog is named Max. He's a really big dog, the biggest.", illustration_note: 'An enormous dog named Max.' },
        { text: "He's brown.", illustration_note: 'The dog, brown.' },
        { text: "Max fits in my pocket because he's so tiny.", illustration_note: 'The same dog, tiny, in a pocket.' },
        { text: "He's the biggest dog and also he's black.", illustration_note: 'The dog shown biggest, and also black.' },
        { text: "We got him yesterday but I've had him forever since I was a baby.", illustration_note: 'A "yesterday" calendar and a baby photo, both true.' },
      ],
    },
    // Tidied: contradictions blended/explained, and the time pair collapsed.
    bad: {
      title: 'Max',
      pages: [
        { text: "My dog Max looks like the biggest dog but he's really tiny enough to fit in my pocket.", illustration_note: 'A dog that looks big but is actually small.' },
        { text: "He's a brownish-black color.", illustration_note: 'A brownish-black dog.' },
        { text: 'We got him a little while ago.', illustration_note: 'Max as a newish pet.' },
      ],
    },
  },

  dinosaurs: {
    good: {
      title: 'Dinosaurs',
      pages: [
        { text: "Dinosaurs. There's a red one.", illustration_note: 'A red dinosaur.' },
        { text: 'And a blue one.', illustration_note: 'A blue dinosaur.' },
        { text: 'And one with a long neck.', illustration_note: 'A long-necked dinosaur.' },
        { text: "And one that flies but it's not actually a dinosaur my teacher said but I like it anyway.", illustration_note: 'A flying reptile, with a note that the teacher says it is not a dinosaur.' },
        { text: 'And a baby one.', illustration_note: 'A baby dinosaur.' },
        { text: "And a mean one. And that's all the dinosaurs.", illustration_note: 'A mean dinosaur; the lineup is complete.' },
        { text: 'Spikes. Some have spikes.', illustration_note: 'A close-up of spikes on some of them.' },
      ],
    },
    // Tidied: plot imposed on the list; teacher tangent dropped; spikes folded in.
    bad: {
      title: 'The Dinosaur Adventure',
      pages: [
        { text: 'One day the red dinosaur met the blue dinosaur and they went on an adventure.', illustration_note: 'The red and blue dinosaurs setting off together.' },
        { text: 'The long-neck one had spikes too, and the baby one followed them on their journey.', illustration_note: 'The group traveling together.' },
      ],
    },
  },

  spaceman: {
    good: {
      title: 'The Spaceman',
      pages: [
        { text: 'So the spaceman goes up and up and up and up and up past the clouds and past the birds and past a plane and the plane says hi.', illustration_note: 'A spaceman rising past clouds, birds, and a friendly plane.' },
        { text: 'And he goes up more and up.', illustration_note: 'The spaceman still climbing higher.' },
        { text: "And there's a star and the star is his mom and he's so happy.", illustration_note: 'A star that is his mom; the spaceman overjoyed.' },
        { text: 'And they eat space soup together forever and ever and ever and ever.', illustration_note: 'The spaceman and the star-mom eating space soup.' },
      ],
    },
    // Tidied: the rhythmic runs trimmed to a single "up" and a single "forever".
    bad: {
      title: 'The Spaceman',
      pages: [
        { text: 'The spaceman goes up past the clouds and the birds and a plane, and the plane says hi.', illustration_note: 'A spaceman flying past clouds and a plane.' },
        { text: 'He goes to a star, and the star is his mom, and they eat space soup together forever.', illustration_note: 'The spaceman eating soup with the star.' },
      ],
    },
  },
};
