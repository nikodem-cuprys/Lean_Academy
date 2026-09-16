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
 * Spans three genuinely different difficulty tiers (docs/kanban.md's
 * "Expand and rotate the reading-passage bank" card), not just one —
 * `difficultyTier` varies real, load-bearing properties: sentence
 * length/structure, vocabulary complexity, and overall passage length
 * (beginner ~90-110 words, intermediate ~140-165 words, advanced
 * ~210-235 words), matching project_prompt.txt's READING BASELINE
 * guidance. This is independent of the adaptive engine's target-WPM
 * difficulty (paced-reading-task.ts) — no passage is gated to a
 * particular WPM level; tier only describes the text's own complexity.
 */

export type ReadingDifficultyTier = "beginner" | "intermediate" | "advanced";

export interface ComprehensionQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export interface Passage {
  id: string;
  topic: string;
  difficultyTier: ReadingDifficultyTier;
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
  difficultyTier: ReadingDifficultyTier,
  text: string,
  question: ComprehensionQuestion
): Passage {
  return { id, topic, difficultyTier, text, wordCount: wordCount(text), question };
}

export const READING_PASSAGES: Passage[] = [
  passage(
    "honeybee-waggle-dance",
    "Biology",
    "intermediate",
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
    "intermediate",
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
    "intermediate",
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
    "intermediate",
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
    "intermediate",
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
  passage(
    "ice-floats",
    "Everyday Science",
    "beginner",
    "Ice floats on water because it is less dense than liquid water. When water freezes, its molecules lock into a hexagonal pattern that takes up more space than the same molecules did as a liquid. That extra spacing makes ice lighter for its size, so it rises to the top instead of sinking. This matters for lakes and rivers in winter: a layer of ice forms on the surface, and it traps the water underneath at a steady, mild temperature instead of letting the whole lake freeze solid. Fish and other animals can survive down there even while the surface is frozen. If ice sank the way most solids do, lakes would freeze from the bottom up, and far fewer animals would make it through the winter.",
    {
      prompt: "According to the passage, why does a layer of surface ice help fish survive winter?",
      choices: [
        "It reflects sunlight to keep the whole lake warm",
        "It traps the water underneath at a steady, mild temperature",
        "It stops snow from falling into the water",
        "It prevents animals from freezing to the surface",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "first-traffic-light",
    "History",
    "beginner",
    "The first traffic signal was not electric at all. In 1868, a gas-powered signal with red and green lamps was installed outside the British Parliament to help police direct horse-drawn traffic at a busy intersection. It worked well for about a month, until a leak in the gas line caused an explosion that injured the police officer operating it. After that, the idea was mostly dropped until electric traffic signals appeared in American cities decades later, starting in the early 1900s. Today's traffic lights still follow that same basic idea: red, yellow, and green lights that drivers everywhere recognize, no matter what language they speak.",
    {
      prompt: "What happened to the first gas-powered traffic signal about a month after it was installed?",
      choices: [
        "It was replaced right away by an electric version",
        "A gas leak caused it to explode",
        "Police stopped using it because it confused drivers",
        "It was moved to a quieter intersection",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "moon-illusion",
    "Astronomy",
    "advanced",
    "When the Moon sits low on the horizon, just above rooftops or distant hills, it often looks strikingly larger than it does later the same night, high overhead — yet photographs taken at both moments show it occupies exactly the same number of pixels, proving the physical, angular size hasn't changed at all. This discrepancy, known as the Moon illusion, has been documented for over two thousand years, and it still lacks a single, universally accepted explanation. One long-standing account, the apparent-distance hypothesis, argues that the brain treats the sky as a flattened dome rather than a true hemisphere, judging the horizon to be farther away than the zenith; since an object of constant angular size is perceived as larger when the brain believes it is more distant, a horizon Moon gets inflated. A competing account emphasizes the presence of foreground objects — trees, buildings, the terrain itself — arguing that these reference points let the visual system make a size comparison it simply cannot make against an empty, textureless sky overhead. Experiments in which observers view the horizon Moon through a tube that hides the foreground tend to shrink the illusion substantially, lending some support to that second account, though neither hypothesis fully explains every reported case, and many vision scientists suspect the true answer involves both mechanisms interacting rather than either operating alone.",
    {
      prompt: "According to the passage, what happens when observers view the horizon Moon through a tube that hides the foreground?",
      choices: [
        "The illusion disappears completely and permanently",
        "The illusion tends to shrink substantially",
        "The Moon appears even larger than before",
        "Researchers can then measure its true angular size directly",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "loss-leader-pricing",
    "Economics",
    "advanced",
    "Many grocery stores intentionally sell certain staples — milk, eggs, sometimes rotisserie chicken — at a price close to or even below what the store itself paid its supplier, a strategy retailers call loss-leader pricing. The logic is not that the store wants to lose money on that specific item; rather, executives are betting that a deep discount on one recognizable, frequently purchased product will pull shoppers through the door, and that once inside, most of them will fill the rest of their cart with higher-margin goods — snacks, prepared meals, and household products priced well above cost. Economists who study this behavior point out that it depends heavily on a psychological quirk: many shoppers overweight the price of a small number of highly memorable items, like milk or eggs, when forming an overall impression of whether a store is \"cheap,\" even while remaining comparatively insensitive to markups on hundreds of other items they buy less often and can't easily recall the price of. Critics of the practice argue it can distort competition, since large chains can absorb a loss-leader item's cost far more easily than small independent grocers, who may be unable to match the promotional price without real financial strain. Some jurisdictions have gone so far as to restrict below-cost selling for exactly this reason, treating it as a potential threat to smaller competitors rather than simply a bargain for consumers.",
    {
      prompt: "According to the passage, why are shoppers willing to judge a whole store as \"cheap\" based on a few loss-leader items?",
      choices: [
        "They compare total receipts across multiple stores each week",
        "They overweight a few memorable prices while barely noticing markups elsewhere",
        "Store loyalty programs specifically train them to focus on milk and eggs",
        "Regulations require stores to advertise these prices most heavily",
      ],
      correctIndex: 1,
    }
  ),
];
