import type { Story } from "../core/story";

export const stories: Story[] = [
  {
    id: "pack-horse-library",
    title: "The library that rode into the mountains",
    summary: "During the Great Depression, librarians carried books on horseback to remote Kentucky communities.",
    body: [
      "In the 1930s, many families in rural Kentucky lived far from a public library. The Pack Horse Library Project brought books and magazines directly to them.",
      "Carriers travelled rough mountain routes on horseback or mule, often covering many miles in a day. They exchanged books at schools, homes, and small community stops.",
      "The project turned access to reading into a shared local effort: neighbors helped maintain routes, while librarians chose books for readers of different ages. It became one of the New Deal's most memorable literacy programs.",
    ],
    topic: "History",
    readMinutes: 3,
    imageUrl: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "A warmly lit library lined with bookshelves",
    source: { label: "Wikipedia · Pack Horse Library Project", url: "https://en.wikipedia.org/wiki/Pack_Horse_Library_Project", attribution: "Adapted from the Wikipedia article Pack Horse Library Project", license: "CC BY-SA 4.0" },
  },
  {
    id: "kepler-supernova",
    title: "The star that appeared in daylight",
    summary: "Johannes Kepler watched a new star blaze into view in 1604—and spent a year tracking its changes.",
    body: [
      "On October 9, 1604, observers in Europe noticed a bright new point of light in the constellation Ophiuchus. Johannes Kepler began recording it a few days later.",
      "The object was a supernova: an exploding star far beyond the planets. Its brightness was so striking that people could see it in daylight for a short time.",
      "Kepler's careful observations helped challenge the old idea that the heavens never changed. The remnant of the explosion is still studied by astronomers today.",
    ],
    topic: "Science",
    readMinutes: 3,
    imageUrl: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "A colorful nebula glowing in deep space",
    source: { label: "NASA · Kepler's Supernova", url: "https://www.nasa.gov/history/420-years-ago-astronomer-johannes-kepler-observes-a-supernova/" },
  },
  {
    id: "voyager-golden-record",
    title: "A greeting for whoever finds Voyager",
    summary: "The Golden Record carries sounds, images, and music from Earth into interstellar space.",
    body: [
      "NASA launched Voyager 1 and Voyager 2 in 1977. Each spacecraft carries a gold-plated copper record intended as a message for any future finder.",
      "The record includes spoken greetings in dozens of languages, natural sounds such as rain and surf, music from different cultures, and encoded images of life and science on Earth.",
      "A team led by Carl Sagan assembled the collection. The spacecraft are now travelling through interstellar space, carrying this small portrait of our planet with them.",
    ],
    topic: "Culture",
    readMinutes: 4,
    imageUrl: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "Earth seen from orbit above a sunlit horizon",
    source: { label: "NASA · Golden Record Contents", url: "https://science.nasa.gov/mission/voyager/golden-record-contents/" },
  },
  {
    id: "birth-of-the-web",
    title: "The first website is still online",
    summary: "Tim Berners-Lee built the Web at CERN to make it easier for researchers to share information.",
    body: [
      "In 1989, CERN scientist Tim Berners-Lee proposed a system that linked documents across computers. He built the first browser and web server on a NeXT computer.",
      "The first website explained the World Wide Web project itself: how to use it, how to access documents, and how to set up a server. It went live to the public in 1991.",
      "CERN later made the Web software freely available. That decision helped the system spread beyond physics laboratories and become a global way to publish and connect information.",
    ],
    topic: "Technology",
    readMinutes: 3,
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=85",
    imageAlt: "A close view of a printed circuit board",
    source: { label: "CERN · The birth of the Web", url: "https://home.cern/science/computing/the-birth-of-the-web" },
  },
];
