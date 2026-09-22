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
 *
 * Grew from 15 to 30 passages (a real user complaint: with
 * reading-passage-rotation.ts's least-recently-seen ordering and 5
 * passages per session, a 15-passage bank repeats the exact same set
 * every 3 sessions) — doubling the bank doubles that cycle to 6
 * sessions before anything repeats. The 15 new ones follow the same
 * per-tier length envelope and non-guessable-question rule as the
 * originals, on topics none of the existing 15 already cover.
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
  passage(
    "sky-is-blue",
    "Physics",
    "beginner",
    "The sky looks blue because of the way sunlight interacts with gases in the atmosphere. Sunlight looks white, but it's actually every color mixed together, and each color travels as a wave of a different length. As sunlight passes through the atmosphere, it bumps into tiny gas molecules, and shorter wavelengths of light — blues and violets — scatter off those molecules far more than longer wavelengths like red and orange. This scattering, named Rayleigh scattering after the physicist who explained it, spreads blue light across the entire sky, so wherever you look, some of it reaches your eyes. Near sunset, sunlight travels through more atmosphere, so most of the blue has already scattered away, letting the remaining reds and oranges dominate.",
    {
      prompt: "According to the passage, why does blue light scatter more than red light in the atmosphere?",
      choices: [
        "Blue light travels slower through air than red light",
        "Blue light has a shorter wavelength, which scatters more off gas molecules",
        "Red light is absorbed by clouds before it can scatter",
        "Blue light is scattered only near sunset",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "cat-tongue-barbs",
    "Biology",
    "beginner",
    "A cat's tongue feels like sandpaper because it's covered in hundreds of tiny, backward-curving hooks called papillae, made of the same material as fingernails. Unlike smooth human tongues, these hooks aren't for tasting — they're a built-in grooming and eating tool. When a cat licks its fur, the papillae comb through it like a hairbrush, pulling out loose hair and spreading natural oils that keep the coat waterproof. The same hooks let a cat scrape every last bit of meat off a bone in the wild, something a smooth tongue couldn't manage nearly as well. Scientists studying the structure found that the hollow tips of the papillae can even scoop up and hold onto saliva, helping cats groom deep into their fur without needing to relick constantly.",
    {
      prompt: "According to the passage, what surprising ability did scientists find the hollow tips of a cat's papillae have?",
      choices: [
        "They can detect the temperature of food",
        "They can scoop up and hold saliva for deeper grooming",
        "They regrow within a day if damaged",
        "They release the oils that waterproof the coat",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "spacing-effect",
    "Psychology",
    "intermediate",
    "In the 1880s, the German psychologist Hermann Ebbinghaus ran a series of memory experiments on himself, memorizing lists of nonsense syllables and testing how much he forgot over time. His results produced the famous \"forgetting curve,\" showing that memory fades fastest right after learning and then levels off. But Ebbinghaus also noticed something else: if he reviewed the same material again after a delay, rather than repeating it right away, the second review strengthened his memory far more than immediate repetition did. Later researchers named this the spacing effect, and it has been replicated across languages, ages, and subjects ever since. The practical lesson is counterintuitive to how most people study: cramming the night before a test produces material that feels well-learned but fades quickly, while spacing the same amount of review across several days produces a weaker initial feeling of mastery but far stronger long-term retention. Modern spaced-repetition software is built directly on this finding, timing reviews to arrive just as a memory is about to be forgotten.",
    {
      prompt: "According to the passage, why does cramming the night before a test feel effective even though it produces worse long-term retention?",
      choices: [
        "It relies on caffeine rather than genuine memory formation",
        "The material feels well-learned in the moment but fades quickly afterward",
        "It activates a different part of the brain than spaced review does",
        "Ebbinghaus proved cramming works better for nonsense syllables specifically",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "how-caves-form",
    "Geology",
    "intermediate",
    "Most large caves form through a slow chemical reaction between rock and water rather than any dramatic single event. Rainwater absorbs carbon dioxide as it falls and moves through soil, turning it into a weak carbonic acid. When that slightly acidic water seeps into cracks in limestone bedrock, it slowly dissolves the calcium carbonate the rock is made of, widening the cracks over thousands of years into tunnels and chambers. This process, called karstification, happens far below the surface and can continue even after a cave's ceiling has largely stabilized. The stalactites and stalagmites often found inside form through a related but separate process: as mineral-rich water drips from the ceiling, tiny amounts of dissolved limestone are left behind each time a drop evaporates, building up formations that can take centuries to grow just a few inches. Because the entire process depends on slightly acidic water finding its way through soluble rock, caves are far more common in regions with limestone bedrock than in regions built on harder, less soluble stone like granite.",
    {
      prompt: "According to the passage, what is the difference between how a cave's tunnels form and how its stalactites form?",
      choices: [
        "Tunnels form from acid dissolving rock, while stalactites form from mineral deposits left by evaporating water",
        "Tunnels form quickly, while stalactites take thousands of years",
        "Stalactites form only in granite caves, while tunnels form in limestone",
        "Both form through the exact same evaporation process",
      ],
      correctIndex: 0,
    }
  ),
  passage(
    "brain-neuroplasticity",
    "Neuroscience",
    "advanced",
    "For much of the twentieth century, neuroscientists believed the adult brain was essentially fixed — that its network of neural connections was set during childhood and could only decline afterward. That view has been overturned by decades of research into neuroplasticity, the brain's capacity to physically reorganize itself in response to experience, learning, or injury, well into adulthood. One of the most striking demonstrations came from studying patients recovering from strokes that damaged the brain regions controlling movement or speech. Rather than those functions simply staying lost, brain-imaging studies showed neighboring or even distant regions gradually taking over some of the damaged area's responsibilities, forming new connections through a process called synaptic remodeling. This reorganization isn't automatic or guaranteed, however — it appears to depend heavily on repeated, effortful practice of the impaired skill, which is why intensive rehabilitation therapy after a stroke often produces measurably better recovery than rest alone. Researchers caution against overstating the finding: neuroplasticity doesn't mean the adult brain can rewire itself as freely as a child's, and recovery of complex functions like fluent speech remains far from guaranteed. Still, the discovery reshaped rehabilitation medicine, shifting therapy away from simply managing permanent loss and toward actively training the brain to recruit new tissue for old jobs.",
    {
      prompt: "According to the passage, why does intensive rehabilitation therapy tend to produce better stroke recovery than rest alone?",
      choices: [
        "Rest allows damaged neurons to regenerate on their own",
        "Neuroplasticity's reorganization depends on repeated, effortful practice of the impaired skill",
        "Therapy prevents any further brain damage from occurring",
        "The adult brain rewires as freely as a child's brain during rehabilitation",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "yawning-contagious",
    "Everyday Science",
    "beginner",
    "Yawning is oddly contagious — seeing, hearing, or even reading about someone yawning can trigger one of your own within moments. Scientists don't fully agree on why, but one leading idea ties it to empathy: brain scans show the same regions active during a contagious yawn are also involved in recognizing other people's emotional states, suggesting it may be a subtle form of social bonding. Contagious yawning shows up in only a handful of other species, including chimpanzees and dogs. In dogs, it seems to happen more often when the yawn comes from someone familiar rather than a stranger, which hints that social closeness plays a real role in whether a yawn actually catches on.",
    {
      prompt: "According to the passage, when are dogs more likely to catch a yawn from a person?",
      choices: [
        "When the yawn comes from someone familiar to them",
        "Only when they are tired themselves",
        "When multiple people yawn at once",
        "Dogs never catch yawns from humans",
      ],
      correctIndex: 0,
    }
  ),
  passage(
    "rainbow-formation",
    "Physics",
    "beginner",
    "A rainbow appears when sunlight passes through raindrops still hanging in the air, usually right after a shower. Each drop acts like a tiny prism: light enters the drop, bends, bounces off the inside back wall, and bends again as it exits, splitting the white sunlight into its full range of colors. Red light bends the least and violet bends the most, which is why the colors always appear in the same order, red on the outer edge and violet on the inner edge. Because the angle between the sun, the raindrops, and your eyes has to be just right, no two people ever see exactly the same rainbow — each person's rainbow is really a personal arrangement of a different set of drops.",
    {
      prompt: "According to the passage, why does red light end up on the outer edge of a rainbow?",
      choices: [
        "Red light bends the least as it passes through a raindrop",
        "Red light travels fastest through the air",
        "Red drops are larger than violet drops",
        "Red light reflects off the ground before reaching your eyes",
      ],
      correctIndex: 0,
    }
  ),
  passage(
    "bread-rising-yeast",
    "Everyday Science",
    "beginner",
    "Bread dough rises because of yeast, a living microorganism that feeds on the sugars in flour. As yeast digests those sugars, it releases carbon dioxide gas and a small amount of alcohol, a process called fermentation. The gas forms tiny bubbles trapped inside the stretchy network of gluten that kneading develops in the dough, and as more bubbles form, the whole loaf puffs up. Warm temperatures speed up the yeast's activity, which is why bakers often let dough rise somewhere warm, while the fridge slows fermentation down dramatically, letting bakers delay baking for hours or even a full day. When the bread finally bakes, the heat kills the yeast and the alcohol evaporates, leaving behind the light, airy texture the gas bubbles created.",
    {
      prompt: "According to the passage, what does yeast release as it digests sugar in dough?",
      choices: [
        "Carbon dioxide gas and a small amount of alcohol",
        "Only water vapor",
        "Extra gluten",
        "Salt and sugar crystals",
      ],
      correctIndex: 0,
    }
  ),
  passage(
    "compass-works",
    "Physics",
    "beginner",
    "A compass works because Earth itself behaves like an enormous magnet, with a magnetic north and south pole roughly near its geographic poles. Deep inside the planet, swirling currents of molten iron generate this magnetic field, which stretches far out into space and surrounds the whole Earth. A compass needle is a small magnet, free to spin on a low-friction pivot, and like any magnet it aligns itself with the magnetic field lines passing through it. That's why the needle consistently points toward magnetic north instead of settling in a random direction. Interestingly, magnetic north isn't exactly the same as true geographic north, and it actually drifts slowly over years as the currents inside the Earth shift, so mapmakers have to update the difference between the two from time to time.",
    {
      prompt: "According to the passage, what generates Earth's magnetic field?",
      choices: [
        "Swirling currents of molten iron deep inside the planet",
        "The compass needle itself",
        "Sunlight reflecting off the poles",
        "Satellites orbiting the Earth",
      ],
      correctIndex: 0,
    }
  ),
  passage(
    "goosebumps",
    "Biology",
    "beginner",
    "Goosebumps appear when tiny muscles at the base of each hair follicle contract, pulling the hair upright and puckering the skin around it into a small bump. In animals with thick fur, this reaction traps a layer of warming air close to the skin when it's cold, or makes the animal look larger and more threatening when it's scared. Humans still have the same muscles and the same reflex, even though our body hair is too thin and sparse to trap meaningful warmth or bulk anymore. The reflex is controlled automatically by the nervous system, which is why goosebumps show up not just from cold, but from fear, awe, or even powerful music — moments that trigger a similar rush of the same stress hormone responsible for the reaction.",
    {
      prompt: "According to the passage, why do goosebumps still occur in humans even though they no longer trap useful warmth?",
      choices: [
        "Humans have thicker fur than most animals",
        "The same automatic reflex and muscles are still present, just no longer useful for warmth",
        "Goosebumps in humans serve a completely different biological purpose",
        "The passage says goosebumps no longer occur in humans at all",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "vaccine-immune-training",
    "Biology",
    "intermediate",
    "A vaccine works by showing the immune system a safe preview of a pathogen — a weakened or inactivated version of a virus, or sometimes just a harmless piece of it, like a single protein from its outer surface. The immune system reacts to this preview the same way it would react to a real infection, producing specialized cells called antibodies that are shaped to recognize and latch onto that specific pathogen. Crucially, the immune system also creates memory cells that persist for months, years, or sometimes a lifetime, ready to mount a much faster and stronger response if the real pathogen ever shows up. That faster second response is usually enough to stop an infection before it causes serious symptoms, which is the whole point: the vaccinated person gets the protective memory without ever having to survive the actual disease first.",
    {
      prompt: "According to the passage, what is the main advantage of the memory cells a vaccine produces?",
      choices: [
        "They prevent the immune system from ever reacting again",
        "They let the body mount a faster, stronger response if the real pathogen appears later",
        "They destroy the vaccine's weakened pathogen immediately",
        "They only last for a few days after vaccination",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "wright-brothers-first-flight",
    "History",
    "intermediate",
    "When Orville and Wilbur Wright chose Kitty Hawk, North Carolina, for their first powered-flight attempts in 1903, the site wasn't random — they picked it largely for its wind. The brothers needed steady, strong headwinds to help generate enough lift for a fragile, underpowered aircraft to get off the ground, and Kitty Hawk's flat, open dunes along the Atlantic coast reliably delivered exactly that. On December 17, 1903, with a wind of around 27 miles per hour blowing in from the north, Orville piloted the Wright Flyer for 12 seconds, covering about 120 feet — shorter than the wingspan of a modern jumbo jet. They flew three more times that day, with Wilbur's final flight covering 852 feet in 59 seconds. Contemporary newspapers largely ignored the achievement, and it took several more years of refinement and public demonstrations before the world took the Wright brothers' claim seriously.",
    {
      prompt: "According to the passage, why did the Wright brothers specifically choose Kitty Hawk for their first flight attempts?",
      choices: [
        "It was close to their home workshop",
        "Its steady, strong winds helped generate enough lift for their aircraft",
        "It had the flattest paved runways available at the time",
        "Newspapers were already based there to cover the event",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "glass-from-sand",
    "Chemistry",
    "intermediate",
    "Ordinary glass is made by melting sand — specifically silica, or silicon dioxide, the same mineral that makes up most beach sand — at extremely high temperatures, well over 1,600 degrees Celsius, until it becomes a thick liquid. On its own, pure melted silica cools into glass at such a high temperature that it's expensive and difficult to work with, so most manufacturers add soda ash to lower the melting point substantially, making the process far cheaper and more practical. Soda-lime glass, the type used in windows and bottles, also includes limestone, which makes the finished glass more chemically stable and resistant to dissolving back into water over time. What makes glass unusual as a material is that it never fully organizes into the neat, repeating crystal structure typical of solids; instead its molecules stay in a disordered, liquid-like arrangement even after hardening, which is part of why glass is technically classified as an amorphous solid rather than a true crystal.",
    {
      prompt: "According to the passage, why do most glass manufacturers add soda ash to melted silica?",
      choices: [
        "To make the glass more colorful",
        "To lower the melting point and make the process cheaper and more practical",
        "To make the glass melt at a higher temperature",
        "To prevent the glass from becoming transparent",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "penicillin-discovery",
    "History",
    "intermediate",
    "In 1928, the Scottish bacteriologist Alexander Fleming returned from a summer vacation to find that one of his bacterial culture dishes, accidentally left uncovered, had grown a patch of mold — and that the bacteria near the mold had died off. Rather than discarding the contaminated dish, Fleming investigated further and identified the mold as a strain of Penicillium, and found that whatever substance it produced could kill a wide range of disease-causing bacteria without harming human cells. He named the substance penicillin, but Fleming himself struggled to purify enough of it to test on live patients, and his findings attracted little attention for over a decade. It wasn't until the early 1940s, when a team led by Howard Florey and Ernst Chain developed methods to mass-produce a stable, purified version, that penicillin became a practical treatment — arriving just in time to treat wounded soldiers during World War II and beginning the modern antibiotic era.",
    {
      prompt: "According to the passage, what problem prevented Fleming's discovery from becoming a usable treatment right away?",
      choices: [
        "The mold itself was too dangerous to handle safely",
        "Fleming struggled to purify enough penicillin to test on live patients",
        "No bacteria were found to be affected by it",
        "World War II delayed all medical research at the time",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "tides-moon-gravity",
    "Astronomy",
    "intermediate",
    "Ocean tides are caused mainly by the Moon's gravity pulling on Earth's water. The pull is strongest on the side of Earth facing the Moon, bulging the ocean outward there, but a second bulge forms on the exact opposite side of the planet too — not because the Moon pulls harder there, but because the solid Earth itself is pulled toward the Moon slightly more than the far-side water is, effectively leaving that water behind. As Earth rotates roughly once every 24 hours, a given coastline usually passes through both bulges, producing the familiar pattern of two high tides and two low tides most days. The Sun also pulls on Earth's oceans, though its effect is weaker than the Moon's despite the Sun's far greater mass, simply because it's so much farther away. When the Sun and Moon align during a new or full moon, their pulls combine to produce unusually high \"spring tides,\" while at other times they partially cancel out, producing gentler \"neap tides.\"",
    {
      prompt: "According to the passage, why does a tidal bulge form on the side of Earth facing away from the Moon?",
      choices: [
        "The Moon's gravity is actually stronger on that side",
        "The solid Earth is pulled toward the Moon slightly more than the far-side water is, leaving that water behind",
        "The Sun's gravity pushes water toward that side",
        "Wind patterns push the ocean toward the far side",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "survivorship-bias-wald",
    "Statistics",
    "advanced",
    "During World War II, the U.S. military examined bomber aircraft returning from combat missions, tallying where each plane had taken bullet damage, with an eye toward reinforcing those areas with additional armor. The data showed damage concentrated heavily on the wings, tail, and fuselage, and the initial instinct was to armor precisely those spots. The statistician Abraham Wald, working with a military research group, argued the opposite: the planes being studied were, by definition, the ones that had survived their damage and made it home. Damage to the wings and tail, however severe it looked, evidently wasn't fatal enough to bring a plane down. The far more important damage was on the areas with no bullet holes at all in the returning sample — most obviously the engines and cockpit — because planes hit there most likely never made it back to be counted. Wald's insight, now known as survivorship bias, is the general error of drawing conclusions only from the survivors of some selection process while overlooking the entire group that didn't survive to be observed at all. The same reasoning error shows up far beyond aviation, in fields from finance to medicine to studies of successful companies, wherever researchers unknowingly study only the outcomes that happened to make it into the sample.",
    {
      prompt: "According to the passage, what was Wald's key insight about where the returning bombers were NOT damaged?",
      choices: [
        "Those undamaged areas, like the engines and cockpit, were probably fatal when hit, so those planes never made it back to be studied",
        "Those areas simply never got hit by enemy fire during the entire war",
        "The military had already reinforced those exact areas before the study began",
        "Pilots deliberately avoided flying routes that would expose those areas",
      ],
      correctIndex: 0,
    }
  ),
  passage(
    "tragedy-of-the-commons",
    "Economics",
    "advanced",
    "The \"tragedy of the commons\" describes a situation where individuals sharing a limited resource each have a rational incentive to use as much of it as they personally can, even though the combined effect of everyone doing so depletes or destroys the resource for the whole group. The classic illustration, popularized by ecologist Garrett Hardin in 1968, imagines a shared pasture open to every herder in a village: each herder gains the full benefit of adding one more animal to graze there, while the cost of that extra grazing — a slightly more worn-down pasture — is spread thinly across everyone. Because the personal benefit outweighs the personal share of the cost, every herder is individually motivated to add more animals, even while collectively understanding that the pasture will eventually be ruined if everyone does so. Real-world examples researchers point to include overfished ocean fisheries, groundwater aquifers pumped faster than they can refill, and, more recently, the atmosphere's capacity to absorb greenhouse gases without disruptive climate change. Economists and policy researchers have proposed several kinds of solutions, ranging from privatizing the resource so a single owner bears the full cost of overuse, to government-imposed usage limits, to Nobel laureate Elinor Ostrom's extensively documented finding that communities can often manage shared resources successfully on their own, through locally developed rules and social enforcement, without needing either private ownership or outside government regulation.",
    {
      prompt: "According to the passage, what did Elinor Ostrom's research find about managing shared resources?",
      choices: [
        "Privatization is the only solution that reliably works",
        "Communities can often successfully manage shared resources themselves, through locally developed rules, without private ownership or government regulation",
        "Government regulation is always required to prevent overuse",
        "Shared resources inevitably collapse no matter what is tried",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "crispr-gene-editing",
    "Biology",
    "advanced",
    "CRISPR-Cas9 is a gene-editing tool adapted from a natural defense system that bacteria use against viruses. In nature, bacteria that survive a viral infection store a short snippet of the virus's genetic code in their own DNA, using it later as a reference to recognize and cut up that same virus if it attacks again — the CRISPR sequences are essentially a genetic mugshot file, and Cas9 is the molecular scissors that acts on it. Researchers realized this system could be reprogrammed: by supplying Cas9 with a custom-designed guide sequence instead of a bacterial one, scientists can direct it to cut a specific, chosen location in virtually any organism's DNA, including human cells. Once the DNA is cut, the cell's own repair machinery takes over, and scientists can exploit that repair process either to simply disable a gene or to insert a new, specific sequence in its place. This has made genetic research dramatically faster and cheaper than older editing techniques, and it has opened real, if still-developing, medical possibilities, including treatments for certain inherited blood disorders that have already received regulatory approval. The technology also raises serious ethical questions, particularly around the prospect of editing embryos in ways that would be passed down to future generations, which is why most countries currently restrict or ban that specific application even as therapeutic editing of an individual patient's own cells moves forward.",
    {
      prompt: "According to the passage, what role does CRISPR play in bacteria's natural biology, before any human adaptation?",
      choices: [
        "It helps bacteria digest nutrients more efficiently",
        "It stores snippets of viral DNA so bacteria can recognize and cut up that virus if it attacks again",
        "It allows bacteria to reproduce more quickly",
        "It protects bacteria from extreme temperatures",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "dunning-kruger-effect",
    "Psychology",
    "advanced",
    "In 1999, psychologists David Dunning and Justin Kruger published a study describing a pattern that has since become widely known, and widely misunderstood, as the Dunning-Kruger effect: people with limited skill or knowledge in a given area tend to overestimate their own competence, in part because the same lack of skill that produces poor performance also prevents them from recognizing that performance is poor. Judging whether an answer to a logic puzzle, or a piece of writing, or a joke is any good requires some of the same underlying competence needed to produce a good one in the first place, so a genuine novice is often missing the very yardstick they'd need to judge their own weak performance accurately. In the original study, participants who scored in the bottom quartile on tests of logic, grammar, and humor substantially overestimated where their scores ranked compared to their peers. A frequently repeated but less accurate version of the finding claims that the least competent people are consistently the most confident of all, full stop — the original data doesn't support that stronger claim; the most competent participants in the study were, on average, slightly more accurate about their own ranking than the least competent, but they too showed a smaller, different bias, generally underestimating how well they'd done relative to others, likely because they assumed a difficult task must have been just as easy for everyone else.",
    {
      prompt: "According to the passage, what does the original 1999 study data NOT support, despite being a commonly repeated version of the finding?",
      choices: [
        "That people with limited skill tend to overestimate their competence at all",
        "That the least competent people are consistently the single most confident of everyone, full stop",
        "That competence and self-assessment accuracy are related in any way",
        "That highly skilled people ever misjudge their own performance",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "gravitational-lensing",
    "Astronomy",
    "advanced",
    "Gravitational lensing occurs because massive objects, like galaxies and galaxy clusters, actually bend the fabric of spacetime around them, and light travels along that curved spacetime rather than in a perfectly straight line. When light from a distant galaxy passes close to a massive foreground object on its way to Earth, that light's path bends, sometimes dramatically, which can make the distant galaxy appear stretched into an arc, magnified, or even split into multiple duplicate images, depending on exactly how the light happens to be bent. Albert Einstein predicted this effect as a consequence of his general theory of relativity in 1915, and it was first confirmed observationally during a solar eclipse in 1919, when astronomers measured starlight bending around the Sun by almost exactly the amount Einstein's equations predicted — a result that made Einstein internationally famous almost overnight. Beyond confirming relativity, gravitational lensing has become a genuinely practical tool for modern astronomy: because the amount of bending depends on the total mass doing the bending, including invisible mass, astronomers use lensing patterns to map the distribution of dark matter, which emits no light of its own and would otherwise be undetectable. Lensing by massive galaxy clusters can also act as a natural magnifying glass, letting telescopes observe extremely distant, faint galaxies that would be too dim to detect directly, effectively turning the universe's own geometry into part of the telescope.",
    {
      prompt: "According to the passage, how do astronomers use gravitational lensing to study dark matter?",
      choices: [
        "Dark matter blocks lensing entirely, so its absence reveals where it is not located",
        "Since the amount of light-bending depends on total mass, including invisible mass, lensing patterns can map where dark matter is distributed",
        "Dark matter emits a faint light that lensing makes visible directly",
        "Lensing only detects normal matter, so dark matter must be inferred by its complete absence from any lensing effect",
      ],
      correctIndex: 1,
    }
  ),
  passage(
    "coral-bleaching",
    "Environmental Science",
    "advanced",
    "A coral reef's vivid color comes not from the coral animal itself, which is nearly transparent, but from microscopic algae called zooxanthellae that live inside its tissue in a close partnership: the coral provides the algae shelter and compounds it needs for photosynthesis, and in exchange the algae supply the coral with the majority of its energy and its color. That partnership becomes fragile under heat stress. When water temperatures rise even one or two degrees Celsius above a reef's normal summer maximum for an extended period, the algae's photosynthesis starts producing toxic byproducts faster than the coral can safely process them, and the coral responds by expelling its own algae en masse. Without the algae, the coral's transparent tissue reveals the white calcium-carbonate skeleton underneath, the phenomenon known as coral bleaching. A bleached coral is not automatically dead — if temperatures drop back down quickly enough, it can sometimes recruit new algae and recover — but a prolonged bleaching event leaves it without its main energy source, and corals that stay bleached for too long typically starve. Because reef-building corals grow so slowly, a reef that suffers repeated severe bleaching events in close succession often cannot regrow fast enough between them to recover, which is why scientists treat the frequency of bleaching events, not just their individual severity, as the more alarming long-term trend.",
    {
      prompt: "According to the passage, why do scientists consider the frequency of bleaching events, not just their severity, especially alarming?",
      choices: [
        "Frequent events prevent reefs from growing back before the next one hits",
        "Frequent events cause the algae to become permanently toxic",
        "Severity has no real effect on coral survival",
        "Frequent bleaching events are always more severe than isolated ones",
      ],
      correctIndex: 0,
    }
  ),
];
