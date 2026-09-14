/**
 * Original, non-copyrighted short nonfiction passages for the paced
 * reading exercise (project_prompt.txt's READING MATERIAL section
 * permits "original AI-generated training passages that are validated
 * before use"). Each ships with one multiple-choice comprehension
 * question that requires having read a specific detail or made a
 * cross-sentence inference — never one answerable by guessing from the
 * topic alone (see project_prompt.txt's COMPREHENSION QUESTIONS
 * section).
 *
 * All five passages are currently the same difficulty tier — varying
 * difficulty/genre/vocabulary/length per project_prompt.txt's READING
 * BASELINE guidance is real future scope (tracked in docs/kanban.md),
 * not implemented here.
 */

export interface ComprehensionQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export interface Passage {
  id: string;
  topic: string;
  text: string;
  wordCount: number;
  question: ComprehensionQuestion;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

function passage(
  id: string,
  topic: string,
  text: string,
  question: ComprehensionQuestion
): Passage {
  return { id, topic, text, wordCount: wordCount(text), question };
}

export const READING_PASSAGES: Passage[] = [
  passage(
    "honeybee-waggle-dance",
    "Biology",
    "When a honeybee finds a good source of nectar, it returns to the hive and performs a \"waggle dance\" to tell other bees where to find it. The bee walks in a straight line while vibrating its body, then loops back to repeat the pattern, forming a shape like a figure eight. The direction of the straight-line portion, relative to the sun's position, indicates the direction of the food source, while the duration of the waggle indicates the distance — roughly one second of waggling for every kilometer. Other bees crowd around, sensing the vibrations and the dancer's scent, then fly off to search in the direction and distance the dance described. Karl von Frisch, the researcher who first decoded this behavior, won a Nobel Prize for the discovery. Remarkably, bees can even adjust their dance to account for wind and terrain that might slow a flight down.",
    {
      prompt: "According to the passage, what does the duration of a honeybee's waggle indicate?",
      choices: [
        "The type of flower the nectar came from",
        "The distance to the food source",
        "The number of bees needed to retrieve it",
        "The time of day the food was found",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "printing-press",
    "History",
    "Before the fifteenth century, most books in Europe were copied by hand, a slow process that made books rare and expensive. When Johannes Gutenberg introduced a printing press using movable metal type around 1450, a single printer could produce far more copies of a book in a fraction of the time it took a scribe to copy just one. This did not just make books cheaper — it changed how quickly and widely ideas could spread. Pamphlets, translated Bibles, and scientific works reached readers who previously had no access to them, and literacy slowly became more common outside the wealthy and the clergy. Some historians argue this shift in access to information was one of the conditions that made the Reformation and later the Scientific Revolution possible, since it let new ideas circulate and be challenged in public rather than staying confined to a small circle of scholars.",
    {
      prompt: "Based on the passage, why do some historians connect the printing press to the Reformation and Scientific Revolution?",
      choices: [
        "Gutenberg personally financed both movements",
        "It made paper manufacturing cheaper",
        "It let new ideas circulate widely enough to be publicly challenged",
        "It replaced Latin with local languages in every book",
      ],
      correctIndex: 2,
    }
  ),
  passage(
    "noise-cancelling-headphones",
    "Technology",
    "Noise-cancelling headphones don't just block sound by covering your ears — they actively fight it. A tiny microphone on the headphone picks up the steady, low-frequency hum of an engine or air conditioner, and the headphone's circuitry generates a sound wave that is the exact opposite of that hum, called an inverse wave. When the original noise and the inverse wave reach your ear at the same time, they cancel each other out, a phenomenon called destructive interference. This works well for constant, predictable sounds like airplane engines, which is why the technology became popular with frequent flyers. It works far less well on sudden or irregular sounds, like a dog barking or a person talking nearby, because the circuitry can't predict and cancel a wave it hasn't measured yet. That's why noise-cancelling headphones are marketed for engine noise, not for blocking conversations.",
    {
      prompt: "Why are noise-cancelling headphones less effective against a nearby conversation than against an airplane engine, according to the passage?",
      choices: [
        "Conversations are too quiet for the microphone to detect",
        "The circuitry can't predict and cancel a sound it hasn't already measured",
        "Human voices are a frequency the hardware can't process at all",
        "Airplane cabins are pressurized, which amplifies destructive interference",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "octopus-camouflage",
    "Biology",
    "An octopus can change both the color and the texture of its skin in a fraction of a second, without moving to a new spot first. Thousands of pigment-filled cells called chromatophores sit under the skin, each one surrounded by tiny muscles; when those muscles contract, the pigment sac stretches out and becomes visible, shifting the animal's color almost instantly. Beneath the chromatophores, other muscles can push the skin into bumps and ridges, letting the octopus mimic the texture of nearby rock or coral, not just its color. Because octopuses are colorblind, this camouflage isn't guided by the animal literally comparing colors — researchers still debate exactly how a colorblind creature manages such precise color matching, though some suspect light-sensitive proteins in the skin itself play a role. Either way, the disguise is convincing enough to fool predators that rely heavily on eyesight to hunt.",
    {
      prompt: "What does the passage say is still not fully understood about octopus camouflage?",
      choices: [
        "How the chromatophores physically change color",
        "How a colorblind animal matches colors so precisely",
        "Why predators are fooled by texture changes",
        "How quickly the skin can change texture",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "autumn-leaves",
    "Science",
    "Leaves look green for most of the year because they're full of chlorophyll, the pigment that captures sunlight for photosynthesis, and chlorophyll happens to reflect green light more than any other color. Other pigments, like yellow and orange carotenoids, are in the leaf all along, but chlorophyll is so abundant that it masks them. As days shorten in autumn, trees produce less chlorophyll and begin breaking down what's left to reclaim nutrients before winter; as the green fades, the yellows and oranges that were always there become visible. Red color is different — many trees actively produce a new pigment called anthocyanin in autumn, rather than just revealing a pigment that was already present. Scientists don't fully agree on why trees spend energy making anthocyanin so late in the season, but one leading idea is that it acts like a sunscreen, protecting the leaf's remaining nutrient-reclaiming machinery from bright autumn sunlight.",
    {
      prompt: "According to the passage, how is red autumn color different from yellow or orange autumn color?",
      choices: [
        "Red comes from a pigment newly produced in autumn, not one merely revealed",
        "Red only appears in trees that lack chlorophyll entirely",
        "Red is caused by cold temperatures killing the leaf cells",
        "Red pigments are present all year but are usually the most visible",
      ],
      correctIndex: 0,
    }
  ),
];
