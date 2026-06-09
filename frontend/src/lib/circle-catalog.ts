export type CatalogCircle = {
  id: string
  slug: string
  en: string
  es: string
  type: "identity" | "interest" | "situational"
}

export const CIRCLE_CATALOG: CatalogCircle[] = [
  // Identity
  { id: "eeeeeeeeeeeeeeeeeeee0001", slug: "venezuelan", en: "Venezuelan", es: "Venezolano/a", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee0002", slug: "spanish", en: "Spanish", es: "Español/a", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee0003", slug: "immigrant", en: "Immigrant", es: "Inmigrante", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee0004", slug: "expat", en: "Expat", es: "Expatriado/a", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee0005", slug: "first-generation", en: "First Generation", es: "Primera generación", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee0006", slug: "lgbtq-plus", en: "LGBTQ+", es: "LGBTQ+", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee0007", slug: "parent", en: "Parent", es: "Padre o Madre", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee0008", slug: "entrepreneur", en: "Entrepreneur", es: "Emprendedor/a", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee0009", slug: "business-owner", en: "Business Owner", es: "Dueño de negocio", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee000a", slug: "freelancer", en: "Freelancer", es: "Freelancer", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee000b", slug: "artist", en: "Artist", es: "Artista", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee000c", slug: "musician", en: "Musician", es: "Músico/a", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee000d", slug: "writer", en: "Writer", es: "Escritor/a", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee000e", slug: "digital-nomad", en: "Digital Nomad", es: "Nómada digital", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee000f", slug: "introvert", en: "Introvert", es: "Introvertido/a", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee0010", slug: "activist", en: "Activist", es: "Activista", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee0011", slug: "believer", en: "Believer", es: "Creyente", type: "identity" },
  { id: "eeeeeeeeeeeeeeeeeeee0012", slug: "athlete", en: "Athlete", es: "Atleta", type: "identity" },

  // Interest
  { id: "eeeeeeeeeeeeeeeeeeee0013", slug: "cooking", en: "Cooking", es: "Cocina", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0014", slug: "astrology", en: "Astrology", es: "Astrología", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0015", slug: "photography", en: "Photography", es: "Fotografía", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0016", slug: "music", en: "Music", es: "Música", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0017", slug: "books", en: "Books", es: "Libros", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0018", slug: "travel", en: "Travel", es: "Viajes", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0019", slug: "yoga", en: "Yoga", es: "Yoga", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee001a", slug: "film", en: "Film", es: "Cine", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee001b", slug: "running", en: "Running", es: "Running", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee001c", slug: "gaming", en: "Gaming", es: "Videojuegos", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee001d", slug: "meditation", en: "Meditation", es: "Meditación", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee001e", slug: "art", en: "Art", es: "Arte", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee001f", slug: "hiking", en: "Hiking", es: "Senderismo", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0020", slug: "theatre", en: "Theatre", es: "Teatro", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0021", slug: "dance", en: "Dance", es: "Baile", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0022", slug: "surf", en: "Surf", es: "Surf", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0023", slug: "chess", en: "Chess", es: "Ajedrez", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0024", slug: "cycling", en: "Cycling", es: "Ciclismo", type: "interest" },
  { id: "eeeeeeeeeeeeeeeeeeee0025", slug: "writing", en: "Writing", es: "Escritura", type: "interest" },
  { id: "bbbbbbbbbbbbbbbbbbbb0040", slug: "football", en: "Football", es: "Fútbol", type: "interest" },

  // Situational
  { id: "eeeeeeeeeeeeeeeeeeee0026", slug: "new-parent", en: "New Parent", es: "Nuevo padre o madre", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee0027", slug: "career-change", en: "Career Change", es: "Cambio de carrera", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee0028", slug: "grief", en: "Grief", es: "Duelo", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee0029", slug: "starting-new", en: "Starting Over", es: "Empezando de nuevo", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee002a", slug: "new-to-city", en: "New to the City", es: "Nuevo/a en la ciudad", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee002b", slug: "end-of-relationship", en: "End of a Relationship", es: "Fin de una relación", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee002c", slug: "caring-for-parent", en: "Caring for a Parent", es: "Cuidando a mis padres", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee002d", slug: "retirement", en: "Retirement", es: "Jubilación", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee002e", slug: "living-alone", en: "Living Alone", es: "Viviendo solo/a", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee002f", slug: "chronic-illness", en: "Chronic Illness", es: "Enfermedad crónica", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee0030", slug: "bumpy-relationship", en: "Bumpy Relationship", es: "Relación difícil", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee0031", slug: "empty-nest", en: "Empty Nest", es: "Nido vacío", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee0032", slug: "single-parenting", en: "Single Parenting", es: "Crianza en solitario", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee0033", slug: "far-from-family", en: "Far from Family", es: "Lejos de la familia", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee0034", slug: "first-job", en: "First Job", es: "Primer trabajo", type: "situational" },
  { id: "eeeeeeeeeeeeeeeeeeee0035", slug: "recently-divorced", en: "Recently Divorced", es: "Recién divorciado/a", type: "situational" },
]
